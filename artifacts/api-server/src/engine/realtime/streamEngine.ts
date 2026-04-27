import { generateChunk } from "../models/musicgen/chunkRunner";
import { sendChunk } from "./websocket";
import { buildTimeline } from "./timeline";

export async function startStreamSession(input: any, ws: any) {
  const timeline = buildTimeline(input);

  for (const segment of timeline) {
    try {
      const chunk = await generateChunk({
        prompt: input.prompt,
        segment,
        bpm: input.bpm,
        key: input.key,
      });

      sendChunk(ws, {
        type: "audio-chunk",
        segment: segment.name,
        data: chunk,
      });
    } catch (err: any) {
      sendChunk(ws, {
        type: "chunk-error",
        segment: segment.name,
        error: err?.message ?? "chunk generation failed",
      });
    }
  }

  sendChunk(ws, {
    type: "stream-complete",
  });
}
