import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, usersTable, projectsTable, usageLogsTable, generatedTracksTable } from "@workspace/db";
import { desc, count, eq, and, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getCredentialSummary, setProviderApiKey } from "../engine/providerCredentials.js";

const router = Router();

const COOKIE_NAME = "auth_token";

function verifyAdminToken(token: string): { userId: number; email: string; role: string } | null {
  try {
    const secret = process.env["SESSION_SECRET"];
    if (!secret) return null;
    const payload = jwt.verify(token, secret) as { userId: number; email: string; role: string };
    return payload.role === "admin" ? payload : null;
  } catch {
    return null;
  }
}

function getAdminToken(req: any): { userId: number; email: string; role: string } | null {
  // Cookie first
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken) {
    const p = verifyAdminToken(cookieToken);
    if (p) return p;
  }
  // Bearer header fallback
  const auth = req.headers?.authorization as string | undefined;
  if (auth?.startsWith("Bearer ")) {
    const p = verifyAdminToken(auth.slice(7));
    if (p) return p;
  }
  return null;
}

router.get("/admin/stats", async (req, res) => {
  const payload = getAdminToken(req);
  if (!payload) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  try {
    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        plan: usersTable.plan,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    // Get per-user audio generation counts (this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usageCounts = await db
      .select({
        userId: usageLogsTable.userId,
        count: count(),
      })
      .from(usageLogsTable)
      .where(
        and(
          eq(usageLogsTable.feature, "audio_generation"),
          gte(usageLogsTable.createdAt, startOfMonth),
        )
      )
      .groupBy(usageLogsTable.userId);

    const allTimeUsage = await db
      .select({
        userId: usageLogsTable.userId,
        count: count(),
      })
      .from(usageLogsTable)
      .where(eq(usageLogsTable.feature, "audio_generation"))
      .groupBy(usageLogsTable.userId);

    const monthlyMap: Record<number, number> = {};
    for (const r of usageCounts) { if (r.userId) monthlyMap[r.userId] = r.count; }

    const allTimeMap: Record<number, number> = {};
    for (const r of allTimeUsage) { if (r.userId) allTimeMap[r.userId] = r.count; }

    const usersWithUsage = users.map((u) => ({
      ...u,
      audioGenMonthly: monthlyMap[u.id] ?? 0,
      audioGenAllTime: allTimeMap[u.id] ?? 0,
    }));

    const planCounts = users.reduce(
      (acc, u) => {
        const key = u.role === "admin" ? "admin" : (u.plan as string);
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const [projectCountRow] = await db.select({ value: count() }).from(projectsTable);
    const totalProjects = projectCountRow?.value ?? 0;

    const [trackCountRow] = await db.select({ value: count() }).from(generatedTracksTable);
    const totalTracks = trackCountRow?.value ?? 0;

    res.json({
      users: usersWithUsage,
      planCounts: {
        Free:  planCounts["Free"]  ?? 0,
        Pro:   planCounts["Pro"]   ?? 0,
        Gold:  planCounts["Gold"]  ?? 0,
        Admin: planCounts["admin"] ?? 0,
      },
      totalUsers: users.length,
      totalProjects,
      totalTracks,
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch admin stats");
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

// ─── POST /admin/change-plan ─────────────────────────────────────────────────

router.post("/admin/change-plan", async (req, res) => {
  const payload = getAdminToken(req);
  if (!payload) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  const { userId, plan } = req.body as { userId?: number; plan?: string };
  const VALID_PLANS = ["Free", "Pro", "Gold"];

  if (!userId || typeof userId !== "number") {
    res.status(400).json({ error: "userId must be a number." });
    return;
  }
  if (!plan || !VALID_PLANS.includes(plan)) {
    res.status(400).json({ error: `plan must be one of: ${VALID_PLANS.join(", ")}` });
    return;
  }

  try {
    await db.update(usersTable).set({ plan }).where(eq(usersTable.id, userId));
    logger.info({ admin: payload.email, targetUserId: userId, newPlan: plan }, "Admin changed user plan");
    res.json({ ok: true, userId, plan });
  } catch (err) {
    logger.error({ err }, "Failed to change user plan");
    res.status(500).json({ error: "Failed to change plan." });
  }
});

// ─── GET /admin/engine-status — public ───────────────────────────────────────
router.get("/admin/engine-status", (_req, res) => {
  const instrumental = getCredentialSummary("instrumental");
  res.json({
    instrumental: {
      apiKeySet:   instrumental.apiKeySet,
      endpointSet: instrumental.endpointSet,
      isLive:      instrumental.apiKeySet && instrumental.endpointSet,
    },
  });
});

// ─── POST /admin/set-api-key — admin-gated ────────────────────────────────────
router.post("/admin/set-api-key", (req, res) => {
  const payload = getAdminToken(req);
  if (!payload) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  const { provider, key } = req.body as { provider?: string; key?: string };
  if (provider !== "instrumental") {
    res.status(400).json({ error: "Unsupported provider. Use \"instrumental\"." });
    return;
  }
  if (typeof key !== "string") {
    res.status(400).json({ error: "key must be a string." });
    return;
  }

  setProviderApiKey("instrumental", key);
  logger.info({ admin: payload.email, keyLength: key.trim().length }, "AI Music API key updated at runtime");
  res.json({ ok: true, apiKeySet: key.trim().length > 0 });
});

export default router;
