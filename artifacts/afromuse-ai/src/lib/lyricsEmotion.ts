/**
 * AfroMuse — Lyrics Emotion Intelligence Layer
 *
 * Pure, additive intelligence layer that infers an emotional tag for each
 * lyric section *without* modifying structure, ordering, section count,
 * or the lyric content itself.
 *
 * Rules enforced (per the product spec):
 *   - Do NOT add or remove sections.
 *   - Do NOT reorder anything.
 *   - Only assign / refine an emotional tag per existing section.
 *   - Chorus emotion is the strongest, most memorable.
 *   - Verses support narrative clarity.
 *   - Bridge may shift / contrast the chorus.
 *   - Outro must resolve emotional energy (Calm Resolution).
 *   - No two consecutive sections (in playback order) share the same tag.
 */

export type EmotionTag =
  | "Confident & Rhythmic"
  | "Smooth & Seductive"
  | "Building Tension"
  | "Emotional Peak"
  | "Reflective / Deep"
  | "Anthemic / Energetic"
  | "Calm Resolution";

export type SectionRole =
  | "intro"
  | "hook"
  | "verse1"
  | "verse2"
  | "bridge"
  | "outro";

export interface SectionEmotionMap {
  intro?: EmotionTag;
  hook: EmotionTag;
  verse1: EmotionTag;
  verse2: EmotionTag;
  bridge: EmotionTag;
  outro?: EmotionTag;
}

export interface EmotionInferenceInput {
  intro?: string[];
  hook: string[];
  verse1: string[];
  verse2: string[];
  bridge: string[];
  outro?: string[];
}

// ── Lexicons ────────────────────────────────────────────────────────────────

const EMOTION_KEYWORDS: Record<EmotionTag, string[]> = {
  "Smooth & Seductive": [
    "love", "kiss", "touch", "skin", "body", "slow", "close",
    "whisper", "tender", "soft", "sweet", "lips", "hold", "heat",
    "honey", "silk", "warm", "embrace",
  ],
  "Anthemic / Energetic": [
    "rise", "fire", "shine", "win", "dance", "celebrate", "tonight",
    "anthem", "loud", "crown", "high", "stars", "sky", "free",
    "alive", "world", "shout", "victory",
  ],
  "Reflective / Deep": [
    "remember", "miss", "wonder", "memory", "yesterday", "thought",
    "dream", "sigh", "alone", "deep", "ocean", "soul", "ghost",
    "shadow", "reason", "why",
  ],
  "Emotional Peak": [
    "tears", "break", "broken", "pain", "hurt", "lost", "scream",
    "cry", "fall", "heart", "ache", "bleed", "wound", "shatter",
  ],
  "Building Tension": [
    "wait", "almost", "edge", "rising", "build", "soon", "watch",
    "ready", "promise", "patience", "any moment", "closer", "?",
  ],
  "Confident & Rhythmic": [
    "i'm", "no fear", "born", "claim", "destiny", "boss",
    "stand", "made it", "king", "queen", "throne", "own", "level",
    "boss up", "champion",
  ],
  "Calm Resolution": [
    "peace", "rest", "home", "softly", "gentle", "fade", "still",
    "quiet", "amen", "grateful", "settle", "breathe", "calm",
  ],
};

const MOOD_HOOK_BIAS: Record<string, EmotionTag> = {
  Uplifting: "Anthemic / Energetic",
  Romantic: "Smooth & Seductive",
  Confident: "Confident & Rhythmic",
  Reflective: "Reflective / Deep",
  Heartbreak: "Emotional Peak",
  Energetic: "Anthemic / Energetic",
  Sad: "Emotional Peak",
  Spiritual: "Reflective / Deep",
  Party: "Anthemic / Energetic",
  Chill: "Smooth & Seductive",
};

const ROLE_DEFAULT: Record<SectionRole, EmotionTag> = {
  intro: "Reflective / Deep",
  hook: "Anthemic / Energetic",
  verse1: "Confident & Rhythmic",
  verse2: "Smooth & Seductive",
  bridge: "Emotional Peak",
  outro: "Calm Resolution",
};

/** Sibling tags used to disambiguate when adjacent sections collide. */
const FAMILIES: Record<EmotionTag, EmotionTag[]> = {
  "Anthemic / Energetic": ["Confident & Rhythmic", "Emotional Peak"],
  "Confident & Rhythmic": ["Anthemic / Energetic", "Building Tension"],
  "Smooth & Seductive": ["Reflective / Deep", "Calm Resolution"],
  "Reflective / Deep": ["Smooth & Seductive", "Emotional Peak"],
  "Emotional Peak": ["Anthemic / Energetic", "Reflective / Deep"],
  "Building Tension": ["Confident & Rhythmic", "Anthemic / Energetic"],
  "Calm Resolution": ["Reflective / Deep", "Smooth & Seductive"],
};

