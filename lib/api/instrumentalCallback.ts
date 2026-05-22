import type { Request, Response } from "express";
import { storeCallbackResult } from "../callbackStore";

export async function instrumentalCallback(req: Request, res: Response) {
  try {
    const body = req.body;

    const taskId =
      body.task_id ||
      body.workId ||
      body.data?.task_id;

    const track = body.data?.response_data?.[0];

    if (!taskId || !track) {
      console.warn("Invalid callback payload", body);
      return res.status(400).send("Invalid payload");
    }

    storeCallbackResult(taskId, {
      audioUrl: track.audio_url,
      imageUrl: track.image_url,
      title: track.title || "Generated Track",
    });

    console.log("✅ Callback stored:", taskId);

    res.status(200).send("OK");
  } catch (err) {
    console.error("Callback error:", err);
    res.status(500).send("Error");
  }
}