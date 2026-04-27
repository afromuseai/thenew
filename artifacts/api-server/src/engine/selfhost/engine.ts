import { enqueueJob } from "./queue";

export async function runSelfHostedAudio(input: any) {
  const job = await enqueueJob(input);

  return {
    jobId: job.id,
    status: "queued",
  };
}
