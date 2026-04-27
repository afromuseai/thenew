export interface MusicGenInput {
  prompt: string;
  mode: string;
}

export interface MusicGenOutput {
  id?: string;
  prompt: string;
  mode: string;
  status: "pending" | "generated";
  audioUrl: string | null;
}

export async function runMusicGen(input: MusicGenInput): Promise<MusicGenOutput> {
  return {
    prompt: input.prompt,
    mode: input.mode,
    status: "generated",
    audioUrl: null,
  };
}
