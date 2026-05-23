import { PromptInput } from "../promptBrain/types";

export function buildContext(input: PromptInput) {
  return {
    hasArtistDNA: !!input.artistDNA?.referenceArtist,
    hasBeatDNA: Object.values(input.beatDNA || {}).some(Boolean),
    hasLyrics: Object.values(input.lyrics || {}).some((v) => v?.length > 0),
    hasStrongStyle: (input.styleWeight ?? 0) > 0.7,
    isExperimental: (input.weirdness ?? 0) > 0.7,
  };
}