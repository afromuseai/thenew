export function postProcess(output: any, input: any) {
  return {
    ...output,
    key: input.key,
    bpm: input.bpm,
    mode: input.mode,
    structureLocked: true,
  };
}
