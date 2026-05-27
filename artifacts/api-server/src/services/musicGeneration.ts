/**
 * AfroMuse Music Generation Service
 *
 * Responsibilities:
 *   - buildMusicPrompt()  — converts user input to a natural-language production brief
 *   - generateMusic()     — submits to AI Music API, polls until complete, returns result
 *
 * Two generation modes:
 *   Inspiration Mode — no lyrics → instrumental beat (make_instrumental: true)
 *   Custom Mode      — lyrics present → full song with AI vocals
 *
 * Polling: 6 s intervals, 40 max attempts (~4 minutes)
 * Callback: checks callbackStore on each iteration for early completion
 */

import { logger } from "../lib/logger.js";
import {
  buildInstrumentalDescription,
  buildLyricsText,
  type InstrumentalPayload,
} from "../engine/providers/instrumental.js";
import {
  registerTask,
  getCallbackResult,
  clearTask,
} from "../engine/callbackStore.js";

// ─── Payload Types ─────────────────────────────────────────────────────────────

export interface BeatDNA {
  bounceStyle?: string;
  melodyDensity?: string;
  drumCharacter?: string;
  hookLift?: string;
}

export interface ArtistDNA {
  vocalTexture?: string;
  singerStyle?: string;
  dialectDepth?: string;
}

export interface AudioStack {
  reverb?: number;
  eq?: number;
  compression?: number;
  stereoWidth?: number;
}

export interface MusicGenerationPayload {
  genre?: string;
  mood?: string;
  bpm?: number;
  key?: string;
  energy?: string;
  soundReference?: string;
  productionStyle?: string;
  title?: string;
  gender?: string;
  section?: string;

  lyrics?: {
    intro?: string[];
    verse1?: string[];
    chorus?: string[];
    verse2?: string[];
    bridge?: string[];
    outro?: string[];
  };

  aiMusicModel?: string;
  styleWeight?: number;
  weirdnessConstraint?: number;
  audioWeight?: number;
  negativeTags?: string;

  beatDNA?: BeatDNA;
  artistDNA?: ArtistDNA;
  audioStack?: AudioStack;
}

// ─── Result Types ──────────────────────────────────────────────────────────────

export interface MusicPromptResult {
  prompt: string;
  styleString: string;
}

export interface GeneratedTrack {
  audioUrl: string;
  title: string;
  coverArt?: string;
  trackIndex: number;
  tags?: string;
}

