import type { PromptInput } from "./types";
import { weighStyle } from "./styleWeighting";
import { fuseDNA } from "./dnaFusion";

export function buildPrompt(input: PromptInput): string {
  const {
    title,
    style,
    genre,
    mood,
    bpm,
    key,
    beatDNA,
    artistDNA,
    promptMode,
  } = input;

  const mode = promptMode ?? "standard";
  const isVocal = mode === "vocal" || mode === "full-song";

  // 1. IDENTITY
  const styleWeight = weighStyle(style);

  const identityBlock = `USER CREATIVE DIRECTION (${styleWeight.label.toUpperCase()}):
${style?.trim() || "No specific direction provided"}`;

  // 2. CONTEXT
  const contextBlock = [
    `TITLE: ${title?.trim() || "Untitled Track"}`,
    `GENRE: ${genre || "Unknown"}`,
    `MOOD: ${mood || "Neutral"}`,
    `BPM: ${bpm ?? "Auto"}`,
    `KEY: ${key || "Auto"}`,
  ].join("\n");

  // 3. DNA
  const dna = fuseDNA(beatDNA, isVocal ? artistDNA : undefined);

  // 4. MODE
  const modeBlock =
    mode === "instrumental"
      ? "OUTPUT: Instrumental only. No vocals.\nFocus on beat, melody, arrangement, and groove."
      : mode === "vocal"
      ? "OUTPUT: Full vocal performance.\nInclude lead vocals, structure, hook, and emotional delivery."
      : "OUTPUT: Full song with vocals + instrumental integration.";

  return [identityBlock, contextBlock, dna.beatBlock, dna.artistBlock, modeBlock]
    .filter(Boolean)
    .join("\n\n");
}

export type { PromptInput } from "./types";