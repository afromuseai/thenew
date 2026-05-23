/**
 * AfroMuse Prompt OS — Context Assembler
 *
 * Normalises a PromptPacket into a structured context object the
 * compiler walks block-by-block. Default values are applied here so the
 * compiler never has to reason about missing fields.
 */

import type { PromptPacket } from "./types";

export interface AssembledContext {
  identity: { title: string; style: string };
  music:    { genre: string; mood: string; bpm: string; key: string };
  dna:      { beat: PromptPacket["beatDNA"]; artist: PromptPacket["artistDNA"] };
  mode:     PromptPacket["mode"];
}

export function assembleContext(packet: PromptPacket): AssembledContext {
  return {
    identity: {
      title: packet.title?.trim() || "Untitled Track",
      style: packet.style?.trim() || "No specific direction provided",
    },

    music: {
      genre: packet.genre?.trim() || "Unknown",
      mood:  packet.mood?.trim()  || "Neutral",
      bpm:   packet.bpm !== undefined && packet.bpm !== null && packet.bpm !== "" ? String(packet.bpm) : "Auto",
      key:   packet.key?.trim()   || "Auto",
    },

    dna: {
      beat:   packet.beatDNA,
      artist: packet.artistDNA,
    },

    mode: packet.mode,
  };
}
