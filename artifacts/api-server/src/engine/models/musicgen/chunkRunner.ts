export async function generateChunk(input: any) {
  const prompt = `
SECTION: ${input.segment.name}
BPM: ${input.bpm}
KEY: ${input.key}
PROMPT: ${input.prompt}
  `;

  return {
    audio: "binary-audio-buffer-placeholder",
    prompt,
    segment: input.segment.name,
  };
}
