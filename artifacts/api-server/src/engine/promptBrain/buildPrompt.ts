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
  ].join("\n");

  // 2b. MUSICAL CONSTRAINTS — strict, locked, must-follow
  const constraintsBlock = buildConstraintsBlock(key, bpm);

  // 3. DNA
  const dna = fuseDNA(beatDNA, isVocal ? artistDNA : undefined);

  // 4. MODE
  const modeBlock =
    mode === "instrumental"
      ? "OUTPUT: Instrumental only. No vocals.\nFocus on beat, melody, arrangement, and groove."
      : mode === "vocal"
      ? "OUTPUT: Full vocal performance.\nInclude lead vocals, structure, hook, and emotional delivery."
      : "OUTPUT: Full song with vocals + instrumental integration.";

  return [
    identityBlock,
    contextBlock,
    constraintsBlock,
    dna.beatBlock,
    dna.artistBlock,
    modeBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Build the strict MUSICAL CONSTRAINTS block.
 *
 * KEY and TEMPO are *not* casual hints — they are locked musical constraints.
 * The block tells the downstream model that every melody, bassline, and chord
 * must stay inside the specified key with no drift or modulation.
 *
 * If `key` is not provided, the block still emits a "Not specified" line so
 * the constraint section is consistently present in every prompt.
 */
function buildConstraintsBlock(key?: string, bpm?: number): string {
  const keyLine = key && key.trim()
    ? `- Key: ${key.trim()}`
    : "- Key: Not specified";

  const tempoLine = typeof bpm === "number" && Number.isFinite(bpm) && bpm > 0
    ? `- Tempo: ${bpm} BPM`
    : "- Tempo: 95 BPM";

  return [
    "MUSICAL CONSTRAINTS (STRICT — MUST FOLLOW):",
    keyLine,
    tempoLine,
    "",
    "PRODUCTION RULES:",
    "- MUST strictly follow the specified musical key",
    "- All melodies, basslines, and chords MUST stay within the key",
    "- No key drift or modulation allowed",
    "- Must sound musical and harmonically correct",
  ].join("\n");
}

export type { PromptInput } from "./types";