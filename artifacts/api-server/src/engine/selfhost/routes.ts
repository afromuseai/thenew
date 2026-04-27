import express, { type Request, type Response } from "express";
import { runSelfHostedAudio } from "./engine";
import { getJob } from "./queue";

const router = express.Router();

router.post("/jobs", async (req: Request, res: Response) => {
  try {
    const result = await runSelfHostedAudio(req.body);
    res.status(202).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/jobs/:id", (req: Request, res: Response) => {
  const job = getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json(job);
});

export default router;
