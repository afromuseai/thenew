/**
 * GenerateMusic — Full production music generation UI
 *
 * Features:
 *   - Instrumental / Full Song mode
 *   - All AI Music API controls: genre, mood, BPM, key, energy, gender, model
 *   - Beat DNA panel (bounce, melody density, drum character, hook lift)
 *   - Artist DNA panel (reference artist, vocal texture, singer style, dialect depth)
 *   - Audio Stack sliders (reverb, EQ, compression, stereo width)
 *   - Advanced controls (style weight, weirdness, audio weight, negative tags)
 *   - Multi-track result display (Track A / Track B)
 *   - MP3 download buttons
 *   - Usage limit awareness
 */

import { useState, useRef, useEffect } from "react";
import {
  Loader2, Music2, Mic2, Play, Pause, Download, RefreshCw,
  ChevronDown, ChevronUp, Dna, Sliders, Radio, Crown, Lock,
  Zap, Sparkles, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePlan } from "@/context/PlanContext";
import { getStoredToken } from "@/context/AuthContext";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LyricsSections {
  intro: string;
  verse1: string;
  chorus: string;
  verse2: string;
  bridge: string;
  outro: string;
}

interface BeatDNA {
  bounceStyle: string;
  melodyDensity: string;
  drumCharacter: string;
  hookLift: string;
}

interface ArtistDNA {
  referenceArtist: string;
  vocalTexture: string;
  singerStyle: string;
  dialectDepth: string;
}

interface AudioStack {
  reverb: number;
  eq: number;
  compression: number;
  stereoWidth: number;
}

interface GeneratedTrack {
  audioUrl: string;
  title: string;
  coverArt?: string;
  trackIndex: number;
  tags?: string;
}

interface GenerationResult {
  tracks: GeneratedTrack[];
  audioUrl: string;
  title: string;
  coverArt?: string;
}

interface EngineSpec {
  caption: string;
  key_scale: string;
  bpm: number;
  duration: number;
  genre: string;
  mood: string;
  artist_dna: string;
  beat_dna: string;
}

interface EngineResult {
  status: string;
  audio_url: string;
  spec: EngineSpec;
}

type EngineChoice = "cloud" | "afromuse";

interface UsageInfo {
  used: number;
  limit: number;
  period: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const GENRES = [
  "Afrobeats", "Afropop", "Amapiano", "Afro-fusion", "Dancehall",
  "R&B", "Street Anthem", "Spiritual", "Gospel", "Rap", "UK Drill",
  "Trap", "Hip-Hop", "Reggae", "Hyperpop",
];

const MOODS = [
  "Uplifting", "Romantic", "Energetic", "Confident",
  "Sad", "Spiritual", "Playful", "Aggressive", "Chill",
];

const ENERGY_LEVELS = ["Low", "Mid", "High"];

const MUSICAL_KEYS = [
  "C Major", "C Minor", "D Major", "D Minor", "E♭ Major", "E Minor",
  "F Major", "F Minor", "F♯ Minor", "G Major", "G Minor",
  "A♭ Major", "A Major", "A Minor", "B♭ Major", "B Minor",
];

const GENDERS = ["male", "female", "mixed", "random"];

const BOUNCE_STYLES = ["Laid-back", "On the beat", "Slightly ahead", "Syncopated"];
const MELODY_DENSITIES = ["Sparse", "Moderate", "Dense", "Intricate"];
const DRUM_CHARACTERS = ["Heavy", "Clean", "Punchy", "Swung", "Trap", "Live-feel"];
const HOOK_LIFTS = ["Slow-burn", "Instant", "Building", "Drop-out"];

const VOCAL_TEXTURES = ["Warm", "Bright", "Breathier", "Raspy", "Powerful"];
const SINGER_STYLES = ["Afrobeat", "Ballad", "Street Anthem", "Gospel", "Pop"];
const DIALECT_DEPTHS = ["Light", "Medium", "Deep"];

const MODELS_BY_PLAN: Record<string, { value: string; label: string; planRequired?: string }[]> = {
  free:          [{ value: "chirp-v4-5", label: "chirp-v4-5" }],
  "creator-pro": [
    { value: "chirp-v4-5", label: "chirp-v4-5" },
    { value: "chirp-v5",   label: "chirp-v5 (Pro)" },
  ],
  "artist-pro":  [
    { value: "chirp-v4-5",      label: "chirp-v4-5" },
    { value: "chirp-v4-5-plus", label: "chirp-v4-5-plus (Artist)" },
    { value: "chirp-v5",        label: "chirp-v5 (Pro)" },
    { value: "chirp-v4-0",      label: "chirp-v4-0 (Artist)" },
  ],
};

const LOADING_MESSAGES = [
  "Analyzing your creative direction…",
  "Composing melody and chord progressions…",
  "Building drum patterns…",
  "Crafting bass lines and grooves…",
  "Shaping the arrangement…",
  "Layering instruments…",
  "Polishing the mix…",
  "Adding final touches…",
  "Almost there…",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function splitToLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SelectField({
  label, value, onChange, options, disabled, className = "",
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: (string | { value: string; label: string })[]; disabled: boolean; className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
                   disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
      >
        <option value="">Select {label}</option>
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const lbl = typeof o === "string" ? o : o.label;
          return <option key={val} value={val}>{lbl}</option>;
        })}
      </select>
    </div>
  );
}

