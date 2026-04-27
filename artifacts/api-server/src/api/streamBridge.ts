import express from "express";
import { wsInstance } from "../lib/expressApp";
import { callColabWorker } from "../engine/bridge/colabClient";
import { relayStream } from "../engine/bridge/streamRelay";

const router = express.Router();
wsInstance.applyTo(router);

(router as any).ws("/stream-ai", (ws: any) => {
  ws.on("message", async (msg: Buffer | string) => {
    try {
      const input = JSON.parse(msg.toString());
      const stream = await callColabWorker(input);
      await relayStream(stream, ws);
    } catch (err: any) {
      ws.send(
        JSON.stringify({
          type: "stream-error",
          error: err?.message ?? "colab bridge failed",
        }),
      );
    }
  });
});

export default router;
