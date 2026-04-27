import { randomUUID } from "node:crypto";
import { generatePrompt } from "../promptOS/afroPrompt";
import { enforceStructure } from "../composer/structure";
import { modelRun } from "../model/router";
import { postProcess } from "../post/process";
import { ProjectStore } from "../storage/projects";

export async function runAfroMuse(input: any) {
  const prompt = generatePrompt(input);

  const structured = enforceStructure(input);

  const output = await modelRun(prompt, structured.mode);

  const finalOutput = postProcess(output, structured);

  const id = finalOutput.id || randomUUID();
  finalOutput.id = id;
  ProjectStore.save(id, finalOutput);

  return finalOutput;
}
