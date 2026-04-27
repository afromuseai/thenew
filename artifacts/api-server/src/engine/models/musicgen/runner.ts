export async function runMusicGenLocal(input: any) {
  return {
    model: "musicgen",
    output: "audio-buffer-placeholder",
    metadata: input,
  };
}
