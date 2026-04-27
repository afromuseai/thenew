export function generatePrompt(input: any): string {
  const {
    title,
    style,
    genre,
    mood,
    bpm,
    key,
    beatDNA,
    artistDNA,
    mode,
  } = input;

  const isVocal = mode === "vocal" || mode === "full-song";

  const identityBlock = `
USER CREATIVE DIRECTION:
${style || "No direction provided"}
`;

  const contextBlock = `
TITLE: ${title || "Untitled"}
GENRE: ${genre || "Unknown"}
MOOD: ${mood || "Neutral"}
BPM: ${bpm || "Auto"}
KEY: ${key || "Auto"}
`;

  const dnaBlock = `
BEAT DNA: ${beatDNA || "default"}
ARTIST DNA: ${isVocal ? artistDNA || "none" : "disabled"}
`;

  const modeBlock =
    mode === "instrumental"
      ? "OUTPUT: Instrumental only. No vocals allowed."
      : mode === "vocal"
        ? "OUTPUT: Full vocal performance with structure."
        : "OUTPUT: Full song with vocals and instrumental integration.";

  return [identityBlock, contextBlock, dnaBlock, modeBlock]
    .filter(Boolean)
    .join("\n\n");
}
