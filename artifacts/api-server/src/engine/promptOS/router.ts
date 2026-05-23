import { PromptInput } from "../promptBrain/types";
import { buildContext } from "./contextBuilder";

export function resolvePromptMode(input: PromptInput) {
  const ctx = buildContext(input);

  if (ctx.isExperimental) return "experimental";
  if (ctx.hasArtistDNA && ctx.hasBeatDNA) return "commercial-hit";
  if (ctx.hasArtistDNA) return "artist-driven";
  if (ctx.hasBeatDNA) return "beat-driven";
  if (ctx.hasLyrics) return "lyric-driven";

  return "standard";
}