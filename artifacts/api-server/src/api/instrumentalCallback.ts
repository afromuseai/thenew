import type { Request, Response } from "express";

// Temporary in-memory store (same pattern you already use)
const callbackStore = new Map<string, any>();

export function instrumentalCallback(req: Request, res: Response) {
  try {
    const body = req.body;

    console.log("🎧 CALLBACK RECEIVED:", JSON.stringify(body, null, 2));

    // AI Music API sends data like this:
    // { data: { workId, type, response_data: [...] } }

    const workId = body?.data?.workId;

    if (!workId) {
      console.warn("⚠️ No workId in callback");
      return res.status(400).json({ success: false });
    }

    const track = body?.data?.response_data?.[0];

    if (!track) {
      console.warn("⚠️ No track data in callback");
      return res.status(400).json({ success: false });
    }

    const result = {
      audioUrl: track.audio_url,
      imageUrl: track.image_url,
      title: track.title || "Generated Track",
    };

    // Store result so polling loop can pick it up
    callbackStore.set(workId, result);

    console.log("✅ CALLBACK STORED:", workId);

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ CALLBACK ERROR:", err);
    return res.status(500).json({ success: false });
  }
}

// helper (optional if already exists elsewhere)
export function getCallbackResult(workId: string) {
  return callbackStore.get(workId);
}