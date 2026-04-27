import express from "express";
import { wsInstance } from "../lib/expressApp";
import { startStreamSession } from "../engine/realtime/streamEngine";

const router = express.Router();
wsInstance.applyTo(router);

(router as any).ws("/stream", (ws: any, _req: any) => {
  ws.on("message", async (msg: Buffer | string) => {
    try {
      const input = JSON.parse(msg.toString());
      await startStreamSession(input, ws);
    } catch (err: any) {
      ws.send(
        JSON.stringify({
          type: "stream-error",
          error: err?.message ?? "invalid stream request",
        }),
      );
    }
  });
});

export default router;
