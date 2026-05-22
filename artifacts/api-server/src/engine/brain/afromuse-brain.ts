/**
 * AfroMuse Brain Engine
 * ---------------------
 * This is the core intelligence layer that converts user intent
 * into structured musical generation instructions.
 */

import { getEmotionProfile } from "../emotion";
import { getSoundSignature } from "../soundSignature";
import { getMemory, getUserStyleProfile } from "../memory";

/**
 * Types
 */
export type LyricSection = {
  type: "intro" | "verse" | "chorus" | "bridge" | "outro";
  text: string;
};

export type BuildInput = {
  genre: string;
  mood: string;
  bpm?: string;
  artist?: string;
  instruments?: string;

  // flexible structure (IMPORTANT)
  structure?: LyricSection[];

  userId?: string;
};

/**
 * Beat DNA Generator
 */
function buildBeatDNA(input: BuildInput, emotion: any) {
  return {
    tempo: input.bpm || emotion?.preferredBpm || "100-120",
    groove: emotion?.groove || "syncopated african swing",
    drumPattern: emotion?.drumPattern || "log drums + kick + snare + shakers",
    bounce: emotion?.bounce || "mid-energy rolling bounce",
    rhythmDensity: emotion?.density || "medium-high",
  };
}

/**
 * Artist DNA Generator
 */
function buildArtistDNA(memory: any, profile: any) {
  return {
    vocalStyle: profile?.vocalStyle || "melodic afrobeats vocal tone",
    delivery: profile?.delivery || "smooth rhythmic phrasing",
    accentuation: memory?.accent || "afro-influenced cadence",
    emotionRange: profile?.emotionRange || "warm to energetic",
  };
}

/**
 * Structure Compiler (KEY FEATURE)
 * Allows ANY arrangement order the user provides
 */
function buildStructure(structure?: LyricSection[]) {
  if (!structure || structure.length === 0) {
    return ["intro", "verse", "chorus", "verse", "chorus", "outro"];
  }

  return structure.map((s) => s.type);
}

/**
 * MAIN BRAIN FUNCTION
 */
export async function buildAfroMusePrompt(input: BuildInput) {
  // 1. Load context systems
  const [emotion, memory, profile] = await Promise.all([
    getEmotionProfile(input.mood),
    getMemory(input.userId || "default"),
    getUserStyleProfile(input.userId || "default"),
  ]);

  // 2. Build intelligence layers
  const beatDNA = buildBeatDNA(input, emotion);
  const artistDNA = buildArtistDNA(memory, profile);
  const structure = buildStructure(input.structure);

  // 3. Sound signature injection
  const signature = getSoundSignature(input.genre, input.mood);

  // 4. FINAL PROMPT COMPILATION (THIS IS WHAT MUSICGEN USES)
  const prompt = `
AfroMuse AI Composition Engine

Genre: ${input.genre}
Mood: ${input.mood}
Style Signature: ${signature.signature}

--- BEAT DNA ---
Tempo: ${beatDNA.tempo}
Groove: ${beatDNA.groove}
Drum Pattern: ${beatDNA.drumPattern}
Bounce: ${beatDNA.bounce}
Rhythm Density: ${beatDNA.rhythmDensity}

--- ARTIST DNA ---
Vocal Style: ${artistDNA.vocalStyle}
Delivery: ${artistDNA.delivery}
Accent: ${artistDNA.accentuation}
Emotion Range: ${artistDNA.emotionRange}

--- STRUCTURE MAP ---
${structure.join(" → ")}

--- PRODUCTION INSTRUCTION ---
Professional Afrobeat / Amapiano hybrid production
Radio-ready mix, wide stereo image, deep bass presence
`;

  return {
    prompt: prompt.trim(),
    beatDNA,
    artistDNA,
    structure,
    signature,
  };
}