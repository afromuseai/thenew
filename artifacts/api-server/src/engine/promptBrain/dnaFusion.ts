/**
 * AfroMuse Prompt Brain — DNA Fusion
 *
 * Merges Beat DNA and Artist DNA into coherent prompt blocks.
 * Returns formatted strings ready to drop into the assembled prompt
 * and a fused descriptor used in style tag strings.
 */

import type { BeatDNA, ArtistDNA } from "./types";

export interface FusedDNA {
  /** Multi-line "BEAT DNA: …" block, or empty if no usable signal. */
  beatBlock: string;
  /** Multi-line "ARTIST DNA: …" block, or empty if no usable signal. */
  artistBlock: string;
  /** Comma-separated tag-style fusion line for inclusion in style strings. */
  fusedTagLine: string;
}

function pickDefined(...vals: (string | undefined)[]): string[] {
  return vals.map((v) => (v ?? "").trim()).filter(Boolean);
}

export function fuseDNA(beat?: BeatDNA, artist?: ArtistDNA): FusedDNA {
  const beatParts = beat
    ? pickDefined(beat.bounceStyle, beat.melodyDensity, beat.drumCharacter, beat.hookLift)
    : [];

  const artistParts = artist
    ? pickDefined(artist.referenceArtist, artist.vocalTexture, artist.singerStyle, artist.dialectDepth)
    : [];

  const beatBlock = beat && beatParts.length
    ? [
        "BEAT DNA:",
        `- Bounce: ${beat.bounceStyle || "default"}`,
        `- Melody Density: ${beat.melodyDensity || "default"}`,
        `- Drum Character: ${beat.drumCharacter || "default"}`,
        `- Hook Lift: ${beat.hookLift || "default"}`,
      ].join("\n")
    : "";

  const artistBlock = artist && artistParts.length
    ? [
        "ARTIST DNA:",
        `- Reference Artist: ${artist.referenceArtist || "none"}`,
        `- Vocal Texture: ${artist.vocalTexture || "natural"}`,
        `- Singer Style: ${artist.singerStyle || "standard"}`,
        `- Dialect Depth: ${artist.dialectDepth || "light"}`,
      ].join("\n")
    : "";

  const fusedTagLine = [...beatParts, ...artistParts].join(", ");

  return { beatBlock, artistBlock, fusedTagLine };
}