export interface MusicGenerationResult {
  tracks: GeneratedTrack[];
  audioUrl: string;
  title: string;
  coverArt?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const AI_MUSIC_API_BASE = "https://aimusicapi.org";
const MAX_ATTEMPTS = 40;
const POLL_INTERVAL_MS = 6_000;

// ─── Audio Stack Descriptor ────────────────────────────────────────────────────

function buildAudioStackHint(stack?: AudioStack): string {
  if (!stack) return "";
  const hints: string[] = [];
  if (stack.reverb !== undefined) {
    const r = stack.reverb;
    if (r < 25) hints.push("dry intimate sound");
    else if (r < 60) hints.push("moderate room reverb");
    else hints.push("lush spacious reverb");
  }
  if (stack.eq !== undefined) {
    const e = stack.eq;
    if (e < 30) hints.push("warm low-end focused EQ");
    else if (e < 70) hints.push("balanced EQ");
    else hints.push("bright airy high-end EQ");
  }
  if (stack.compression !== undefined) {
    const c = stack.compression;
    if (c < 30) hints.push("light natural dynamics");
    else if (c < 70) hints.push("moderate compression");
    else hints.push("punchy heavy compression");
  }
  if (stack.stereoWidth !== undefined) {
    const s = stack.stereoWidth;
    if (s < 30) hints.push("mono-focused center mix");
    else if (s < 70) hints.push("wide stereo field");
    else hints.push("ultra-wide panoramic stereo");
  }
  return hints.length ? ` Mix feel: ${hints.join(", ")}.` : "";
}

// ─── Beat DNA Descriptor ────────────────────────────────────────────────────────

function buildBeatDNAHint(dna?: BeatDNA): string {
  if (!dna) return "";
  const parts: string[] = [];
  if (dna.bounceStyle) parts.push(`${dna.bounceStyle} bounce`);
  if (dna.melodyDensity) parts.push(`${dna.melodyDensity} melody density`);
  if (dna.drumCharacter) parts.push(`${dna.drumCharacter} drums`);
  if (dna.hookLift) parts.push(`${dna.hookLift} hook energy`);
  return parts.length ? ` Beat DNA: ${parts.join(", ")}.` : "";
}

// ─── Artist DNA Descriptor ─────────────────────────────────────────────────────

function buildArtistDNAHint(dna?: ArtistDNA): string {
  if (!dna) return "";
  const parts: string[] = [];
  // Artist-name references intentionally omitted — the AI Music API rejects
  // copyrighted artist names. Style direction must be expressed in pure
  // descriptive terms (texture, dialect, energy, etc.).
  if (dna.vocalTexture) parts.push(`${dna.vocalTexture} vocal texture`);
  if (dna.singerStyle) parts.push(`${dna.singerStyle} singing style`);
  if (dna.dialectDepth) parts.push(`${dna.dialectDepth} dialect depth`);
  return parts.length ? ` Artist DNA: ${parts.join(", ")}.` : "";
}

// ─── Prompt Builder ────────────────────────────────────────────────────────────

export function buildMusicPrompt(payload: MusicGenerationPayload): MusicPromptResult {
  const instrumentalPayload: InstrumentalPayload = {
    genre: payload.genre,
    mood: payload.mood,
    bpm: payload.bpm,
    key: payload.key,
    energy: payload.energy,
    soundReference: payload.soundReference,
    productionStyle: payload.productionStyle,
    gender: payload.gender,
  };

  const { prompt: basePrompt, styleString } = buildInstrumentalDescription(instrumentalPayload);

  const beatHint = buildBeatDNAHint(payload.beatDNA);
  const artistHint = buildArtistDNAHint(payload.artistDNA);
  const stackHint = buildAudioStackHint(payload.audioStack);

  const prompt = basePrompt + beatHint + artistHint + stackHint;

  return { prompt, styleString };
}

// ─── Lyrics Formatter ─────────────────────────────────────────────────────────
// Delegates to the single source of truth in `engine/providers/instrumental.ts`,
// which accepts both `chorus` and `hook` field names and emits the canonical
// arrangement: Intro → Chorus → Verse 1 → Chorus → Verse 2 → Chorus → Bridge → Outro.

function formatLyricsText(lyrics: NonNullable<MusicGenerationPayload["lyrics"]>): string {
  return buildLyricsText({
    intro:  lyrics.intro,
    chorus: lyrics.chorus,
    verse1: lyrics.verse1,
    verse2: lyrics.verse2,
    bridge: lyrics.bridge,
    outro:  lyrics.outro,
  });
}

// ─── Core Generation Service ───────────────────────────────────────────────────

export async function generateMusic(
  payload: MusicGenerationPayload,
): Promise<MusicGenerationResult> {
  const apiKey = process.env.AI_MUSIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI_MUSIC_API_KEY environment variable is not configured");
  }

  const model = payload.aiMusicModel ?? process.env.AI_MUSIC_MODEL ?? "chirp-v4-5";

  const lyricsText = payload.lyrics ? formatLyricsText(payload.lyrics) : "";
  const hasLyrics = lyricsText.trim().length > 0;

  const { prompt, styleString } = buildMusicPrompt(payload);

  const callbackBase = process.env.CALLBACK_BASE_URL?.replace(/\/$/, "");
  const callbackUrl = callbackBase ? `${callbackBase}/api/music/callback` : null;

  let requestBody: Record<string, unknown>;

