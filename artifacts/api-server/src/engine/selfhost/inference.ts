import { runMusicGenLocal } from "../models/musicgen/runner";
import { runAceStepLocal } from "../models/aceStep/runner";
import { awsRun } from "../cloud/awsAdapter";

export async function runInference(job: any) {
  const mode = detectRuntime();

  if (mode === "aws") {
    return awsRun(job);
  }

  if (job.model === "musicgen") {
    return runMusicGenLocal(job);
  }

  if (job.model === "acestep") {
    return runAceStepLocal(job);
  }

  throw new Error("Unknown model type");
}

function detectRuntime() {
  if (process.env.AWS_GPU === "true") return "aws";
  return "local";
}
