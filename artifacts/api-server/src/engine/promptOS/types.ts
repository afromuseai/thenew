/**
 * AfroMuse Prompt OS — Core Types
 *
 * The PromptPacket is the OS-level representation of a generation request.
 * It carries the user inputs plus the OS control layer (`priority`, `styleLock`)
 * that the compiler and priority engine consume.
 */

export type Mode = "instrumental" | "vocal" | "full-song";

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

export interface PromptPacketInput {
  mode: Mode;
  title?: string;
  style?: string;
  genre?: string;
  mood?: string;
  bpm?: string | number;
  key?: string;
  beatDNA?: BeatDNA;
  artistDNA?: ArtistDNA;
}

export interface PromptPacket extends PromptPacketInput {
  // OS CONTROL LAYER
  priority: string[]; // execution order
  styleLock: number;  // 0–1 strength
}

export interface CompiledPrompt {
  prompt: string;
  meta: {
    styleLock: number;
    priority: string[];
  };
}
