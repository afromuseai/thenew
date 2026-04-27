import express, { type Request, type Response } from "express";
import { runAfroMuse } from "../afroCore/pipeline";
import { ProjectStore } from "../storage/projects";

const router = express.Router();

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const result = await runAfroMuse(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/projects", (_req: Request, res: Response) => {
  res.json(ProjectStore.all());
});

router.get("/projects/:id", (req: Request, res: Response) => {
  const project = ProjectStore.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  res.json(project);
});

export default router;