  if (hasLyrics) {
    requestBody = {
      model,
      prompt: lyricsText,
      style: styleString,
      title: payload.title ?? `${payload.genre ?? "Afrobeats"} Track`,
      make_instrumental: false,
      gender: payload.gender ?? "male",
      style_weight: payload.styleWeight ?? 0.8,
      weirdness_constraint: payload.weirdnessConstraint ?? 0.6,
      audio_weight: payload.audioWeight ?? 0.7,
      ...(payload.negativeTags && { negative_tags: payload.negativeTags }),
      ...(callbackUrl && { callback_url: callbackUrl }),
    };
  } else {
    requestBody = {
      model,
      gpt_description_prompt: prompt,
      make_instrumental: true,
      style_weight: payload.styleWeight ?? 0.5,
      weirdness_constraint: payload.weirdnessConstraint ?? 0.6,
      audio_weight: payload.audioWeight ?? 0.7,
      ...(payload.negativeTags && { negative_tags: payload.negativeTags }),
      ...(callbackUrl && { callback_url: callbackUrl }),
    };
  }

  logger.info(
    { genre: payload.genre, mood: payload.mood, model, hasLyrics },
    "Music generation starting",
  );

  // ── Step 1: Submit generation request ─────────────────────────────────────────
  const genRes = await fetch(`${AI_MUSIC_API_BASE}/api/v2/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(30_000),
  });

  if (!genRes.ok) {
    const errText = await genRes.text().catch(() => "");
    throw new Error(`AI Music API generation request failed (${genRes.status}): ${errText}`);
  }

  const genData = await genRes.json();
  const taskId: string | undefined = genData?.data?.task_id ?? genData?.workId;

  if (!taskId) {
    throw new Error("AI Music API did not return a task_id");
  }

  logger.info({ taskId, hasLyrics, model }, "Music generation job submitted");
  registerTask(taskId);

  // ── Step 2: Poll for completion ───────────────────────────────────────────────
  const pollUrl = `${AI_MUSIC_API_BASE}/api/feed?workId=${taskId}`;
  let allTracks: GeneratedTrack[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const cb = getCallbackResult(taskId);
    if (cb) {
      allTracks = [{
        audioUrl: cb.audioUrl,
        title: cb.title ?? payload.title ?? `${payload.genre ?? "Afrobeats"} Track`,
        coverArt: cb.imageUrl ?? undefined,
        trackIndex: 0,
      }];
      logger.info({ taskId, attempt }, "Music generation completed via callback");
      break;
    }

    try {
      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });

      if (pollRes.ok) {
        const data = await pollRes.json();
        const feedType: string = data?.data?.type ?? "";
        const tracks: any[] = Array.isArray(data?.data?.response_data)
          ? data.data.response_data
          : [];

        if (feedType === "ERROR") {
          clearTask(taskId);
          throw new Error("AI Music API reported generation failure");
        }

        if (feedType === "SUCCESS" || tracks.some((t) => t?.audio_url)) {
          const readyTracks = tracks.filter((t: any) => t?.audio_url);
          if (readyTracks.length > 0) {
            allTracks = readyTracks.map((t: any, idx: number) => ({
              audioUrl: t.audio_url ?? t.stream_audio_url,
              title: t.title ?? payload.title ?? `${payload.genre ?? "Afrobeats"} Track`,
              coverArt: t.image_url ?? t.image_large_url ?? undefined,
              trackIndex: idx,
              tags: Array.isArray(t.tags) ? t.tags.join(", ") : (t.tags ?? undefined),
            }));
            logger.info({ taskId, attempt, trackCount: allTracks.length }, "Music generation completed via poll");
            break;
          }
        }
      }
    } catch (err: any) {
      if (err?.message?.includes("AI Music API reported")) throw err;
      logger.warn({ err: err?.message, attempt, taskId }, "Poll attempt failed — will retry");
    }

    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  clearTask(taskId);

  if (allTracks.length === 0) {
    throw new Error("Music generation timed out — no audio returned after 4 minutes");
  }

  const primary = allTracks[0];
  const result: MusicGenerationResult = {
    tracks: allTracks,
    audioUrl: primary.audioUrl,
    title: primary.title,
    ...(primary.coverArt && { coverArt: primary.coverArt }),
  };

  logger.info({ taskId, trackCount: allTracks.length }, "Music generation complete");
  return result;
}
