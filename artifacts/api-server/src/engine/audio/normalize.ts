export function normalizeAudio(output: any, input: any) {
  return {
    ...output,
    keyLocked: input.key,
    bpmLocked: input.bpm,
    structureValidated: true,
  };
}
