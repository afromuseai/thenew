/**
 * AfroMuse Prompt Brain — Type definitions
 *
 * Single source of truth for the inputs every prompt-building call site uses.
 * Instrumental, vocal, and full-song generation all flow through `PromptInput`.
 */

export type GenerationMode = "instrumental" | "vocal" | "full-song";

export interface BeatDNA {
  bounceStyle?: string;
  melodyDensity?: string;
  drumCharacter?: string;
  hookLift?: string;
}

export interface ArtistDNA {
  referenceArtist?: string;
  vocalTexture?: string;
  singerStyle?: string;
  dialectDepth?: string;
}

export interface PromptInput {
  mode: GenerationMode;

  title?: string;
  style?: string;

  genre?: string;
  mood?: string;
  bpm?: string | number;
  key?: string;

  beatDNA?: BeatDNA;
  artistDNA?: ArtistDNA;
}

export type PromptMode =
  | "standard"
  | "artist-driven"
  | "beat-driven"
  | "lyric-driven"
  | "experimental"
  | "commercial-hit"
  | "cinematic";

export interface PromptInput {
  ...
  promptMode?: PromptMode;
}