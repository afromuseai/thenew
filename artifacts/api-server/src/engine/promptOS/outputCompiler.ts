/**
 * AfroMuse Prompt OS — Output Compiler
 *
 * Walks a single block id from the priority list and returns the rendered
 * prompt segment. Kept separate from compilePrompt so new block types
 * (e.g. LYRICS, REFERENCE_AUDIO) can be added without touching the OS core.
 */

import type { AssembledContext } from "./contextAssembler";

export function renderBlock(blockId: string, ctx: AssembledContext): string {
  switch (blockId) {
    case "STYLE":
      return `USER CREATIVE DIRECTION (ABSOLUTE PRIORITY):\n${ctx.identity.style}`;

    case "TITLE":
      return `TITLE: ${ctx.identity.title}`;

    case "GENRE":
      return `GENRE: ${ctx.music.genre}`;

    case "MOOD":
      return `MOOD: ${ctx.music.mood}`;

    case "BPM":
      return `BPM: ${ctx.music.bpm}`;

    case "KEY":
      return `KEY: ${ctx.music.key}`;

    case "BEAT_DNA":
      return ctx.dna.beat
        ? `BEAT DNA: ${JSON.stringify(ctx.dna.beat)}`
        : "";

    case "ARTIST_DNA":
      return ctx.dna.artist
        ? `ARTIST DNA: ${JSON.stringify(ctx.dna.artist)}`
        : "";

    case "MODE":
      return ctx.mode === "instrumental"
        ? "OUTPUT: Instrumental only. No vocals."
        : ctx.mode === "vocal"
          ? "OUTPUT: Full vocal performance."
          : "OUTPUT: Full song with vocals + instrumental.";

    default:
      return "";
  }
}
