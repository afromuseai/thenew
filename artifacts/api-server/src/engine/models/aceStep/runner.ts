export async function runAceStepLocal(input: any) {
  return {
    model: "acestep",
    output: "audio-buffer-placeholder",
    metadata: input,
  };
}
