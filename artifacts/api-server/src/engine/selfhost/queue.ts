import { randomUUID } from "node:crypto";
import { runInference } from "./inference";

interface Job {
  id: string;
  status: "queued" | "processing" | "complete" | "failed";
  input: any;
  result?: any;
  error?: string;
}

const jobs = new Map<string, Job>();

export async function enqueueJob(input: any) {
  const id = randomUUID();

  const job: Job = {
    id,
    status: "queued",
    input,
  };

  jobs.set(id, job);

  process.nextTick(async () => {
    job.status = "processing";

    try {
      const result = await runInference(job.input);

      job.status = "complete";
      job.result = result;
    } catch (err: any) {
      job.status = "failed";
      job.error = err.message;
    }
  });

  return job;
}

export function getJob(id: string) {
  return jobs.get(id);
}
