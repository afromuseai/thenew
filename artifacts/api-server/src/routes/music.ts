/**
 * AfroMuse Music Generation Routes
 *
 * POST /music/generate   — auth required; checks usage limits; calls musicGeneration service;
 *                          saves all returned tracks to DB; returns full result
 * POST /music/callback   — webhook endpoint for AI Music API job completion events
 * GET  /music/library    — auth required; returns user's generated track history
 *
 * Usage limits (enforced server-side):
 *   Free:        3 generation lifetime
 *   Creator Pro: 20 per month
 *   Artist Pro:  50 per month
 *   Admin:       unlimited
 */

import { Router } from "express";
import { db, usageLogsTable, generatedTracksTable, usersTable } from "@workspace/db";
import { eq, gte, and, sql, count } from "drizzle-orm";
import { generateMusic } from "../services/musicGeneration.js";
import { requireAuth } from "../access/middleware.js";
import { resolveServerPlan } from "../access/plans.js";

const router = Router();

const LIMITS = {
  free: { count: 1, period: "all-time" },
  "creator-pro": { count: 50, period: "monthly" },
  "artist-pro": { count: 100, period: "monthly" },
};

async function getUsage(userId: number, planId: string) {
  const cfg = LIMITS[planId] ?? LIMITS.free;

  let where;
  if (cfg.period === "all-time") {
    where = eq(usageLogsTable.userId, userId);
  } else {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    where = and(
      eq(usageLogsTable.userId, userId),
      gte(usageLogsTable.createdAt, start)
    );
  }

  const [row] = await db.select({ value: count() }).from(usageLogsTable).where(where);

  return {
    used: row?.value ?? 0,
    limit: cfg.count,
    allowed: (row?.value ?? 0) < cfg.count,
  };
}

router.post("/generate", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const planId = resolveServerPlan(user?.plan ?? "Free", user?.role);

  const usage = await getUsage(userId, planId);

  if (!usage.allowed) {
    return res.status(429).json({
      success: false,
      error: "Limit reached",
      limitReached: true,
      ...usage,
    });
  }

  try {
    const payload = req.body;

    const data = await generateMusic(payload);

    await db.insert(usageLogsTable).values({
      userId,
      feature: "audio_generation",
      plan: user?.plan,
    });

    if (data.tracks?.length) {
      await db.insert(generatedTracksTable).values(
        data.tracks.map((t: any) => ({
          userId,
          title: t.title,
          audioUrl: t.audioUrl,
          coverArt: t.coverArt ?? null,
        }))
      );
    }

    res.json({
      success: true,
      data,
      usage: {
        used: usage.used + 1,
        limit: usage.limit,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get("/usage", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const planId = resolveServerPlan(user?.plan ?? "Free", user?.role);

  const usage = await getUsage(userId, planId);

  res.json({ success: true, ...usage });
});

export default router;