// ── Scoring ─────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreEmotions(lines: string[]): Record<EmotionTag, number> {
  const text = lines.join(" \n ").toLowerCase();
  const scores = {
    "Smooth & Seductive": 0,
    "Anthemic / Energetic": 0,
    "Reflective / Deep": 0,
    "Emotional Peak": 0,
    "Building Tension": 0,
    "Confident & Rhythmic": 0,
    "Calm Resolution": 0,
  } as Record<EmotionTag, number>;

  (Object.keys(EMOTION_KEYWORDS) as EmotionTag[]).forEach((tag) => {
    let s = 0;
    for (const w of EMOTION_KEYWORDS[tag]) {
      if (w === "?") {
        s += (text.match(/\?/g) ?? []).length;
      } else if (/\s/.test(w)) {
        const re = new RegExp(escapeRegex(w), "g");
        s += (text.match(re) ?? []).length;
      } else {
        const re = new RegExp(`\\b${escapeRegex(w)}\\b`, "g");
        s += (text.match(re) ?? []).length;
      }
    }
    scores[tag] = s;
  });

  return scores;
}

function inferOne(
  role: SectionRole,
  lines: string[] | undefined,
  mood: string,
): EmotionTag {
  const fallback =
    role === "hook"
      ? MOOD_HOOK_BIAS[mood] ?? ROLE_DEFAULT.hook
      : ROLE_DEFAULT[role];

  if (!lines || lines.length === 0) return fallback;

  const scores = scoreEmotions(lines);
  let best: EmotionTag | null = null;
  let bestScore = 0;

  (Object.keys(scores) as EmotionTag[]).forEach((tag) => {
    if (scores[tag] > bestScore) {
      best = tag;
      bestScore = scores[tag];
    }
  });

  return best && bestScore > 0 ? best : fallback;
}

/** Pick a related-but-different tag. Used to break adjacent collisions. */
function alternativeTo(current: EmotionTag, avoid: EmotionTag): EmotionTag {
  if (current !== avoid) return current;
  const family = FAMILIES[current] ?? [];
  return family.find((f) => f !== avoid) ?? current;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Infer an emotion tag per section while preserving structure, ordering,
 * and section count. Applies consistency rules:
 *   - Chorus is the anchor and stays as inferred.
 *   - Outro is forced to "Calm Resolution".
 *   - Bridge contrasts the chorus when possible.
 *   - No two consecutive sections share the same tag (in playback order:
 *     intro → chorus → verse1 → chorus → verse2 → chorus → bridge → outro).
 */
export function inferLyricsEmotions(
  draft: EmotionInferenceInput,
  mood: string,
): SectionEmotionMap {
  const hook = inferOne("hook", draft.hook, mood);
  let verse1 = inferOne("verse1", draft.verse1, mood);
  let verse2 = inferOne("verse2", draft.verse2, mood);
  let bridge = inferOne("bridge", draft.bridge, mood);
  let intro: EmotionTag | undefined = draft.intro?.length
    ? inferOne("intro", draft.intro, mood)
    : undefined;
  const outro: EmotionTag | undefined = draft.outro?.length
    ? "Calm Resolution"
    : undefined;

  // Adjacency in playback order: each section is immediately preceded by
  // the chorus (except intro, which precedes the chorus). Force contrast.
  if (intro) intro = alternativeTo(intro, hook);
  verse1 = alternativeTo(verse1, hook);
  verse2 = alternativeTo(verse2, hook);
  bridge = alternativeTo(bridge, hook);
  if (verse2 === verse1) verse2 = alternativeTo(verse2, verse1);
  if (outro && bridge === outro) bridge = alternativeTo(bridge, outro);

  return { intro, hook, verse1, verse2, bridge, outro };
}

/**
 * Append the emotion tag to a base section label, e.g.
 *   decorateSectionLabel("Chorus", "Smooth & Seductive")
 *     → "Chorus - Smooth & Seductive"
 * Returns the label unchanged when no emotion is provided.
 */
export function decorateSectionLabel(
  baseLabel: string,
  emotion?: EmotionTag,
): string {
  if (!emotion) return baseLabel;
  return `${baseLabel} - ${emotion}`;
}