function InputField({
  label, value, onChange, placeholder, type = "text", disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm
                   placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500
                   focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function TextAreaField({
  label, value, onChange, placeholder, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-violet-400 uppercase tracking-wider">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        className="bg-zinc-900/60 border border-violet-900/40 text-white rounded-lg px-3 py-2.5 text-sm
                   placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500
                   focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none
                   font-mono leading-relaxed"
      />
    </div>
  );
}

function SliderField({
  label, value, onChange, min = 0, max = 100, disabled, hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; disabled: boolean; hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
        <span className="text-xs text-violet-400 font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full accent-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {hint && <p className="text-xs text-zinc-600">{hint}</p>}
    </div>
  );
}

function PillSelector({
  label, value, onChange, options, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? "" : opt)}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${value === opt
                ? "bg-violet-600 border-violet-500 text-white"
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function EnergySelector({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Energy</label>
      <div className="flex gap-2">
        {ENERGY_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            disabled={disabled}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border
              ${value === level
                ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/40"
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionToggle({
  label, icon, isOpen, onToggle, badge,
}: {
  label: string; icon: React.ReactNode; isOpen: boolean; onToggle: () => void; badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-violet-950 border border-violet-800/50 flex items-center justify-center text-violet-400">
          {icon}
        </div>
        <span className="text-sm font-semibold text-white">{label}</span>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-medium">
            {badge}
          </span>
        )}
      </div>
      {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
    </button>
  );
}

function LoadingDisplay({ messageIndex }: { messageIndex: number }) {
  return (
    <div className="flex flex-col items-center gap-6 py-10">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-4 border-zinc-800 flex items-center justify-center">
          <Music2 className="w-8 h-8 text-violet-400" />
        </div>
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500 animate-spin" />
      </div>
      <div className="text-center space-y-1.5">
        <p className="text-white font-semibold text-lg">Generating your track…</p>
        <p className="text-violet-400 text-sm animate-pulse">
          {LOADING_MESSAGES[messageIndex % LOADING_MESSAGES.length]}
        </p>
      </div>
      <div className="w-full max-w-xs space-y-2">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>AI Music Engine</span>
          <span>Processing</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(95, ((messageIndex + 1) / LOADING_MESSAGES.length) * 100)}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-zinc-600 text-center max-w-xs">
        This typically takes 1–3 minutes. Do not close this tab.
      </p>
    </div>
  );
}

function TrackCard({
  track, label, isPlaying, onTogglePlay,
}: {
  track: GeneratedTrack; label: string; isPlaying: boolean; onTogglePlay: () => void;
}) {
  function handleDownload() {
    const a = document.createElement("a");
    a.href = track.audioUrl;
    a.download = `${track.title.replace(/[^a-zA-Z0-9\s]/g, "").trim() || "afromuse_track"}.mp3`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {track.coverArt ? (
            <img src={track.coverArt} alt={track.title}
              className="w-14 h-14 rounded-lg object-cover ring-1 ring-white/10" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-violet-900/60 to-fuchsia-900/60 flex items-center justify-center">
              <Music2 className="w-6 h-6 text-violet-400/60" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">{label}</span>
            </div>
            <p className="text-sm font-semibold text-white mt-0.5 line-clamp-1">{track.title}</p>
            {track.tags && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{track.tags}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className="w-9 h-9 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-all shadow-md shadow-violet-900/40"
          >
            {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
          </button>
          <button
            onClick={handleDownload}
            className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center transition-all"
          >
            <Download className="w-4 h-4 text-zinc-300" />
          </button>
        </div>
      </div>
      <audio
        src={track.audioUrl}
        controls
        className="w-full rounded-lg"
        style={{ colorScheme: "dark" }}
      />
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-zinc-800/70 border border-zinc-700/60 text-zinc-300">
      {children}
    </span>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function GenerateMusic() {
  const { user } = useAuth();
  const { planId, plan } = usePlan();

  // Core state
  const [genre, setGenre] = useState("");
  const [mood, setMood] = useState("");
  const [bpm, setBpm] = useState("");
  const [key, setKey] = useState("");
  const [energy, setEnergy] = useState("Mid");
  const [gender, setGender] = useState("male");
  const [aiModel, setAiModel] = useState("chirp-v4-5");
  const [soundReference, setSoundReference] = useState("");
  const [productionStyle, setProductionStyle] = useState("");
  const [mode, setMode] = useState<"instrumental" | "full-song">("instrumental");
  const [isPreview, setIsPreview] = useState(true);

  // Lyrics
  const [lyrics, setLyrics] = useState<LyricsSections>({
    intro: "", verse1: "", chorus: "", verse2: "", bridge: "", outro: "",
  });

  // Beat DNA
  const [beatDNA, setBeatDNA] = useState<BeatDNA>({
    bounceStyle: "", melodyDensity: "", drumCharacter: "", hookLift: "",
  });

  // Artist DNA
  const [artistDNA, setArtistDNA] = useState<ArtistDNA>({
    referenceArtist: "", vocalTexture: "", singerStyle: "", dialectDepth: "",
  });

  // Audio Stack
  const [audioStack, setAudioStack] = useState<AudioStack>({
    reverb: 40, eq: 50, compression: 50, stereoWidth: 60,
  });

  // Advanced
  const [styleWeight, setStyleWeight] = useState(0.8);
  const [weirdness, setWeirdness] = useState(0.6);
  const [audioWeight, setAudioWeight] = useState(0.7);
  const [negativeTags, setNegativeTags] = useState("");

  // UI toggles
  const [showBeatDNA, setShowBeatDNA] = useState(false);
  const [showArtistDNA, setShowArtistDNA] = useState(false);
  const [showAudioStack, setShowAudioStack] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Engine selector + AfroMuse-engine-only prompt field
  const [engine, setEngine] = useState<EngineChoice>("afromuse");
  const [prompt, setPrompt] = useState("");

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [engineResult, setEngineResult] = useState<EngineResult | null>(null);
  const [showDebugView, setShowDebugView] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [playingTrack, setPlayingTrack] = useState<number | null>(null);

  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const availableModels = MODELS_BY_PLAN[planId] ?? MODELS_BY_PLAN["free"];
  const canUseArtistDNA = planId === "artist-pro";
  const canUseBeatDNA = planId !== "free";

  // Fetch usage on mount
function joinTruthy(parts: Array<string | undefined | null>, sep = ", "): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(sep);
}

async function handleGenerate(e: React.FormEvent) {
  e.preventDefault();

  setIsLoading(true);
  setError(null);
  setResult(null);
  setEngineResult(null);

  // ── Branch A: AfroMuse Engine (Python FastAPI) ──────────────────────────────
  if (engine === "afromuse") {
    const composedPrompt =
      prompt.trim() ||
      joinTruthy([genre, mood, soundReference, productionStyle], " ").trim();
    const composedArtistDna = joinTruthy([
      artistDNA.referenceArtist,
      artistDNA.vocalTexture,
      artistDNA.singerStyle,
      artistDNA.dialectDepth,
    ]);
    const composedBeatDna = joinTruthy([
      beatDNA.bounceStyle,
      beatDNA.melodyDensity,
      beatDNA.drumCharacter,
      beatDNA.hookLift,
    ]);

    const enginePayload = {
      prompt: composedPrompt,
      key,
      bpm: Number(bpm),
      mood,
      artist_dna: composedArtistDna,
      beat_dna: composedBeatDna,
    };

    console.log("AfroMuse Payload:", enginePayload);

    if (!enginePayload.prompt) {
      setError("Prompt is required for the AfroMuse Engine.");
      setIsLoading(false);
      return;
    }
    if (!enginePayload.key) {
      setError("Key and BPM are required for music generation");
      setIsLoading(false);
      return;
    }
    if (!enginePayload.bpm || Number.isNaN(enginePayload.bpm)) {
      setError("Key and BPM are required for music generation");
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/engine-api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enginePayload),
      });

      if (!res.ok) {
        let message = `Request failed with status ${res.status}`;
        try {
          const body = await res.json();
          if (typeof body?.detail === "string") {
            message = body.detail;
          } else if (Array.isArray(body?.detail)) {
            message =
              body.detail
                .map((d: { msg?: string }) => d.msg)
                .filter(Boolean)
                .join(", ") || message;
          }
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }

      const data = (await res.json()) as EngineResult;
      setEngineResult(data);
    } catch (err: any) {
      setError(err?.message ?? "AfroMuse Engine request failed.");
    } finally {
      setIsLoading(false);
    }
    return;
  }

  // ── Branch B: AfroMuse Cloud (existing /api/music/generate pipeline) ───────
  const token = getStoredToken();

    const payload = {
      genre,
      mood,
      bpm,
      key,
      energy,
      gender,
      aiModel,
      mode,

      // ✅ ADD THIS
      duration: isPreview ? 30 : 180,
      preview: isPreview,

    beatDNA,
    artistDNA,
    audioStack,

    styleWeight,
    weirdness,
    audioWeight,
    negativeTags,

    lyrics,
  };

  try {
    const res = await fetch("/api/music/generate", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (res.status === 429 || json.limitReached) {
      setError(json.error ?? "Generation limit reached.");
      return;
    }

    if (!res.ok || !json.success) {
      throw new Error(json.error ?? "Request failed");
    }

    const data = json.data;

    if (!data.tracks || data.tracks.length === 0) {
      data.tracks = [
        {
          audioUrl: data.audioUrl,
          title: data.title,
          trackIndex: 0,
        },
      ];
    }

    setResult(data);

  } catch (err: any) {
    setError(err?.message ?? "Generation failed.");
  } finally {
    setIsLoading(false);
  }
}

  const usageLimitReached = usage ? usage.used >= usage.limit : false;
  const isDisabled = isLoading || !!result || !!engineResult;
  const canGenerate =
    engine === "afromuse"
      ? !isLoading
      : !!genre && !!mood && !isLoading && !usageLimitReached;

  function reset() {
    setResult(null);
    setEngineResult(null);
    setError(null);
    setShowDebugView(false);
    setPlayingTrack(null);
  }

  // ── AfroMuse Engine Result View ─────────────────────────────────────────────
  if (engineResult) {
    return (
      <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            AfroMuse Engine — {engineResult.status}
          </h2>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New track
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
              Caption
            </p>
            <p className="text-white font-medium">{engineResult.spec.caption}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Tag>{engineResult.spec.genre}</Tag>
              <Tag>Key: {engineResult.spec.key_scale}</Tag>
              <Tag>{engineResult.spec.bpm} BPM</Tag>
              {engineResult.spec.mood && <Tag>Mood: {engineResult.spec.mood}</Tag>}
              <Tag>{engineResult.spec.duration}s</Tag>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
              Audio
            </p>
            {engineResult.audio_url ? (
              <>
                <audio
                  src={engineResult.audio_url}
                  controls
                  className="w-full rounded-lg"
                  style={{ colorScheme: "dark" }}
                />
                <p className="mt-2 text-xs text-zinc-500 break-all">
                  <a
                    href={engineResult.audio_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-violet-400 underline"
                  >
                    {engineResult.audio_url}
                  </a>
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">No audio yet</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40">
            <button
              type="button"
              onClick={() => setShowDebugView((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-zinc-300 hover:text-white transition-colors"
            >
              <span className="font-medium">Debug View</span>
              {showDebugView ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {showDebugView && (
              <pre className="px-4 pb-4 text-xs text-zinc-400 overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(engineResult.spec, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Result View ──────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            {result.tracks.length > 1 ? `${result.tracks.length} Tracks Generated` : "Track Ready"}
          </h2>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            New track
          </button>
        </div>

        <div className="p-5 space-y-4">
          {result.tracks.map((track, idx) => (
            <TrackCard
              key={idx}
              track={track}
              label={result.tracks.length > 1 ? `Track ${String.fromCharCode(65 + idx)}` : "Your Track"}
              isPlaying={playingTrack === idx}
              onTogglePlay={() => setPlayingTrack(playingTrack === idx ? null : idx)}
            />
          ))}

          {usage && (
            <p className="text-xs text-zinc-500 text-center">
              {usage.limit === Infinity
                ? `${usage.used} generations used this month — unlimited plan`
                : `${usage.used}/${usage.limit} generations used ${usage.period === "all-time" ? "lifetime" : "this month"}`}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Form View ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-zinc-800 bg-gradient-to-r from-violet-950/30 to-fuchsia-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
              <Music2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Generate Music</h2>
              <p className="text-xs text-zinc-500">AI-powered Afro-inspired music generation</p>
            </div>
          </div>
          {usage && (
            <div className="text-right">
              <p className="text-xs text-zinc-500">
                {usage.limit === Infinity
                  ? `${usage.used} used`
                  : `${usage.used}/${usage.limit}`}
              </p>
              <p className="text-xs text-zinc-600">
                {usage.period === "all-time" ? "lifetime" : "this month"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="p-6">
          <LoadingDisplay messageIndex={loadingMsgIndex} />
        </div>
      )}

      {/* Usage limit reached */}
      {!isLoading && usageLimitReached && (
        <div className="m-5 bg-amber-950/30 border border-amber-700/40 rounded-xl px-4 py-4 flex items-start gap-3">
          <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Generation limit reached</p>
            <p className="text-xs text-amber-400/70 mt-1">
              {plan === "Free"
                ? "Free accounts get 1 lifetime generation. Upgrade to Creator Pro for 50/month."
                : `You've used all ${usage?.limit} generations for this month.`}
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      {!isLoading && (
        <form onSubmit={handleGenerate} className="p-5 space-y-5">
          {/* Engine Selector */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-2">
              Generation Engine
            </label>
            <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
              {(
                [
                  { value: "afromuse", label: "AfroMuse Engine" },
                  { value: "cloud", label: "AfroMuse Cloud" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEngine(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                    ${
                      engine === opt.value
                        ? "bg-violet-600 text-white shadow-md shadow-violet-900/40"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {engine === "afromuse" && (
              <p className="text-xs text-zinc-500 mt-2">
                Sends your inputs to the local Python engine. Returns a structured
                spec + audio URL.
              </p>
            )}
          </div>

          {/* Prompt (used by the AfroMuse Engine) */}
          {engine === "afromuse" && (
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-500 mb-2">
                Prompt <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Lagos sunset drive, smooth amapiano with log drums…"
                disabled={isDisabled}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-600 transition-colors disabled:opacity-60"
              />
            </div>
          )}

          {/* Mode Toggle */}
          <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
            <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 border border-zinc-800 mt-2">
              {[
                { label: "Preview (30s)", value: true },
                { label: "Full Track", value: false },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setIsPreview(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all
                    ${isPreview === opt.value
                      ? "bg-violet-600 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {(["instrumental", "full-song"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${mode === m
                    ? "bg-violet-600 text-white shadow-md shadow-violet-900/40"
                    : "text-zinc-500 hover:text-zinc-300"
                  }`}
              >
                {m === "instrumental" ? <Music2 className="w-4 h-4" /> : <Mic2 className="w-4 h-4" />}
                {m === "instrumental" ? "Instrumental" : "Full Song"}
              </button>
            ))}
          </div>

          {/* Core Fields Row 1 */}
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Genre *" value={genre} onChange={setGenre} options={GENRES} disabled={isDisabled} />
            <SelectField label="Mood *" value={mood} onChange={setMood} options={MOODS} disabled={isDisabled} />
          </div>

          <EnergySelector value={energy} onChange={setEnergy} disabled={isDisabled} />

          {/* Core Fields Row 2 */}
          <div className="grid grid-cols-2 gap-4">
            <InputField label="BPM (optional)" value={bpm} onChange={setBpm} placeholder="e.g. 98" type="number" disabled={isDisabled} />
            <SelectField label="Key (optional)" value={key} onChange={setKey} options={MUSICAL_KEYS} disabled={isDisabled} />
          </div>

          {/* Gender + Model */}
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Vocal Gender" value={gender} onChange={setGender} options={GENDERS} disabled={isDisabled} />
            <SelectField
              label="AI Model"
              value={aiModel}
              onChange={setAiModel}
              options={availableModels}
              disabled={isDisabled}
            />
          </div>

          <InputField
            label="Sound Reference (optional)"
            value={soundReference}
            onChange={setSoundReference}
            placeholder="e.g. Wizkid, Burna Boy, Tems…"
            disabled={isDisabled}
          />

          {/* ── Beat DNA ────────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <SectionToggle
              label="Beat DNA"
              icon={<Radio className="w-3.5 h-3.5" />}
              isOpen={showBeatDNA}
              onToggle={() => setShowBeatDNA((v) => !v)}
              badge={canUseBeatDNA ? undefined : "Pro"}
            />
            {showBeatDNA && (
              <div className={`space-y-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 ${!canUseBeatDNA ? "opacity-60 pointer-events-none" : ""}`}>
                {!canUseBeatDNA && (
                  <div className="flex items-center gap-2 text-xs text-amber-400">
                    <Lock className="w-3.5 h-3.5" />
                    Beat DNA requires Creator Pro or Artist Pro
                  </div>
                )}
                <PillSelector label="Bounce Style" value={beatDNA.bounceStyle} onChange={(v) => setBeatDNA((d) => ({ ...d, bounceStyle: v }))} options={BOUNCE_STYLES} disabled={isDisabled || !canUseBeatDNA} />
                <PillSelector label="Melody Density" value={beatDNA.melodyDensity} onChange={(v) => setBeatDNA((d) => ({ ...d, melodyDensity: v }))} options={MELODY_DENSITIES} disabled={isDisabled || !canUseBeatDNA} />
                <PillSelector label="Drum Character" value={beatDNA.drumCharacter} onChange={(v) => setBeatDNA((d) => ({ ...d, drumCharacter: v }))} options={DRUM_CHARACTERS} disabled={isDisabled || !canUseBeatDNA} />
                <PillSelector label="Hook Lift" value={beatDNA.hookLift} onChange={(v) => setBeatDNA((d) => ({ ...d, hookLift: v }))} options={HOOK_LIFTS} disabled={isDisabled || !canUseBeatDNA} />
              </div>
            )}
          </div>

          {/* ── Artist DNA ──────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <SectionToggle
              label="Artist DNA"
              icon={<Dna className="w-3.5 h-3.5" />}
              isOpen={showArtistDNA}
              onToggle={() => setShowArtistDNA((v) => !v)}
              badge="Artist Pro"
            />
            {showArtistDNA && (
              <div className={`space-y-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 ${!canUseArtistDNA ? "opacity-60 pointer-events-none" : ""}`}>
                {!canUseArtistDNA && (
                  <div className="flex items-center gap-2 text-xs text-amber-400">
                    <Lock className="w-3.5 h-3.5" />
                    Artist DNA requires Artist Pro plan
                  </div>
                )}
                <InputField label="Reference Artist" value={artistDNA.referenceArtist} onChange={(v) => setArtistDNA((d) => ({ ...d, referenceArtist: v }))} placeholder="e.g. Burna Boy, Wizkid…" disabled={isDisabled || !canUseArtistDNA} />
                <PillSelector label="Vocal Texture" value={artistDNA.vocalTexture} onChange={(v) => setArtistDNA((d) => ({ ...d, vocalTexture: v }))} options={VOCAL_TEXTURES} disabled={isDisabled || !canUseArtistDNA} />
                <PillSelector label="Singer Style" value={artistDNA.singerStyle} onChange={(v) => setArtistDNA((d) => ({ ...d, singerStyle: v }))} options={SINGER_STYLES} disabled={isDisabled || !canUseArtistDNA} />
                <PillSelector label="Dialect Depth" value={artistDNA.dialectDepth} onChange={(v) => setArtistDNA((d) => ({ ...d, dialectDepth: v }))} options={DIALECT_DEPTHS} disabled={isDisabled || !canUseArtistDNA} />
              </div>
            )}
          </div>

          {/* ── Audio Stack ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <SectionToggle
              label="Audio Stack"
              icon={<Sliders className="w-3.5 h-3.5" />}
              isOpen={showAudioStack}
              onToggle={() => setShowAudioStack((v) => !v)}
            />
            {showAudioStack && (
              <div className="space-y-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
                <SliderField label="Reverb" value={audioStack.reverb} onChange={(v) => setAudioStack((s) => ({ ...s, reverb: v }))} disabled={isDisabled} hint="Low: dry · High: spacious" />
                <SliderField label="EQ" value={audioStack.eq} onChange={(v) => setAudioStack((s) => ({ ...s, eq: v }))} disabled={isDisabled} hint="Low: warm/dark · High: bright/airy" />
                <SliderField label="Compression" value={audioStack.compression} onChange={(v) => setAudioStack((s) => ({ ...s, compression: v }))} disabled={isDisabled} hint="Low: natural · High: punchy/heavy" />
                <SliderField label="Stereo Width" value={audioStack.stereoWidth} onChange={(v) => setAudioStack((s) => ({ ...s, stereoWidth: v }))} disabled={isDisabled} hint="Low: mono · High: panoramic" />
              </div>
            )}
          </div>

          {/* ── Advanced Controls ────────────────────────────────────────────── */}
          <div className="space-y-3">
            <SectionToggle
              label="Advanced Controls"
              icon={<Zap className="w-3.5 h-3.5" />}
              isOpen={showAdvanced}
              onToggle={() => setShowAdvanced((v) => !v)}
            />
            {showAdvanced && (
              <div className="space-y-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
                <InputField label="Production Style" value={productionStyle} onChange={setProductionStyle} placeholder="e.g. 808 bass, vintage samples, trap hi-hats…" disabled={isDisabled} />
                <SliderField
                  label={`Style Weight (${styleWeight.toFixed(2)})`}
                  value={Math.round(styleWeight * 100)}
                  onChange={(v) => setStyleWeight(v / 100)}
                  disabled={isDisabled}
                  hint="How strongly to apply style tags"
                />
                <SliderField
                  label={`Weirdness (${weirdness.toFixed(2)})`}
                  value={Math.round(weirdness * 100)}
                  onChange={(v) => setWeirdness(v / 100)}
                  disabled={isDisabled}
                  hint="Higher = more experimental output"
                />
                <SliderField
                  label={`Audio Weight (${audioWeight.toFixed(2)})`}
                  value={Math.round(audioWeight * 100)}
                  onChange={(v) => setAudioWeight(v / 100)}
                  disabled={isDisabled}
                  hint="Influence of audio style on generation"
                />
                <InputField label="Negative Tags (optional)" value={negativeTags} onChange={setNegativeTags} placeholder="e.g. distortion, noise, off-key…" disabled={isDisabled} />
              </div>
            )}
          </div>

          {/* ── Lyrics Editor (Full Song only) ───────────────────────────────── */}
          {mode === "full-song" && (
            <div className="space-y-4 pt-2 border-t border-zinc-800/60">
              <div className="flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-white">Lyrics Editor</span>
                <span className="text-xs text-zinc-500 ml-1">— one line per row</span>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {(["intro", "verse1", "chorus", "verse2", "bridge", "outro"] as const).map((section) => (
                  <TextAreaField
                    key={section}
                    label={section === "verse1" ? "Verse 1" : section === "verse2" ? "Verse 2" : section.charAt(0).toUpperCase() + section.slice(1)}
                    value={lyrics[section]}
                    onChange={(v) => setLyrics((l) => ({ ...l, [section]: v }))}
                    placeholder={`${section} lines…`}
                    disabled={isDisabled}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Generate Button */}
          <button
            type="submit"
            disabled={!canGenerate}
            className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-base
              transition-all shadow-lg
              ${canGenerate
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-violet-900/40 cursor-pointer"
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none"
              }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                {isPreview ? "Generate Preview" : "Generate Full Track"}
              </>
            )}
          </button>

          {usage && !usageLimitReached && (
            <p className="text-xs text-zinc-600 text-center">
              {usage.limit === Infinity
                ? "Unlimited generations"
                : `${usage.limit - usage.used} generation${usage.limit - usage.used !== 1 ? "s" : ""} remaining ${usage.period === "all-time" ? "lifetime" : "this month"}`}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
