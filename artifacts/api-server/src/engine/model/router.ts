import { runMusicGen } from "./musicgen";

export async function modelRun(prompt: string, mode: string) {
  return runMusicGen({
    prompt,
    mode,
  });
}
