export function enforceStructure(input: any) {
  if (input.mode === "instrumental") {
    return {
      ...input,
      structure: ["intro", "build", "drop", "break", "drop", "outro"],
    };
  }

  return {
    ...input,
    structure: [
      "intro",
      "chorus",
      "verse",
      "chorus",
      "verse",
      "chorus",
      "outro",
    ],
  };
}
