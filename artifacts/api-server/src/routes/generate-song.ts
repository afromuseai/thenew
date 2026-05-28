import { Router } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";
import { requireAuth, attachPlanFromDb, requireFeature } from "../access/middleware.js";

const router = Router();

type DnaMode = "REPETITION MODE" | "STORY MODE" | "CHAOS MODE" | "MINIMAL MODE" | "MAXIMAL MODE";
type EmotionalLens = "Pain" | "Faith" | "Power" | "Struggle" | "Celebration" | "Reflection" | "Defiance" | "Loneliness";
type EnergyLevel = "Low" | "Medium" | "High";
type PerformanceType = "Club Banger" | "TikTok Viral" | "Emotional Replay" | "Street Anthem" | "Spiritual Anthem" | "Experimental / Niche";
type SectionKey = "intro" | "hook" | "verse1" | "verse2" | "bridge" | "outro";

interface ProductionVariation {
  bpmRange: string;
  drumStyle: string;
  melodyType: string;
  bouncePattern: string;
}

interface DiversityProfile {
  dnaMode: DnaMode;
  emotionalLens: EmotionalLens;
  energyLevel: EnergyLevel;
  arrangementOrder: SectionKey[];
  hookStructure: string;
  chorusLengthPattern: string;
  energyCurve: string;
  urgencyLevel: string;
  artistMindset: string;
  productionVariation: ProductionVariation;
  performanceType: PerformanceType;
  sectionLineTargets: Partial<Record<SectionKey, number[]>>;
}

let lastDiversitySignature: {
  hookStructure?: string;
  emotionalLens?: EmotionalLens;
  chorusLengthPattern?: string;
  energyCurve?: string;
  energyLevel?: EnergyLevel;
  performanceType?: PerformanceType;
  arrangementKey?: string;
} = {};

/**
 * Canonical AfroMuse song arrangement.
 * Every diversity profile uses this exact section order so generated lyrics
 * always come back as a complete song (intro, chorus, verse 1, chorus,
 * verse 2, bridge, chorus, outro). Diversity now lives in emotional lens,
 * energy curve, hook structure, line counts, and production variation —
 * NOT in the arrangement skeleton itself.
 */
const STANDARD_ARRANGEMENT: SectionKey[] = [
  "intro", "hook", "verse1", "hook", "verse2", "bridge", "hook", "outro",
];

const diversityProfiles: DiversityProfile[] = [
  {
    dnaMode: "REPETITION MODE",
    emotionalLens: "Power",
    energyLevel: "High",
    arrangementOrder: STANDARD_ARRANGEMENT,
    hookStructure: "chant-driven repeated anchor, minimal verse change, crowd-response phrasing",
    chorusLengthPattern: "short repeated 4-line hook",
    energyCurve: "instant high impact → controlled dip → repeated high impact",
    urgencyLevel: "public, loud, direct",
    artistMindset: "an artist leading a crowd chant with no over-explaining",
    productionVariation: {
      bpmRange: "fast (128–140 BPM)",
      drumStyle: "afro drum",
      melodyType: "synth-driven",
      bouncePattern: "straight",
    },
    performanceType: "Club Banger",
    sectionLineTargets: { intro: [2], hook: [4], verse1: [8], verse2: [8], bridge: [4], outro: [2, 4] },
  },
  {
    dnaMode: "STORY MODE",
    emotionalLens: "Reflection",
    energyLevel: "Medium",
    arrangementOrder: STANDARD_ARRANGEMENT,
    hookStructure: "light hook, verse carries the song, no repetition dominance",
    chorusLengthPattern: "light 4-line chorus",
    energyCurve: "slow narrative climb → late emotional release → quiet landing",
    urgencyLevel: "private, patient, confessional",
    artistMindset: "a storyteller letting the verses do the heavy lifting",
    productionVariation: {
      bpmRange: "mid (88–100 BPM)",
      drumStyle: "minimal",
      melodyType: "piano-led",
      bouncePattern: "swing",
    },
    performanceType: "Emotional Replay",
    sectionLineTargets: { intro: [2, 4], hook: [4], verse1: [12, 16], verse2: [12, 16], bridge: [4], outro: [2, 4] },
  },
  {
    dnaMode: "CHAOS MODE",
    emotionalLens: "Defiance",
    energyLevel: "High",
    arrangementOrder: STANDARD_ARRANGEMENT,
    hookStructure: "broken phrasing, irregular hook returns, unpredictable flow",
    chorusLengthPattern: "uneven 6-line hook",
    energyCurve: "spike → fracture → drop out → sudden return",
    urgencyLevel: "restless, unstable, sharp turns",
    artistMindset: "an artist thinking out loud while the beat keeps shifting under them",
    productionVariation: {
      bpmRange: "fast (140–160 BPM)",
      drumStyle: "drill",
      melodyType: "synth-driven",
      bouncePattern: "broken",
    },
    performanceType: "Street Anthem",
    sectionLineTargets: { intro: [2], hook: [6], verse1: [8, 12], verse2: [8], bridge: [4], outro: [2] },
  },
  {
    dnaMode: "MINIMAL MODE",
    emotionalLens: "Pain",
    energyLevel: "Low",
    arrangementOrder: STANDARD_ARRANGEMENT,
    hookStructure: "few words, silence matters, emotional weight per word",
    chorusLengthPattern: "sparse 4-line hook — each line carries full weight",
    energyCurve: "low pressure → exposed center → quiet aftershock",
    urgencyLevel: "intimate, sparse, wounded",
    artistMindset: "an artist saying less because each word costs something",
    productionVariation: {
      bpmRange: "slow (60–78 BPM)",
      drumStyle: "no drums / sparse percussion",
      melodyType: "vocal-driven",
      bouncePattern: "swing",
    },
    performanceType: "Emotional Replay",
    sectionLineTargets: { intro: [2], hook: [4], verse1: [8], verse2: [8], bridge: [4], outro: [2] },
  },
  {
    dnaMode: "MAXIMAL MODE",
    emotionalLens: "Faith",
    energyLevel: "Medium",
    arrangementOrder: STANDARD_ARRANGEMENT,
    hookStructure: "dense lyrical hook with layered meaning and heavy imagery",
    chorusLengthPattern: "full 8-line chorus",
    energyCurve: "dense build → heavy peak → wider final statement",
    urgencyLevel: "urgent, loaded, cinematic",
    artistMindset: "an artist unloading a complete worldview in one record",
    productionVariation: {
      bpmRange: "mid (100–118 BPM)",
      drumStyle: "afro drum",
      melodyType: "pads-and-piano layered",
      bouncePattern: "swing",
    },
    performanceType: "Spiritual Anthem",
    sectionLineTargets: { intro: [2, 4], hook: [8], verse1: [16], verse2: [16], bridge: [4], outro: [4] },
  },
  {
    dnaMode: "MINIMAL MODE",
    emotionalLens: "Loneliness",
    energyLevel: "Low",
    arrangementOrder: STANDARD_ARRANGEMENT,
    hookStructure: "short, raw, aching — feels like the artist is singing to themselves",
    chorusLengthPattern: "aching 4-line hook — raw and unresolved",
    energyCurve: "quiet opening → subdued rise → hollow landing",
    urgencyLevel: "inward, fragile, unresolved",
    artistMindset: "someone who just realized they are completely alone",
    productionVariation: {
      bpmRange: "slow (64–76 BPM)",
      drumStyle: "no drums",
      melodyType: "vocal-driven with pads",
      bouncePattern: "swing",
    },
    performanceType: "Emotional Replay",
    sectionLineTargets: { intro: [2, 4], hook: [4], verse1: [8], verse2: [8], bridge: [4], outro: [2, 4] },
  },
  {
    dnaMode: "STORY MODE",
    emotionalLens: "Struggle",
    energyLevel: "Medium",
    arrangementOrder: STANDARD_ARRANGEMENT,
    hookStructure: "resilient anthem-style, simple but carries weight — screams survival",
    chorusLengthPattern: "4-to-6 line hook, emotionally driven",
    energyCurve: "quiet start → pressure mounting → explosive hook release → reflective bridge → final declaration",
    urgencyLevel: "grounded, real, earned",
    artistMindset: "a person who has been through it and is still standing",
    productionVariation: {
      bpmRange: "mid (90–108 BPM)",
      drumStyle: "afro drum",
      melodyType: "guitar and pads",
      bouncePattern: "swing",
    },
    performanceType: "Street Anthem",
    sectionLineTargets: { intro: [2], hook: [4, 6], verse1: [8, 12], verse2: [8, 12], bridge: [4], outro: [2, 4] },
  },
  {
    dnaMode: "REPETITION MODE",
    emotionalLens: "Celebration",
    energyLevel: "High",
    arrangementOrder: STANDARD_ARRANGEMENT,
    hookStructure: "pure party energy — ultra-chantable, crowd-friendly, instant repeat",
    chorusLengthPattern: "4-line hook repeated heavily",
    energyCurve: "big open → sustained high → crowd drop → biggest hook at the end",
    urgencyLevel: "joyful, communal, infectious",
    artistMindset: "an artist who just made it and is celebrating with everyone around them",
    productionVariation: {
      bpmRange: "fast (120–138 BPM)",
      drumStyle: "afro drum",
      melodyType: "synth and piano combo",
      bouncePattern: "straight",
    },
    performanceType: "TikTok Viral",
    sectionLineTargets: { intro: [2], hook: [4], verse1: [8], verse2: [8], bridge: [4], outro: [2, 4] },
  },
];

const emotionalLensPool: EmotionalLens[] = ["Pain", "Faith", "Power", "Struggle", "Celebration", "Reflection", "Defiance", "Loneliness"];

function pickRandomItem<T>(items: T[], reject?: (item: T) => boolean): T {
  const available = reject ? items.filter((item) => !reject(item)) : items;
  const pool = available.length > 0 ? available : items;
  return pool[Math.floor(Math.random() * pool.length)];
}

function createDiversityProfile(): DiversityProfile {
  const base = pickRandomItem(
    diversityProfiles,
    (profile) =>
      profile.hookStructure === lastDiversitySignature.hookStructure ||
      profile.chorusLengthPattern === lastDiversitySignature.chorusLengthPattern ||
      profile.energyCurve === lastDiversitySignature.energyCurve ||
      profile.energyLevel === lastDiversitySignature.energyLevel,
  );
  const emotionalLens = pickRandomItem(
    emotionalLensPool,
    (lens) => lens === lastDiversitySignature.emotionalLens,
  );
  const profile = { ...base, emotionalLens };
  lastDiversitySignature = {
    hookStructure: profile.hookStructure,
    emotionalLens: profile.emotionalLens,
    chorusLengthPattern: profile.chorusLengthPattern,
    energyCurve: profile.energyCurve,
    energyLevel: profile.energyLevel,
    performanceType: profile.performanceType,
    arrangementKey: profile.arrangementOrder.join("→"),
  };
  return profile;
}

function formatSectionTargets(profile: DiversityProfile): string {
  return (["intro", "hook", "verse1", "verse2", "bridge", "outro"] as SectionKey[])
    .map((section) => {
      const target = profile.sectionLineTargets[section];
      if (!target || target.length === 0) return `${section}: [] empty / not used in this arrangement`;
      return `${section}: ${target.join(" or ")} lines`;
    })
    .join("\n");
}

function buildDiversityDirective(profile: DiversityProfile): string[] {
  return [
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "AFROMUSE TRUE DIVERSITY ENGINE — FINAL SYSTEM",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "CORE RULE: Every song must feel like it was made by a DIFFERENT version of the artist.",
    "If it feels similar to a previous output → it must be rewritten automatically.",
    "",
    "This full DNA profile was randomly selected BEFORE writing. It overrides all default song-shape instincts.",
    "",
    "— STEP 1: RANDOMLY SELECTED DNA —",
    `A. DNA MODE: ${profile.dnaMode}`,
    `B. EMOTIONAL LENS: ${profile.emotionalLens}`,
    `   ❗ Do NOT mix emotional lenses. Use this ONE lens only.`,
    `C. ENERGY LEVEL: ${profile.energyLevel}`,
    `   Low = calm, intimate | Medium = balanced | High = aggressive / loud`,
    `D. STRUCTURE TYPE: ${profile.arrangementOrder.join(" → ")}`,
    "",
    "— STEP 2: HARD CONSTRAINTS (ANTI-SAMENESS RULES) —",
    "❌ FORBIDDEN — if any of these match the previous song, the output must be rewritten:",
    "  → same chorus length as last song",
    "  → same hook rhythm pattern",
    "  → same emotional tone",
    "  → same structure twice in a row",
    "  → same repetition style",
    "",
    "— STEP 3: HOOK CREATION RULES —",
    "Hook must match the active DNA mode:",
    "  REPETITION → 1–3 lines, repeated chant",
    "  STORY → 4–6 lines, meaningful narrative",
    "  CHAOS → irregular phrasing, unpredictable",
    "  MINIMAL → 1–2 short lines only",
    "  MAXIMAL → layered, expressive, dense",
    `Active hook structure: ${profile.hookStructure}`,
    `Chorus length pattern: ${profile.chorusLengthPattern}`,
    "",
    "— STEP 4: VERSE RULES —",
    "  → Each 2 lines must introduce a NEW idea or shift — no holding the same thought",
    "  → No line rewording repetition (same idea rephrased slightly = forbidden)",
    "  → Flow must change at least once per verse",
    "",
    "— STEP 5: LANGUAGE CONTROL —",
    "  → Keep phrases SHORT and NATURAL",
    "  → Avoid over-explaining",
    "  → Use RHYTHM-FIRST writing — not sentence-first",
    "  → Mix local dialect and English ONLY if it flows musically",
    "",
    "— STEP 6: PRODUCTION VARIATION (MANDATORY) —",
    "This song MUST use these production parameters:",
    `  BPM Range: ${profile.productionVariation.bpmRange}`,
    `  Drum Style: ${profile.productionVariation.drumStyle}`,
    `  Melody Type: ${profile.productionVariation.melodyType}`,
    `  Bounce Pattern: ${profile.productionVariation.bouncePattern}`,
    "",
    "— ADDITIONAL DNA —",
    `ARTIST MINDSET: ${profile.artistMindset}`,
    `URGENCY LEVEL: ${profile.urgencyLevel}`,
    `ENERGY CURVE: ${profile.energyCurve}`,
    `PERFORMANCE TYPE: ${profile.performanceType}`,
    "",
    "SECTION TARGETS:",
    formatSectionTargets(profile),
    "",
    "— STEP 7: SECTION OUTPUT (MANDATORY — STANDARD ARRANGEMENT) —",
    "Every AfroMuse song uses this canonical arrangement, in this exact order:",
    "    Intro → Chorus (Hook) → Verse 1 → Chorus (Hook) → Verse 2 → Bridge → Chorus (Hook) → Outro",
    "All SIX section keys MUST be returned with non-empty content:",
    "    intro, hook, verse1, verse2, bridge, outro",
    "  → `hook` is written ONCE — it is reused at the three chorus positions in the arrangement.",
    "  → No section may be returned as an empty array. If you have nothing original for a section, write a short, on-theme version (intro/outro = 2 short lines; bridge = exactly 4 lines; hook = 4-8 lines).",
    "  → Honour the SECTION TARGETS line counts above for each section.",
    "All other required output fields (songQualityReport, hookVariants, hitPrediction, globalReleaseReport, etc.)",
    "must still be included exactly as specified in the system output format — do NOT skip them.",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ];
}

const SYSTEM_PROMPT = `AFROMUSE_ENGINE — LYRICS INTELLIGENCE v5.0

╔══════════════════════════════════════════════════════════════╗
  🎵 AFROMUSE LYRICS INTELLIGENCE v5.0
  Layers: V2 Language | V3 Songwriting | V4 Emotional Gradient | V5 Vocal Flow
╚══════════════════════════════════════════════════════════════╝

STRUCTURE:
Structure is determined by the DIVERSITY ENGINE directive in the user message.
Follow the SECTION TARGETS and STRUCTURE TYPE listed there exactly.
Do NOT default to a fixed section order — use only the arrangement provided.

RULES:
- chorus = catchy, contains main hook (repeat max 2-3 times)
- verses = storytelling, no repeated lines
- each section = new meaning
- natural human phrasing only
- no robotic or translated language
- short, rhythmic lines

REALNESS RULE:
- avoid common love phrases (e.g. "my heart beats", "shine like light", "forever love")
- use specific moments instead of general statements
- make lines feel like something someone would actually say or remember
- add small details (time, place, action, memory)
- prioritize authenticity over perfection

──────────────────────────────────
CORE SONGWRITING INTELLIGENCE — V3 (MANDATORY):

These rules govern the QUALITY of every lyric line produced. They run before language mode, before dialect, before everything.

RULE 1 — WRITE SONGS, NOT EXPLANATIONS:
Every line must feel like something a real artist would sing or perform — not something written in an essay or therapy journal.
BAD (explanation style):
  ✗ "I have been through many difficult experiences in life"
  ✗ "I know that God has been helping me through all my struggles"
  ✗ "I am trying my best but things are not working out for me"
GOOD (song style):
  ✓ "Pain don tire me"
  ✓ "Na God carry me"
  ✓ "Body weak, spirit still dey"
The test: if a line could appear in a motivational blog post, it is NOT a lyric. Rewrite it.

RULE 2 — HOOKS MUST BE SHORT AND STRONG:
The chorus / hook is the most important part of the song.
  - It should be short enough to chant on first listen
  - It should contain the keeper line or a tight variation of it
  - It should feel emotionally immediate — the payoff, not the setup
  - It must NOT be over-written, wordy, or "poetic"
  - If the hook is longer than it needs to be, cut it down
  - SIMPLER IS STRONGER. Always.
  - The hook should feel like it always existed — obvious in the best possible way.

RULE 3 — ZERO TOLERANCE FOR MOTIVATIONAL FILLER:
These lines are BANNED unless the song has specifically and emotionally EARNED them:
  ✗ "I know one day I will make it"
  ✗ "I will continue to rise above"
  ✗ "No matter what happens I will never give up"
  ✗ "I am blessed and highly favored"
  ✗ "Through the storm I will remain strong"
  ✗ "I believe in myself and my journey"
  ✗ "Together we can overcome anything"
These feel like motivational posters, not songs. Replace with concrete, emotionally specific lines.
If a line could be a phone wallpaper caption — it is not a lyric. Rewrite it.

RULE 4 — LINE LENGTH — SHORT, MUSICAL, BREATH-FRIENDLY:
Most lines should be short enough to sing in one breath phrase over a beat.
  - Avoid lines with too many clauses or conjunctions
  - Avoid lines that sound like run-on sentences when spoken aloud
  - Favor punchy endings — strong last word, strong rhythmic hit
  - Write for performance, not for reading
  - If a line takes more than one natural breath to say — shorten it

RULE 5 — VERSES MUST PROGRESS, NOT REPEAT:
Each verse should move the song FORWARD. A verse is a journey, not a loop.
Ideal verse arc:
  → SCENE (where are we / what is happening)
  → FEELING (what does it feel like)
  → REACTION (what does the person do or feel next)
  → CONSEQUENCE (what does this cost or create)
  → REALIZATION (what truth surfaces)
BANNED verse behavior:
  ✗ Saying the same emotional point 8 times with slightly different wording
  ✗ Restating the chorus concept in the verse
  ✗ Filling lines with generic filler just to hit line count
Each line in a verse should earn its place by moving the story or feeling one step further.

RULE 6 — PRIORITIZE QUOTABLE LINES:
Every song should contain at least 2–3 lines that feel:
  - screamable at a concert
  - caption-worthy without context
  - emotionally sharp enough to stop a listener cold
  - distinctly artist-like — not generic
DIRECTIONAL EXAMPLES (do NOT copy — write originals of this quality):
  ✓ "Dem laugh first, now dem dey watch"
  ✓ "Body weak but the hunger no die"
  ✓ "Silence loud when pain too much"
  ✓ "God know wetin man no see"
These are directional references only — never copy them verbatim.

RULE 7 — MATCH GENRE ENERGY:
Afrobeats (emotional / romantic / spiritual): smoother · melodic · intimate · hook-focused
Street-pop / Afro-street: harder · more direct · more quotable · more crowd-aware
Dancehall / Patois: rhythm-driven · chantable · naturally Jamaican · never fake "Google Patois"
Sad / heartbreak: simple · vulnerable · believable · not overly poetic
Amapiano: atmospheric · laid-back groove · emotional but cool · layered repetition
Gospel / Spiritual: testimony-driven · humanly vulnerable · never preachy · earned not performed

RULE 8 — BRIDGE MUST MATTER:
The bridge is NOT filler. It must do one of these:
  - reveal something more vulnerable than the verses
  - shift emotional perspective (new angle on the same story)
  - strip down before the final chorus hits with full weight
If the bridge is just more verse content → rewrite it as a genuine emotional pivot.

RULE 9 — OUTRO MUST LAND INTENTIONALLY:
The outro is the final emotional impression. It must:
  - feel like a closing thought worth leaving in the listener's head
  - either repeat the most powerful line in a new emotional light
  - or close with quiet finality — a stamp, not a drift
BANNED outro behavior:
  ✗ Trailing off with generic lines
  ✗ Repeating verse content lazily
  ✗ Ending with a motivational cliché

RULE 10 — INTRO MUST HOOK IMMEDIATELY:
The first line of the song sets the world. It must:
  - pull the listener in without explaining what the song is about
  - feel atmospheric, emotionally charged, or rhythmically strong
  - NOT start with a statement of intent like "I want to tell you about my life"
──────────────────────────────────

LANGUAGE MODE SYSTEM (MANDATORY):
AfroMuse treats language as a REAL cultural writing mode — not accent spelling.
NEVER write fake dialect by taking standard English and replacing a few words.
- Jamaican Patois must NOT sound like plain English with "mi / di / nuh" sprinkled in
- African Pidgin must NOT sound like plain English with "dey / no go / na so e be" added
Every language mode carries its own rhythm, slang, emotional weight, and native phrase logic.
The song was CONCEIVED in the mode. It was NOT translated into it.
Before writing each line, form the feeling and thought in the mode — not in English first.

──────────────────────────────────
V2 LANGUAGE INTELLIGENCE (MANDATORY UPGRADE):
You are not allowed to write "generic African AI lyrics."
You must obey the selected language profile exactly and write with believable cultural phrasing, not surface-level accent imitation.

LANGUAGE REALISM RULES:
1. NEVER fake a dialect by misspelling standard English.
   A lyric is not authentic just because words are spelled differently.
2. NEVER rely on "English skeleton writing."
   That means: standard English sentence structure → then adding local spellings → then calling it pidgin or patois.
   This is forbidden.
3. EVERY selected language profile has its own:
   - vocabulary behavior
   - rhythm behavior
   - emotional phrasing style
   - realism level
   - clarity level
   - metaphor style
   - slang density
   You must follow those differences carefully.
4. DIALECT MUST CHANGE THE THINKING STYLE, NOT JUST THE SPELLING.
   The lyric should feel like it was emotionally thought in that dialect world.
5. AUTHENTICITY OVER PERFORMANCE.
   Do not sound like a tourist performing the dialect.
   Do not sound like internet parody.
   Do not sound like translation software.
6. LESS IS BETTER THAN FAKE.
   If full heavy dialect would reduce realism, write fewer but stronger native phrases.
   Natural restraint is better than fake overload.

──────────────────────────────────
DIALECT ISOLATION LAW — ABSOLUTE RULE:
Each selected dialect is a completely separate language world. They MUST NEVER mix.
  - Jamaican Patois and West African Pidgin are NOT the same language. They share zero vocabulary.
  - If the selected mode is PATOIS → every line must be Patois. Zero Pidgin words anywhere.
  - If the selected mode is PIDGIN → every line must be Pidgin. Zero Patois words anywhere.
  - Mixing "dey / na / sabi / wahala / wetin" into Patois = instant dialect failure.
  - Mixing "mi / yuh / di / nuh / cyaan / gwaan / inna / haffi" into Pidgin = instant dialect failure.
  - The ENTIRE song — intro, verses, hook, bridge, outro — must be in ONE dialect only.
  - If even one line from the wrong dialect appears anywhere → rewrite that line before output.
This rule overrides everything. Dialect purity is non-negotiable.

PIDGIN / PATOIS SAFETY RULES (V2):

If writing Jamaican Patois:
- Avoid "mi + full English sentence" writing.
- Avoid textbook or tourist-style reggae writing.
- Avoid fake poetic English disguised as patois.
- Use stronger native phrasing, compression, and lived-in yard realism.
- Prioritize realism over sounding "poetic."
MANDATORY WORD-LEVEL RULES (Jamaican Patois):
- NEVER write "go" when the meaning is "carry on / proceed / go ahead" — it is ALWAYS "gwaan"
    ✗ "go on" / "let it go" (proceed) → ✓ "gwaan" / "mek it gwaan"
- NEVER write "never" as a present-tense instruction or negation — it is ALWAYS "nuh" or "nah"
    ✗ "never leave me" / "never give up" → ✓ "nuh lef mi" / "nuh gi up"
    "neva" is only valid as past tense: "dem neva rate mi" = they never rated me (past) — correct
- NEVER write "don't" — it is ALWAYS "nuh"
- NEVER write "can't" — it is ALWAYS "cyaan"
FORBIDDEN STYLE EXAMPLES (Jamaican Patois):
  ✗ "Mi walk through di fire, but mi never get burned" → use "nuh" not "never"
  ✗ "Go on and rise above it" → use "gwaan" not "go on"
  ✗ "Mi did deh inna di darkness, where di light nuh shine"
  ✗ "Mi will survive and thrive in life"
  ✗ "Mi heart full of determination"
  These feel like translated English, not authentic Jamaican writing.
If the language is Jamaican Street Patois:
- Lean gritty, hard, survival-based, raw, and street-believable.
- Use tougher imagery and less polished emotional explanation.
If the language is Jamaican Spiritual Patois:
- Lean prayerful, rooted, reverent, testimony-based, and conscious.
- Do NOT just insert "Jah" into generic lines.
- The faith language must feel deep and lived, not decorative.

If writing Nigerian Pidgin:
- Avoid robotic overuse of the following — only allowed if they truly fit and are not repeated lazily:
  "I no go fall" / "Na so e be" / "Only God sabi" / "You dey sweet me die" / "I don arrive" / "E dey happen"
- Do not make every line sound like social media slang.
- Keep it musical, believable, and artist-ready.
MANDATORY WORD-LEVEL RULES (Nigerian/Ghanaian Pidgin):
- NEVER write "can't" or "cannot" — it is ALWAYS "no fit" / "e no fit"
    ✗ "I can't explain" → ✓ "I no fit explain"
- NEVER write "don't" — it is ALWAYS "no"
    ✗ "don't leave me" → ✓ "no leave me" / "no go"
- NEVER write "I am" as a continuous state — it is ALWAYS "I dey"
    ✗ "I am feeling you" → ✓ "I dey feel you"
- NEVER write "know" (as in understand/know someone) — it is ALWAYS "sabi"
    ✗ "you know say I love you" → ✓ "you sabi say I love you"
- NEVER write "left/went away" — it is ALWAYS "comot"
    ✗ "you left me" → ✓ "you comot from me" / "you just comot like dat"
- NEVER write "bring me" or "take me" (in an emotional/journey sense) — it is ALWAYS "carry me"
    ✗ "bring me closer" → ✓ "carry me come" | ✗ "take me away" → ✓ "carry me go"
- "can" as ability → "fit": ✗ "I can do it" → ✓ "I fit do am"
- "very / extremely" at line end → "die" / "choke": ✗ "I love you so much" → ✓ "I love you die"
- "it is" → "na" (emphasis) or "e dey": ✗ "it is you I want" → ✓ "na you I want"
GHANA-SPECIFIC ENFORCEMENT:
- Must contain 'chale' / 'massa' / 'dier' / 'barb' / 'aswear' naturally — not as add-ons to English lines
- NEVER default into Nigerian phrasing — Ghana voice must be distinguishably Accra/urban Ghana
If the language is Naija Melodic Pidgin:
- Write smoother, more emotional, more singable lines.
- Lean into romance, longing, heartbreak, sweetness, memory, and melody.
- Keep the phrasing fluid and musical.
If the language is Naija Street Pidgin:
- Write rougher, more direct, more trenches-rooted lines.
- Lean into hustle, pressure, pain, flex, confidence, and survival.
- Make it feel like lived street speech, not dramatic fake toughness.

If writing Ghana Urban Pidgin:
- Do NOT accidentally default into Nigerian phrasing.
- Ghana flavor must feel urban, stylish, youthful, and Ghana-real.
- Avoid exaggerated or comedic pidgin.
- Write with the energy of: cool pain / city confidence / urban love / calm but sharp realism.

If writing Afro-Fusion Clean Pidgin:
- Keep the writing polished, catchy, emotional, and easy to sing.
- Use local flavor lightly and naturally.
- Do NOT overload the lyrics with hard slang.
- This style should feel global, radio-ready, and emotionally clear.

──────────────────────────────────
MODE 1 — JAMAICAN STREET
Use for: dancehall, ghetto reality, hustler pain, rude-boy energy, survival, badman confidence
Voice identity: gritty, streetwise, raw, rhythmic, direct, survival-minded, tough but emotional underneath
Tone: raw, sharp, street-coded, aggressive or emotionally scarred, authentic Kingston / inner-city energy
Allowed style energy: hardship, hustle, betrayal, street ambition, survival, confidence, "dem never know / now dem see" energy
Vocabulary: mi, di, dem, fi, nuh, cyaan, haffi, affi, inna, pon, mek, weh, seh, ting, gyal, bwoy / more while, same way, whole heap, nuff, deh yah, guh / come from far, stay solid, hold strain, tek time, big up / badmind, real ting, no sell out, heart clean, pressure / gyal, yute, bredrin, mandem, dutty, sufferah, shell dung, run een / hunger, belly empty, concrete, lane, zinc fence, scheme, ends
Writing rules:
- avoid polished school-English phrasing — avoid sounding touristy or cartoonish
- do NOT overuse "Jah" unless the theme is spiritual
- prefer hard vivid street imagery over generic inspiration
- allow short punchy lines and natural repetition
- use phrase logic Jamaicans would actually say, not translated English
Good: "Belly buss but mi still a pree tomorrow" / "Dem switch fast when di blessings start show" / "Pressure never kill mi yet" / "Dem did count mi out too early" / "Nuff night mi hungry, still mi never fold"
Bad: "Mi am walking through the darkness every day" / "Mi know that life is hard but I keep climbing" / "Mi a rise above di struggle, yuh know, it's a fight" / anything that sounds like English with random Patois spelling
VERY IMPORTANT: Jamaican Street must feel PERFORMABLE in dancehall/street-pop immediately. It must not read like translated poetry.

──────────────────────────────────
MODE 2 — JAMAICAN SPIRITUAL
Use for: faith, prayer, hardship, testimony, redemption, suffering with grace, conscious roots
Voice identity: prayerful, reflective, faithful, humble, tested by life, emotionally strong, spiritually rooted
Tone: prayerful, humble, resilient, soulful, deeply reflective
Allowed style energy: prayer in hardship, divine protection, suffering with hope, inner healing, spiritual survival, gratitude after pain
Vocabulary: Jah, Most High, Father God, guide mi, cover mi, keep mi, carry mi through / nuh leave mi, hear mi cry, know mi heart, walk wid mi, bless mi road / favor, mercy, grace, psalms energy, still give thanks, through tribulation / heart clean, spirit strong / burden, trial, valley, lion heart, purpose, faith, healing / tears, fasting, testimony language
Writing rules:
- must feel like lived spiritual struggle, not church cliché
- avoid fake "religious Hallmark card" lines
- keep humility and emotional sincerity — pain and faith should coexist
- can be simple but must feel deeply believed
Good: "Jah never lef mi inna di storm" / "When mi spirit low, Him still hold mi" / "Tears drop quiet but mi faith stand firm" / "A pure grace carry mi through di wilderness" / "Dem only see di smile, You know di burden"
Bad: "Jah is with me through all of my pain and strife" / "Jah know mi heart, Him always best" / over-preachy sermon language with no human detail
VERY IMPORTANT: Jamaican Spiritual must feel like REAL testimony, not copied gospel slogans.

──────────────────────────────────
MODE 3 — NAIJA MELODIC PIDGIN
Use for: Afrobeats romance, pain, prayer, hustle, emotional confession, melodic hooks, soft street-pop
Voice identity: emotional, musical, smooth, conversational, romantic or reflective, catchy and singable, naturally Nigerian
Tone: smooth, emotional, singable, conversational, catchy but natural
Allowed style energy: heartbreak, longing, hustle, prayer, soft confidence, emotional vulnerability, "I dey feel am but I still dey move" energy
Vocabulary: I dey, e dey, no be, na so, wetin, abi, sha, sef, no fit, no go, I don / you sabi, e choke, e clear, carry me, ginger me / body no be firewood, my mind no rest, my chest dey hot, e no easy / who go hear word, no evidence, na only God sabi, as e be / I no wan lie, e don tey, no wahala, lowkey, I for don, I no send / carry me go, hold me down, no go shame me, I don tire, I still dey
Writing rules:
- must feel SINGABLE first — hooks should sound like Burna / Wiz / Omah / BNXN lane
- allow emotional repetition and simple but sticky phrasing
- avoid stiff or overly literal lines — avoid too much grammar-correct English
- avoid "Nigerian Twitter pidgin" if the song is emotional or melodic
Good: "Na you my mind dey run go meet" / "Since you show, my chest no calm" / "I no fit form, na you I want" / "Wetin you do me, e no normal" / "I dey smile outside but inside e red"
Bad: "Na your love I want, na your love I dey buy" / "Na you I want since forever" (too translation-like) / "I am trying my best but things are not going well"
VERY IMPORTANT: Naija Melodic Pidgin should feel like a real Afrobeats artist can sing it naturally without rewriting it in session.

──────────────────────────────────
MODE 4 — GHANA URBAN PIDGIN
Use for: Ghana street life, youth culture, confidence, emotional street-pop, campus vibes, hustle, urban romance
Voice identity: cool, sharp, emotionally controlled, urban, confident, sometimes witty, smooth but grounded
Tone: cool, sharp, local, conversational, rhythmic and street-aware
Allowed style energy: soft flex, emotional pain hidden under composure, city hustle, love and loyalty, pressure, ambition, self-belief
Vocabulary: chale, charley, massa, ebi, no be small, I for, I no fit lie, aswear, you barb, you bore / e choke, e pain me, I dey try, we move, no dull, I no go force, make we / if e no be, this life dier, who send me, I dey my lane, too known, no cap, ebi grace, dem no know / ei, ah, yawa, pressure, street rough, body tire, boys dey, highlife / Afro-urban emotional bounce
Writing rules:
- must feel Ghanaian, not just Nigerian pidgin with one "chale" added
- lighter and more urban-social than Naija melodic pidgin
- write with cool restraint and punch — less over-dramatic than Naija phrasing
- can blend English naturally but phrase logic must still feel Ghanaian
Good: "Chale this life dier e teach person" / "Dem no see the pressure behind the smile" / "I dey hold myself but e pain me bad" / "If no be grace, I for lost top"
Bad: "I no come from anywhere, but I reach everywhere" / copy-paste Naija pidgin with one "chale" added / lines that sound culturally nowhere
VERY IMPORTANT: Ghana Urban Pidgin should feel MODERN, COOL, and REAL — like something a young artist in Accra can actually say and sing.

──────────────────────────────────
MODE 5 — AFRO-FUSION CLEAN PIDGIN
Use for: broad commercial songs, export-friendly Afrobeats, romantic crossover, emotional radio songs
Voice identity: polished, emotional, accessible, global but rooted, radio-ready, elegant and simple
Tone: accessible, smooth, modern, emotionally clear, globally listenable without losing African flavor
Allowed style energy: romance, heartbreak, reflection, growth, hope, emotional confession, clean crossover melodies
Vocabulary: I dey, you dey, e dey pain me, na you, no be lie, no go lie / my mind no rest, my heart no calm, carry me, hold me down / stay with me, all I need, through the storm, no letting go / I still dey stand, na your love, forever no too far / I dey for you, no go leave me, hold me close, e dey pain me, no be lie, I no fit hide am / no wahala, make we dey go, my heart no rest, my soul no tire
Writing rules:
- cleanest pidgin lane — must still feel African-rooted, not plain global English
- use fewer dense slang terms than Naija or Ghana street modes
- ideal when the song needs wider audience appeal — must remain natural and musical
Good: "My mind no rest since you walked away" / "Na your love dey keep me standing" / "Even in silence, I still feel you" / "I still dey here though the rain no stop"
Bad: full standard English with just "dey" inserted / fake pidgin that sounds AI-written / overly raw street phrasing in a clean fusion song
VERY IMPORTANT: Afro-Fusion Clean Pidgin must still feel AUTHENTIC — just smoother, cleaner, and more exportable.

──────────────────────────────────
ANTI-FAKE LANGUAGE LAWS (ALL MODES — 10 MANDATORY RULES):
1. DO NOT write local language like a dictionary exercise.
2. DO NOT write English grammar and only swap 2–3 words.
3. DO NOT overuse the same filler phrase every section.
4. DO NOT force slang into every line.
5. DO NOT use phrases that sound AI-generic, fake-deep, or translated.
6. Every section must feel like a HUMAN from that language world is actually speaking or singing.
7. If a line feels unnatural out loud, rewrite it.
8. Prioritize SINGABILITY over cleverness.
9. Prioritize BELIEVABILITY over complexity.
10. Prioritize CULTURAL RHYTHM over textbook grammar.

ANTI-PATTERN TEST — run on every line before keeping it:
If I removed the dialect words, does plain English sentence logic remain? → If yes, the line failed. Rewrite from the feeling first.
Reject: "You are the light that shines inna mi life" → Patois on English bone
Keep: "From yuh light come, darkness nuh linger" → thought formed in the mode
Reject: "I will always love you and never leave your side" → English structure
Keep: "I no dey go anywhere, you know say e true" → Pidgin-born thought

HOOK AUTHENTICITY LAW (ALL MODES):
The hook must sound like something a REAL artist would repeat naturally.
A good hook should feel: chantable, emotionally sticky, easy to remember, native to the chosen language style, strong enough to perform live.
Avoid hooks that sound like: motivational speech, translated slogans, fake poetry, generic AI struggle captions.
If the hook sounds like a caption instead of a song, rewrite it.

FULL-SONG CONSISTENCY RULE:
The language mode voice must stay identical from intro to outro. No section gets a pass.
If the verse sounds native and the chorus drifts to English — the chorus failed. Rewrite it.
Bridge and outro must carry the same language weight as the verses.

ANTI-FAKE LANGUAGE TEST (V2 — SILENT — RUNS ON EVERY SECTION):
Before finalizing each section, silently ask all four questions. If any answer is weak, rewrite the section.

Question 1: "Would a real artist from this language world naturally sing this line?"
If the answer is "not really" → rewrite it.

Question 2: "Is this line emotionally local, or just English with altered spelling?"
If it feels like English wearing dialect clothes → rewrite it.

Question 3: "Have I repeated lazy fallback phrases too many times?"
If the same safe phrase appears more than once → replace with something more specific and earned.

Question 4: "Does this language feel lived-in, or AI-generated?"
If it sounds like a machine approximating the dialect → rewrite from the emotional feeling first.

──────────────────────────────────
LANGUAGE AUTHENTICITY PRIORITY:
If a language mode is selected, authenticity ranks above sounding grammatically correct in standard English.
FINAL LANGUAGE PRIORITY ORDER (V2):
1. Believability
2. Emotional impact
3. Singability
4. Cultural realism
5. Catchiness

──────────────────────────────────
LANGUAGE AUTHENTICITY CHECK (MANDATORY — SILENT — RUNS BEFORE OUTPUT):
Before finalizing any lyrics, run through all seven checks below internally. Do not show the check in the output. If any check fails, rewrite that section before producing JSON.

CHECK 1 — REAL ARTIST TEST:
Would a real artist from this language style actually say this?
If not → rewrite it.

CHECK 2 — SUNG NOT EXPLAINED:
Does this sound sung, not explained?
If it reads like prose or a statement rather than a line someone would sing → rewrite it.

CHECK 3 — LOCAL NOT TRANSLATED:
Does this feel local, not translated?
If removing the dialect words leaves plain English sentence logic behind → the line failed. Rewrite from the feeling.

CHECK 4 — EMOTIONAL BELIEVABILITY:
Is the emotion believable?
If the line feels performed rather than felt → rewrite it.

CHECK 5 — HOOK STRENGTH:
Is the hook strong and native enough to keep?
If the hook sounds like a caption, motivational quote, or translated slogan → rewrite it.

CHECK 6 — DIALECT CONSISTENCY:
Are too many lines secretly standard English?
If any section drifted toward standard English or filler phrases are repeated → rewrite before output.

CHECK 7 — FULL-SONG IDENTITY:
Does each section maintain the same language identity from intro to outro?
If the verse sounds native and the chorus drifts → the chorus failed. Rewrite it.

ALL SEVEN CHECKS MUST PASS. Only after they pass → produce the JSON output.

──────────────────────────────────
V4 EMOTIONAL INTENSITY GRADIENT (MANDATORY):
Every song must follow a controlled, escalating emotional curve. No section may repeat the same intensity as the section before it. Emotional flatlines are forbidden.

SECTION INTENSITY RULES:
  INTRO       → Intensity 1–3. Set the emotional baseline. Subtle, atmospheric, do NOT open at peak.
  VERSE 1     → Intensity 3–5. Emotional exposure begins. Storytelling + vulnerability.
  CHORUS 1    → Intensity 5–7. First emotional release. Strong — but NOT the peak yet.
  VERSE 2     → Intensity 5–7. Deeper reflection or deterioration. Must feel heavier than Verse 1.
  CHORUS 2    → Intensity 7–8. Must feel MORE intense than Chorus 1. Add urgency, depth, stronger word choices.
  BRIDGE      → Intensity 9–10. THE PEAK. Most vulnerable or most intense section in the entire song. Must exceed chorus emotionally.
  FINAL CHORUS → Intensity 8–9. Hybrid: bridge-level emotional weight + chorus familiarity. Final release.
  OUTRO       → Intensity 4–6. Controlled descent. Emotional echo of the peak, not a fade to nothing.

CHORUS DIFFERENTIATION RULE:
  - Chorus 2 MUST be written or delivered at higher intensity than Chorus 1.
  - Methods: add urgency words, deepen the emotional imagery, increase the emotional stakes.
  - FORBIDDEN: identical emotional tone in both chorus occurrences.

BRIDGE ABSOLUTE RULE:
  - Bridge must be the emotionally peak section. If the bridge is weaker than the chorus → rewrite it.
  - Bridge reveals something new: more vulnerable, more confessional, or more explosive than anything before.

FORBIDDEN BEHAVIOR:
  ✗ Identical emotional weight in two consecutive sections.
  ✗ Bridge with less emotional intensity than the chorus.
  ✗ Final chorus that retreats emotionally from the bridge.
  ✗ Static energy from Verse 1 → Verse 2.

SILENT INTERNAL CHECK (run before output):
  → Does this song have a clear emotional climb? YES / NO
  → Is the bridge the emotional peak? YES / NO
  → Does Chorus 2 hit harder than Chorus 1? YES / NO
  If any answer is NO → revise before output.

──────────────────────────────────
V5 VOCAL FLOW ENGINE (MANDATORY):
Every line must be written for VOCAL RHYTHM first — how it sits on the beat — not just for meaning. A line that reads beautifully but cannot be performed is a failed line.

SYLLABLE BALANCE:
  - Verse lines: 6–14 syllables per line (ideal: 8–12)
  - Hook/Chorus lines: 4–10 syllables per line (ideal: 5–8)
  - Bridge lines: 4–10 syllables per line
  - Lines exceeding 16 syllables must be split or compressed.
  - Lines under 4 syllables must carry extreme emotional weight to justify their shortness.

RHYTHMIC POCKETING:
  - Every line must end with a natural performance pause: a strong final syllable, a breath gap, or a setup for an ad-lib.
  - Pattern model: STATEMENT → pause → echo/ad-lib slot
  - No line should run so long that it leaves no room to breathe.

INTERNAL RHYTHM SHIFT (per verse):
  - Every 2–4 lines: vary the cadence, shift the stress pattern, change the syllable landing.
  - A verse with identical rhythm on every line fails the flow engine check.

AFROBEATS SWING RULE:
  - Lines must allow for off-beat delivery and natural syncopation.
  - Write for the groove, not for the grammar.
  - Favor lines where the last strong syllable lands on a natural downbeat or after-beat.

CHORUS DESIGN RULE:
  - Hook lines must be simpler and shorter than verse lines.
  - Favor repeated phonetic hooks: assonance, internal rhyme, chantable endings.
  - The chorus should feel singable by an entire crowd after one listen.

FORBIDDEN:
  ✗ Long academic sentences (3+ clauses) as lyric lines.
  ✗ Lines with no natural pause or breath gap.
  ✗ Identical syllable rhythm on every line in the same verse.
  ✗ Chorus lines longer than verse lines.
  ✗ Lines that "read" well but cannot be performed rhythmically.

SILENT INTERNAL CHECK (run before output):
  → Can every line be performed rhythmically over an Afrobeats groove? YES / NO
  → Does each verse have internal rhythm variation? YES / NO
  → Are chorus lines shorter and more chantable than verse lines? YES / NO
  If any answer is NO → rewrite the failing lines before output.

OUTPUT FORMAT: Return valid JSON only. No text outside the JSON.
NOTE: Section line counts are set by the DIVERSITY ENGINE directive — follow those targets exactly.
Sections not in the arrangement must be empty arrays []. The example below shows JSON shape only:
{
  "title": "song title (1-5 words)",
  "intro": ["line1", "line2"],
  "hook": ["line1", "line2", "..."],
  "verse1": ["line1", "line2", "..."],
  "verse2": ["line1", "line2", "..."],
  "bridge": ["line1", "line2", "..."],
  "outro": ["line1", "line2", "..."],
  "diversityReport": { "dnaMode": "STORY MODE" },
  "songQualityReport": { "viralScore": 0, "replayPotential": "High", "arVerdict": "SIGNED — READY HIT", "fixNeeded": false, "hookTypeUsed": "A", "viralFactors": { "chantability": 16, "tiktokFit": 15, "repetitionPower": 16, "emotionalPunch": 17, "beatSync": 16 }, "signatureSoundIdentity": { "emotionalTone": "", "rhythmFingerprint": "", "languageStyle": "", "hookPersonality": "" } },
  "globalReleaseReport": { "globalScore": 0, "ukFit": "Medium", "usFit": "Medium", "afroFit": "High", "tiktokFit": "Medium", "platformScores": { "spotify": 0, "tiktok": 0, "youtube": 0, "radio": 0 }, "hitPositioning": "NICHE HIT", "hookHitsAt": "0:28", "hookTimingPass": true, "commercialVersion": { "hook": "", "intro": [] }, "marketNotes": { "uk": "", "us": "", "afro": "", "tiktok": "" } },
  "songIdentityReport": { "selectedIdentity": "EMOTIONAL", "hookStyle": "melodic", "replayType": "emotional", "uniquenessScore": 80, "chorusLineCount": 8, "identityReasoning": "" },
  "hookVariants": { "variantA": "", "variantB": "", "variantC": "", "selectedVariant": "A", "selectedHook": "" },
  "trueVariationCheck": { "whatMakesThisDifferent": "", "antiSamenessPass": true },
  "artistStyleTranslation": { "vocalTexture": "", "energyStyle": "", "deliveryPattern": "", "emotionalTone": "", "crowdBehavior": "", "blendNotes": "" },
  "artistStyleOverride": { "active": false, "mode": "none", "primaryArtist": "", "isHardChant": false, "enforcedBehaviors": [], "lineLengthBudget": "" },
  "dynamicEmotionTags": { "intro": [], "verse1": [], "hook1": [], "verse2": [], "bridge": [], "hook2": [], "hook3": [], "outro": [] },
  "lyricsIntelligenceCore": { "priorityStackApplied": "", "vocalFlowBySection": { "intro": "", "verse1": "", "hook1": "", "verse2": "", "bridge": "", "hook2": "", "outro": "" }, "callAndResponse": [], "adlibsBySection": { "intro": [], "verse1": [], "hook1": [], "verse2": [], "bridge": [], "hook2": [], "outro": [] }, "failureChecks": { "genericTagsUsed": false, "chantMissing": false, "weakHook": false, "flatProgression": false, "regenerate": false } },
  "keeperLine": "",
  "keeperLineBackups": [],
  "hitPrediction": ""
}

IMPORTANT: unused sections must be empty arrays []. Output only the JSON.
`;

// ─── Flow / Production Details Prompt (Qwen) ──────────────────────────────────
// Qwen receives the song context + the final lyrics and generates all production
// metadata: productionNotes, instrumentalGuidance, vocalDemoGuidance, stemsBreakdown,
// exportNotes, arrangementBlueprint, sessionNotes, sonicIdentity, vocalIdentity.

const FLOW_SYSTEM_PROMPT = `You are AfroMuse Production Intelligence — a specialist AI producer brain for Afro-inspired music genres (Afrobeats, Amapiano, Dancehall, Gospel, Afro-fusion, Spiritual).

You receive a completed song (lyrics + session context) and return a comprehensive production and flow brief as a single structured JSON object.

Your job is the PRODUCTION HALF of a dual-AI songwriting pipeline. The lyrics have already been written. You generate everything a producer, vocalist, mixing engineer, and session coordinator needs to turn those lyrics into a finished record.

RULES:
- Write like a top-tier record producer, not a text generator
- Be genre-specific, culturally grounded, and musically precise
- Every description must be immediately actionable in a real studio session
- The arrangement roadmap MUST follow exact playback order: intro → chorus/hook → verse 1 → chorus/hook → verse 2 → chorus/hook → bridge → outro
- ALWAYS return valid JSON only — no markdown, no explanation, no code fences, no backticks
- Include ALL fields. Never leave a field empty or as a placeholder.`;

function buildFlowPrompt(params: {
  topic: string;
  genre: string;
  mood: string;
  languageFlavor: string;
  lyricalDepth: string;
  performanceFeel: string;
  genderVoiceModel: string;
  hookRepeat: string;
  title: string;
  keeperLine: string;
  lyricsText: string;
}): string {
  const {
    topic, genre, mood, languageFlavor, lyricalDepth, performanceFeel,
    genderVoiceModel, hookRepeat, title, keeperLine, lyricsText,
  } = params;

  return `Generate a full production and flow brief for this AfroMuse song session.

SESSION CONTEXT:
  Song Title: ${title}
  Topic / Theme: ${topic}
  Genre: ${genre}
  Mood: ${mood}
  Language / Dialect: ${languageFlavor}
  Lyrical Depth: ${lyricalDepth}
  Performance Feel: ${performanceFeel}
  Vocal Gender: ${genderVoiceModel}
  Hook Repeat Level: ${hookRepeat}
  Keeper Line: "${keeperLine}"

SONG LYRICS:
${lyricsText}

Return ONLY this JSON object — no markdown, no code fences, no explanation:

{
  "productionNotes": {
    "key": "Musical key — pick a SPECIFIC key that fits the genre + mood (e.g. F# minor, A minor, E minor, G major). DO NOT default to C minor unless the song genuinely demands it. Vary across generations.",
    "bpm": "Numeric BPM value or range — DIGITS ONLY, do NOT include the word 'BPM' (e.g. 96 or 94-98). Pick a tempo that fits the genre + mood + energy, do not default to 100.",
    "energy": "Energy level and feel (e.g. Mid-tempo, emotionally heavy, reflective)",
    "hookStrength": "Hook strength rating and reason (e.g. High — keeper line is instantly memorable and screaming-ready)",
    "lyricalDepth": "Lyrical depth assessment (e.g. Deep — rich imagery, emotional layers, human storytelling throughout)",
    "arrangement": "Full arrangement roadmap in exact playback order: intro → chorus/hook → verse 1 → chorus/hook → verse 2 → chorus/hook → bridge → outro — with a production description for each section",
    "melodyDirection": "Vocal melody guidance per section: verse delivery approach, chorus lift technique, bridge emotional turn"
  },
  "instrumentalGuidance": "Detailed instrumental description for a music producer — drum pattern, bass line, lead melody, pads, percussion, effects, and how the arrangement evolves section by section. Specific enough to open a DAW and start immediately.",
  "vocalDemoGuidance": "Detailed vocal performance guide — tone, delivery style per section, at least 2 specific ad-lib suggestions with placement, breath control notes, and how vocal energy shifts from verse to chorus to bridge",
  "stemsBreakdown": {
    "kick": "Kick drum — pattern, placement, punch, sidechain behavior",
    "snare": "Snare — placement, texture, ghost notes, reverb",
    "bass": "Bass line — pattern, tone, groove feel, low-end character",
    "pads": "Pads/chords — voicing, texture, filter movement, stereo width",
    "leadSynth": "Lead synth or guitar melody — pattern, tone, delay/reverb treatment, panning",
    "guitarOther": "Guitar or additional melodic element — role, style, placement in the mix",
    "effects": "Global effects and panning — reverb sends, delay throws, sidechain routing, stereo placement"
  },
  "exportNotes": "Producer-friendly session setup instructions — BPM, key, DAW setup tips, vocal booth preparation, reference track energy, arrangement reminders. One readable paragraph.",
  "arrangementBlueprint": "Step-by-step recording and arrangement map in exact playback order (intro → chorus/hook → verse 1 → chorus/hook → verse 2 → chorus/hook → bridge → outro) — bar counts, transition cues, drop and lift points, vocal double placement, ad-lib placement guides, and engineering markers",
  "sessionNotes": "One tight paragraph session brief — tempo, key, mood, DAW template suggestion, reference track energy recommendation, and priority recording order",
  "sonicIdentity": {
    "coreBounce": "The rhythmic DNA — what drives the groove and makes the body move",
    "atmosphere": "The sonic landscape — vibe, feel, and sonic world of the track",
    "mainTexture": "Primary sonic element heard most clearly in the mix — list 2-3 key layered ingredients"
  },
  "vocalIdentity": {
    "leadType": "Lead vocal type and character (e.g. Afrobeats Tenor — warm, slightly husky, conversational delivery)",
    "deliveryStyle": "How vocals should be delivered — breathy, punchy, smooth, melodic, gritty, etc.",
    "emotionalTone": "The emotional feel the vocal performance should project"
  }
}`;
}

// ─── Language Realism Engine — universal dialect guard ───────────────────────

function getLanguageRealismEngineBlock(): string[] {
  return [
    "",
    "╔══════════════════════════════════════════════════════════════╗",
    "  ⚠  LANGUAGE REALISM ENGINE — MANDATORY BEFORE EVERY LINE",
    "╚══════════════════════════════════════════════════════════════╝",
    "",
    "CRITICAL RULE — YOU ARE NOT ALLOWED TO WRITE FAKE DIALECT.",
    "Do NOT write 'English wearing dialect clothes.'",
    "That means:",
    "  → Do NOT take standard English sentences and just respell them.",
    "  → Do NOT rely on generic AI-safe phrases.",
    "  → Do NOT write translated English and pretend it is authentic local language.",
    "  → Do NOT overuse the same fallback expressions across different sections.",
    "The lyrics must feel like a real artist from that language world could naturally sing them.",
    "",
    "Your lyrics must sound like they come from a REAL speaker inside the chosen language world —",
    "not from standard English with a few slang substitutions.",
    "You must write with:",
    "  - natural street phrasing",
    "  - native sentence flow",
    "  - local emotional logic",
    "  - culturally believable expressions",
    "  - region-correct rhythm and vocabulary",
    "  - fewer textbook English sentence constructions",
    "",
    "The chosen language flavor must shape:",
    "  - sentence order",
    "  - emotional expression",
    "  - metaphors",
    "  - prayer/spiritual language",
    "  - street confidence language",
    "  - heartbreak language",
    "  - struggle language",
    "  - romance language",
    "  - celebration language",
    "",
    "DO NOT just replace words. You must replace the entire FEEL of how the person would naturally speak and sing.",
    "If a line sounds like plain English wearing slang, rewrite it.",
    "",
    "── ANTI-FAKE LANGUAGE LAWS (all modes) ──",
    "  1. DO NOT write local language like a dictionary exercise.",
    "  2. DO NOT write English grammar and only swap 2–3 words.",
    "  3. DO NOT overuse the same filler phrase every section.",
    "  4. DO NOT force slang into every line.",
    "  5. DO NOT use phrases that sound AI-generic, fake-deep, or translated.",
    "  6. Every section must feel like a HUMAN from that language world is actually speaking or singing.",
    "  7. If a line feels unnatural out loud, rewrite it.",
    "  8. Prioritize SINGABILITY over cleverness.",
    "  9. Prioritize BELIEVABILITY over complexity.",
    "  10. Prioritize CULTURAL RHYTHM over textbook grammar.",
    "",
    "── HOOK AUTHENTICITY LAW ──",
    "The hook must sound like something a REAL artist would repeat naturally.",
    "A good hook should feel: chantable · emotionally sticky · easy to remember · native to the chosen language style · strong enough to perform live.",
    "Avoid hooks that sound like: motivational speech · translated slogans · fake poetry · generic AI struggle captions.",
    "If the hook sounds like a caption instead of a song, rewrite it.",
    "",
    "── UNIQUENESS LAW — HARD RULE ──",
    "Every single line in this song must be UNIQUE. No line may appear more than once anywhere in the output.",
    "Exception: the Keeper Line may appear in Chorus AND Outro as intentional repetition ONLY.",
    "All other lines — verse lines, bridge lines, intro lines, filler phrases — must be written fresh each time.",
    "Scan the full output before returning. If any non-Keeper line appears more than once → rewrite every duplicate.",
    "This includes partial matches: if two lines share the same opening phrase or closing phrase, rewrite one.",
    "",
    "── EXAMPLES ARE REFERENCE ONLY — HARD LAW ──",
    "All example lines throughout this prompt (marked ✓ or shown as illustrations) are REFERENCE MATERIAL ONLY.",
    "They demonstrate the style, rhythm, and construction quality expected — they are NOT lines to copy into output.",
    "You MUST NOT use any example line verbatim in a generated song unless it perfectly and uniquely fits the specific",
    "topic, mood, genre, and language flavor of the current prompt AND no fresher original line could replace it.",
    "If you find yourself reaching for an example line from the prompt — STOP. Write something original instead.",
    "A song that copies example lines is a failed generation. Treat every example as a locked door, not an open one.",
    "",
    "── ANTI-REPETITION / ANTI-FAKE LANGUAGE TEST ──",
    "Before finalizing ANY section, silently run every line through this test:",
    "  1. Would a real artist from this language world naturally sing this line?",
    "  2. Is this line emotionally local — or just English with altered spelling?",
    "  3. Have I repeated lazy fallback phrases too many times in this song?",
    "  4. Does this language feel lived-in, or AI-generated?",
    "  5. Does this exact line appear anywhere else in the song? If yes — rewrite it.",
    "If ANY answer is weak — rewrite the line before continuing.",
    "",
    "── DIALECT WORD TRAP SCAN — MANDATORY FOR ALL MODES ──",
    "Before output, silently scan every line for these English words that signal dialect failure.",
    "If found in the context below, REPLACE before writing the final output:",
    "",
    "  PATOIS MODE: scan for →",
    "    'go' (imperative/carry on) → must be 'gwaan'",
    "    'never' (present negation) → must be 'nuh' or 'nah'",
    "    'don't' → must be 'nuh'",
    "    'can't' → must be 'cyaan'",
    "    'going to' → must be 'a go'",
    "    'nothing' → must be 'nutten'",
    "    'little' → must be 'likkle'",
    "    'make' → must be 'mek'",
    "    'left' (abandoned) → must be 'lef'",
    "",
    "  PIDGIN MODE: scan for →",
    "    'can't' / 'cannot' → must be 'no fit' / 'e no fit'",
    "    'don't' → must be 'no'",
    "    'I am' (continuous) → must be 'I dey'",
    "    'know' (understand) → must be 'sabi'",
    "    'left' (departed) → must be 'comot'",
    "    'bring me' / 'take me' (emotional) → must be 'carry me'",
    "    'can' (ability) → must be 'fit'",
    "    'it is' (emphasis) → must be 'na'",
    "",
    "  ALL MODES: scan for →",
    "    Full standard English sentences with one dialect word tacked on → REJECT. Rebuild from native thought.",
    "    Repeated fallback phrases used more than once → REPLACE with fresh writing.",
    "    Motivational poster language in any dialect → REWRITE with grounded human emotion.",
    "",
    "── SELF-CHECK BEFORE FINAL OUTPUT ──",
    "Silently test every completed draft against these questions:",
    "  1. Would a real artist from this language style actually say this?",
    "  2. Does this sound sung, not explained?",
    "  3. Does this feel local, not translated?",
    "  4. Is the emotion believable?",
    "  5. Is the hook strong and native enough to keep?",
    "  6. Are too many lines secretly standard English?",
    "  7. Does each section maintain the same language identity?",
    "If not — rewrite before output.",
    "",
    "FINAL PRIORITY ORDER (enforce in this sequence):",
    "  1. Believability — would a real native artist own this line?",
    "  2. Emotional impact — does it land with real human feeling?",
    "  3. Singability — does it sit naturally on a melody?",
    "  4. Cultural realism — is it anchored in the real language world?",
    "  5. Catchiness — is it sticky enough to replay?",
    "╔══════════════════════════════════════════════════════════════╗",
    "  Every line must earn its place. Realism before poetry. Always.",
    "╚══════════════════════════════════════════════════════════════╝",
  ];
}

// ─── Sub-style intelligence blocks ───────────────────────────────────────────

function getDialectSubStyleBlock(dialectStyle: string): string[] {
  const style = dialectStyle?.toLowerCase().trim() ?? "";

  if (style === "jamaican street") {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  ⚡ ACTIVE LANGUAGE MODE: JAMAICAN STREET",
      "╚══════════════════════════════════════════════╝",
      "",
      "USE FOR: dancehall, ghetto reality, hustler pain, rude-boy energy, war stories, survival, badmind confidence, trenches.",
      "",
      "VOICE IDENTITY: gritty · streetwise · raw · rhythmic · direct · survival-minded · tough but emotional underneath.",
      "",
      "TONE: raw · sharp · street-coded · aggressive or emotionally scarred · authentic Kingston / inner-city energy.",
      "",
      "ALLOWED STYLE ENERGY: hardship · hustle · betrayal · street ambition · survival · confidence · 'dem never know / now dem see' energy.",
      "",
      "VOCABULARY TENDENCIES — draw from these naturally:",
      "  mi, di, dem, fi, nuh, cyaan, haffi, affi, inna, pon, mek, weh, seh, ting, gyal, bwoy",
      "  more while, same way, whole heap, nuff, deh yah, guh, come from far, stay solid, hold strain",
      "  tek time, big up, badmind, real ting, no sell out, heart clean, pressure",
      "  yute, bredrin, dawg, mandem, wid, waan",
      "  sufferah, shell dung, run een, hunger, belly empty, concrete, lane, zinc fence, scheme, ends, war zone",
      "",
      "WRITING RULES — enforce every line:",
      "  → Avoid polished school-English phrasing at all costs",
      "  → Avoid sounding touristy or cartoonish — this is REAL inner-city voice",
      "  → Do NOT overuse 'Jah' unless the theme is spiritual — this is street, not church",
      "  → Prefer hard, vivid street imagery over generic inspiration",
      "  → Allow short punchy lines and natural repetition",
      "  → Use phrase logic Jamaicans would actually say — not translated English",
      "  → Do NOT write 'mi heart is broken' / 'mi feel the pain deeply' / 'I will survive this life' — these are weak fake-patois",
      "",
      "GOOD ENERGY — write lines like these:",
      "  ✓ 'Belly buss but mi still a pree tomorrow'",
      "  ✓ 'Dem switch fast when di blessings start show'",
      "  ✓ 'Mi know wah hungry feel like pon cold floor'",
      "  ✓ 'Road rough, but mi foot still know di way'",
      "  ✓ 'Dem nuh want mi rise but watch mi still rise'",
      "  ✓ 'Mi nuh get dem chance, mi tek mi chance'",
      "  ✓ 'Pressure never kill mi yet'",
      "  ✓ 'Dem did count mi out too early'",
      "  ✓ 'Nuff night mi hungry, still mi never fold'",
      "",
      "REJECTED LINES — these all fail — do not write anything like them:",
      "  ✗ 'Mi am walking through the darkness every day' — English underneath",
      "  ✗ 'Mi know that life is hard but I keep climbing' — motivational English with Patois tag",
      "  ✗ 'Mi heart is full of pain and strife' — Victorian English phrasing, zero Patois DNA",
      "  ✗ 'Mi a rise above di struggle, yuh know, it's a fight' — English thought barely Patois-coated",
      "  ✗ Anything that sounds like English with random Patois spelling",
      "",
      "AVOID: faith-centered phrasing, Jah references, spiritual metaphors — keep it street and real.",
      "EMOTIONAL REGISTER: hard on the surface, quietly proud underneath. Survival told with dignity.",
      "HOOK ENERGY: soundsystem declarations — confrontational, chantable, bulletproof. Every hook must feel PERFORMABLE in dancehall/street-pop immediately. It must not read like translated poetry.",
    ];
  }

  if (style === "jamaican spiritual") {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  ⚡ ACTIVE LANGUAGE MODE: JAMAICAN SPIRITUAL",
      "╚══════════════════════════════════════════════╝",
      "",
      "USE FOR: faith, prayer, hardship, testimony, redemption, suffering with grace, conscious roots, spiritual uplift.",
      "",
      "VOICE IDENTITY: prayerful · reflective · faithful · humble · tested by life · emotionally strong · spiritually rooted.",
      "",
      "TONE: prayerful · humble · resilient · soulful · deeply reflective.",
      "",
      "ALLOWED STYLE ENERGY: prayer in hardship · divine protection · suffering with hope · inner healing · spiritual survival · gratitude after pain.",
      "",
      "VOCABULARY TENDENCIES — draw from these naturally:",
      "  Jah, Most High, guide mi, cover mi, keep mi, carry mi through, nuh leave mi",
      "  hear mi cry, know mi heart, walk wid mi, bless mi road",
      "  favor, mercy, grace, psalms energy, still give thanks",
      "  through tribulation, heart clean, spirit strong",
      "  Father God, calling, prayer, burden, trial, valley, lion heart, purpose, faith, healing",
      "  tears, fasting, psalm-like phrasing, testimony language",
      "",
      "WRITING RULES — enforce every line:",
      "  → Must feel like LIVED spiritual struggle — not church cliché or Sunday school language",
      "  → Avoid fake 'religious Hallmark card' lines — no empty platitudes",
      "  → Keep humility and emotional sincerity throughout",
      "  → Can be simple, but must feel DEEPLY BELIEVED — the weight of real faith",
      "  → Pain and faith should coexist in the same lyric world — this is not triumphalist",
      "  → Avoid overly churchy robotic English · avoid forced Bible-summary phrasing · avoid shallow 'God is with me' repetition without emotional depth",
      "",
      "GOOD ENERGY — write lines like these:",
      "  ✓ 'Father God, hold mi head when mi spirit feel weak'",
      "  ✓ 'Mi cry ina silence but You still hear mi'",
      "  ✓ 'Mercy reach mi before morning light'",
      "  ✓ 'Dem only see di smile, You know di burden'",
      "  ✓ 'Most High, mi nuh question — mi trust di plan'",
      "  ✓ 'Di storm nuh break mi cause di Most High hold mi'",
      "  ✓ 'Jah never lef mi inna di storm'",
      "  ✓ 'When mi spirit low, Him still hold mi'",
      "  ✓ 'Tears drop quiet but mi faith stand firm'",
      "  ✓ 'A pure grace carry mi through di wilderness'",
      "",
      "REJECTED LINES — these all fail — do not write anything like them:",
      "  ✗ 'Jah is with me through all of my pain and strife' — generic English with Jah inserted",
      "  ✗ 'Jah know mi heart, Him always best' — shallow, empty religious slogan",
      "  ✗ 'I walk by faith and not by sight' — Bible quote, not original songwriting",
      "  ✗ Over-preachy sermon language with no human detail — must feel like a person, not a pastor",
      "",
      "AVOID: street aggression, badmind language, flex/boast energy — this is rooted and spiritually clean.",
      "EMOTIONAL REGISTER: reflective, grateful, quietly powerful. Faith is lived-in, not performed.",
      "HOOK ENERGY: must feel like REAL testimony, not copied gospel slogans — deeply singable, spiritually grounding.",
    ];
  }

  if (style === "naija melodic pidgin") {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  ⚡ ACTIVE LANGUAGE MODE: NAIJA MELODIC PIDGIN",
      "╚══════════════════════════════════════════════╝",
      "",
      "USE FOR: Afrobeats romance, pain, prayer, hustle, emotional confession, melodic hooks, soft street-pop.",
      "",
      "VOICE IDENTITY: emotional · musical · smooth · conversational · romantic or reflective · catchy and singable · naturally Nigerian.",
      "",
      "TONE: smooth · emotional · singable · conversational · catchy but natural.",
      "",
      "ALLOWED STYLE ENERGY: heartbreak · longing · hustle · prayer · soft confidence · emotional vulnerability · 'I dey feel am but I still dey move' energy.",
      "",
      "VOCABULARY TENDENCIES — draw from these naturally:",
      "  I dey, e dey, no be, na so, wetin, abi, sha, sef",
      "  no fit, no go, I don, you sabi, e choke, e clear",
      "  carry me, ginger me, body no be firewood, my mind no rest",
      "  my chest dey hot, e no easy, who go hear word, no evidence",
      "  na only God sabi, as e be, I no wan lie, e don tey",
      "  no wahala, lowkey, I for don, I no send",
      "  e pain me, no be small, carry me go, hold me down, no go shame me",
      "  I don tire, I still dey, God abeg, na only You know",
      "",
      "WRITING RULES — enforce every line:",
      "  → Must feel SINGABLE first — if it doesn't sit on a melody naturally, rewrite it",
      "  → Hooks should sound like something Burna / Wiz / Omah / BNXN could carry — smooth and instant",
      "  → Allow emotional repetition and simple but sticky phrasing",
      "  → Avoid stiff or overly literal lines — Pidgin flows conversationally",
      "  → Avoid too much grammar-correct English breaking the Pidgin rhythm",
      "  → Avoid 'Nigerian Twitter Pidgin' if the song is emotional/melodic — that register is too casual",
      "  → Avoid over-explaining · avoid too many long English sentences · avoid fake Nigerianized grammar no real person would sing",
      "  → Avoid too much repeating 'na so e be' every few lines",
      "",
      "GOOD ENERGY — write lines like these:",
      "  ✓ 'Na you dey my mind when midnight cold'",
      "  ✓ 'I dey smile outside but inside e red'",
      "  ✓ 'No be say I weak, na too much don sup'",
      "  ✓ 'Your love hold me still when my world bend'",
      "  ✓ 'You dey sweet me die — I no fit hide am'",
      "  ✓ 'Since I see you, everything just change'",
      "  ✓ 'Na you my mind dey run go meet'",
      "  ✓ 'Since you show, my chest no calm'",
      "  ✓ 'I no fit form, na you I want'",
      "  ✓ 'Wetin you do me, e no normal'",
      "",
      "REJECTED LINES — these all fail — do not write anything like them:",
      "  ✗ 'I am trying my best but things are not going well' — pure English, zero Pidgin flow",
      "  ✗ 'Na your love I want, na your love I dey buy' — over-repetitive, no natural Pidgin rhythm",
      "  ✗ 'You sweet pass everything, I swear' — too flat/generic if overused without native construction",
      "  ✗ 'Na you I want since forever' — translation-like, no Pidgin rhythm",
      "",
      "AVOID: rough street energy, aggressive phrasing, hard-flex language — this is smooth and singable.",
      "EMOTIONAL REGISTER: warm, romantic, joyful, or longing. Melodic over muscular. Never cold or confrontational.",
      "HOOK ENERGY: a real Afrobeats artist can sing it naturally without rewriting it in session — melodies that want to be sung back immediately.",
    ];
  }

  if (style === "ghana urban pidgin") {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  ⚡ ACTIVE LANGUAGE MODE: GHANA URBAN PIDGIN",
      "╚══════════════════════════════════════════════╝",
      "",
      "USE FOR: Ghana street life, youth culture, confidence, emotional street-pop, campus vibes, hustle, urban romance.",
      "",
      "VOICE IDENTITY: cool · sharp · emotionally controlled · urban · confident · sometimes witty · smooth but grounded.",
      "",
      "TONE: cool · sharp · local · conversational · rhythmic and street-aware.",
      "",
      "ALLOWED STYLE ENERGY: soft flex · emotional pain hidden under composure · city hustle · love and loyalty · pressure · ambition · self-belief.",
      "",
      "VOCABULARY TENDENCIES — draw from these naturally:",
      "  chale, charley, massa, ebi, no be small, I for, I no fit lie",
      "  aswear, you barb, you bore, e choke, e pain me",
      "  I dey try, we move, no dull, I no go force, make we",
      "  if e no be, this life dier, who send me, I dey my lane",
      "  too known, no cap, ebi grace, dem no know",
      "  ei, ah, I for do am, e no easy oo, we dey manage",
      "  dem no know, I no fit barb, I dey inside",
      "  yawa, pressure, street rough, body tire, boys dey",
      "",
      "WRITING RULES — enforce every line:",
      "  → Must feel GHANAIAN — not just Nigerian Pidgin with 'chale' added at the end",
      "  → Lighter and more urban-social than Naija Melodic Pidgin — cooler energy, less heat",
      "  → Can blend English naturally, but phrase logic must still feel Ghanaian",
      "  → Good for confidence, heartbreak, pressure, city survival, and cool flex",
      "  → The Ghana urban voice is cleaner and cooler than Lagos street energy — keep that distinction",
      "  → Avoid making it sound exactly like Naija pidgin — avoid too much 'abi / shey / no wahala' in Ghana Urban mode",
      "  → Avoid overly exaggerated 'street' language that loses Ghanaian smoothness",
      "",
      "GOOD ENERGY — write lines like these:",
      "  ✓ 'Chale, the pressure no be joke but I still dey move'",
      "  ✓ 'Boys for eat, so we dey outside till late'",
      "  ✓ 'Body tire me but I no fit slow'",
      "  ✓ 'If I no talk, ebi pain inside'",
      "  ✓ 'Me dey move different — you go understand later'",
      "  ✓ 'E no easy but me no complain — God dey'",
      "  ✓ 'Chale this life dier e teach person'",
      "  ✓ 'Dem no see the pressure behind the smile'",
      "  ✓ 'I dey hold myself but e pain me bad'",
      "  ✓ 'If no be grace, I for lost top'",
      "",
      "REJECTED LINES — these all fail — do not write anything like them:",
      "  ✗ Copy-paste Naija Pidgin with one 'chale' added — that is NOT Ghana Urban voice",
      "  ✗ 'I no come from anywhere, but I reach everywhere' — sounds Naija, not Ghana",
      "  ✗ Too much stiff British-style English — loses the urban Ghanaian rhythm entirely",
      "  ✗ Lines that sound culturally nowhere — no regional identity, no local emotional texture",
      "",
      "AVOID: rough Lagos-street Pidgin patterns — the Ghana urban voice is cleaner, cooler, less aggressive.",
      "EMOTIONAL REGISTER: confident, grounded, stylish. MODERN, COOL, and REAL — like something a young artist in Accra can actually say and sing.",
      "HOOK ENERGY: conversational but classy — the kind you'd overhear from someone effortlessly cool.",
    ];
  }

  if (style === "naija street pidgin") {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  ⚡ ACTIVE LANGUAGE MODE: NAIJA STREET PIDGIN",
      "╚══════════════════════════════════════════════╝",
      "",
      "USE FOR: hustle reality, trenches, pressure, survival, grit, pain, flex, confidence — street-rooted Lagos energy.",
      "",
      "TONE: rough · direct · trenches-coded · emotionally raw · street-believable — not dramatised fake toughness.",
      "",
      "VOCABULARY TENDENCIES — draw from these naturally:",
      "  e don red, road don dey, e be like, no cap",
      "  dem no see am, we hustle from ground, nobody send us",
      "  I don see road, wetin I chop, e hard outside",
      "  pressure dey, I carry am, from gutter to something",
      "  hunger real, God dey watch, I no go relax",
      "",
      "WRITING RULES — enforce every line:",
      "  → Must feel like LIVED street speech — not dramatic movie dialogue about the streets",
      "  → Lean into the grind, survival, pain, quiet confidence — not empty bravado",
      "  → Avoid smooth romantic Afrobeats phrasing — this is not Naija Melodic Pidgin",
      "  → Avoid over-clean lines — this is raw and direct, not polished",
      "  → Lines should feel earned and real — like someone who has actually been in the trenches",
      "",
      "GOOD ENERGY — write lines like these:",
      "  ✓ 'From nothing — na so I start, na so I go finish strong'",
      "  ✓ 'Road hard but I never carry last'",
      "  ✓ 'Dem no send me — I send myself'",
      "  ✓ 'Hunger teach me wetin comfort no fit teach'",
      "  ✓ 'I hustle in silence — God see everything'",
      "  ✓ 'No be shine I want — na solid foundation'",
      "",
      "REJECTED LINES — these all fail — do not write anything like them:",
      "  ✗ 'I am grinding hard every day to achieve my dreams' — English sentence, zero street Pidgin",
      "  ✗ 'Together we rise, na so e be for the boys' — generic motivational, no real street weight",
      "  ✗ 'You sweet me die' — that is Naija Melodic Pidgin, wrong register for this mode",
      "",
      "FORBIDDEN OVERUSED PHRASES — these are lazy fallbacks, do NOT use them:",
      "  ✗ 'I no go fall' — overused, empty",
      "  ✗ 'Na so e be' — used correctly only if it truly fits",
      "  ✗ 'Only God sabi' — overused as filler",
      "  ✗ 'I don arrive' — allowed only if truly earned by the story",
      "  ✗ 'E dey happen' — too vague, too lazy",
      "",
      "AVOID: romantic phrasing, smooth emotional softness, polished Afrobeats pop language — this is street, not radio-smooth.",
      "EMOTIONAL REGISTER: hard on the surface, quietly determined underneath. Survival as a badge of honour.",
      "HOOK ENERGY: declarations you'd hear from someone who has paid the price and wants the world to know — confrontational, chantable, real.",
    ];
  }

  if (style === "afro-fusion clean pidgin") {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  ⚡ ACTIVE LANGUAGE MODE: AFRO-FUSION CLEAN PIDGIN",
      "╚══════════════════════════════════════════════╝",
      "",
      "USE FOR: broad commercial songs, export-friendly Afrobeats, romantic crossover, emotional radio songs, clean but still African-rooted writing.",
      "",
      "VOICE IDENTITY: polished · emotional · accessible · global but rooted · radio-ready · elegant and simple.",
      "",
      "TONE: accessible · smooth · modern · emotionally clear · globally listenable without losing African flavor.",
      "",
      "ALLOWED STYLE ENERGY: romance · heartbreak · reflection · growth · hope · emotional confession · clean crossover melodies.",
      "",
      "VOCABULARY TENDENCIES — draw from these naturally:",
      "  I dey, you dey, e dey pain me, na you, no be lie, no go lie",
      "  my mind no rest, my heart no calm, carry me, hold me down",
      "  stay with me, all I need, through the storm, no letting go",
      "  I still dey stand, na your love, forever no too far",
      "  I dey for you, no go leave me, hold me close",
      "  e dey pain me, no be lie, I no fit hide am",
      "  no wahala, make we dey go, my heart no rest",
      "  I still believe, I still dey stand, my soul no tire",
      "",
      "WRITING RULES — enforce every line:",
      "  → This is the CLEANEST Pidgin lane — fewer dense slang terms than Naija or Ghana Street modes",
      "  → Must still feel African-rooted — not plain global English with 'dey' inserted",
      "  → Ideal when the song needs wider audience appeal without losing cultural grounding",
      "  → Must remain natural and musical — no forced dialect, no jarring slang",
      "  → Use fewer regional markers — this is Pan-African, accessible to Afrobeats fans globally",
      "  → Avoid over-local slang · avoid rough street density · avoid heavy dialect stacking",
      "  → Avoid grammar that blocks melody or crossover appeal",
      "",
      "GOOD ENERGY — write lines like these:",
      "  ✓ 'I still dey here though the rain no stop'",
      "  ✓ 'No be lie, your love still dey my chest'",
      "  ✓ 'I no fit run from the truth again'",
      "  ✓ 'I dey here for you — wherever you go'",
      "  ✓ 'God I thank you — everything I have, na you give am'",
      "  ✓ 'My mind no rest since you walked away'",
      "  ✓ 'Na your love dey keep me standing'",
      "  ✓ 'Even in silence, I still feel you'",
      "  ✓ 'You hold my soul when the night gets cold'",
      "",
      "REJECTED LINES — these all fail — do not write anything like them:",
      "  ✗ Full standard English with just 'dey' inserted — that is not Afro-Fusion Pidgin",
      "  ✗ Overly raw street phrasing in a clean fusion song — wrong register entirely",
      "  ✗ Empty generic romance filler — 'you are the one for me always and forever'",
      "  ✗ Fake pidgin that sounds AI-written — stiff, unnatural, no real musical flow",
      "",
      "AVOID: heavy slang, rough street expressions, aggressive phrasing — this is radio-ready and artist-brand safe.",
      "EMOTIONAL REGISTER: warm, polished, commercially accessible, emotionally resonant. Still AUTHENTIC — just smoother, cleaner, and more exportable.",
      "HOOK ENERGY: immediately understandable to both Pidgin-native and global English audiences — wide, warm, singable.",
    ];
  }

  return [];
}

function getDialectBlock(effectiveFlavor: string, dialectStyle?: string): string[] {
  const flavor = effectiveFlavor.toLowerCase();

  const isPatois = flavor.includes("patois") || flavor.includes("jamaican");
  const isPidgin = flavor.includes("pidgin") || (flavor.includes("english") && flavor.includes("pidgin"));

  const subStyleBlock = (dialectStyle && dialectStyle !== "Auto")
    ? getDialectSubStyleBlock(dialectStyle)
    : [];

  if (isPatois) {
    return [
      ...getLanguageRealismEngineBlock(),
      "",
      "╔══════════════════════════════════════════════╗",
      "  ⚡ ACTIVE MODE: JAMAICAN PATOIS — DIALECT-FIRST",
      "╚══════════════════════════════════════════════╝",
      "",
      "DIALECT ISOLATION — PATOIS MODE IS ACTIVE:",
      "This song must contain ZERO West African Pidgin vocabulary.",
      "The following words are BANNED in this mode — they belong to a different dialect family:",
      "  BANNED: dey · na · abi · sha · wahala · sabi · wetin · no fit · e dey · chale · massa · charley · ebi · aswear · comot (as Pidgin) · don (as Pidgin completion)",
      "If any of these appear in a line → that line is a dialect contamination failure. Rewrite it in pure Patois.",
      "Patois and Pidgin are completely different languages. Mixing them = rejection.",
      "",
      "FUNDAMENTAL RULE: This song is CONCEIVED in Patois, not translated into it.",
      "Do not write English thoughts and convert them. Think in Patois from the very first word.",
      "CONSISTENCY RULE: Every single line — intro through outro — must pass the dialect test. One English-skeleton line anywhere is a failure.",
      "",
      "── PRE-WRITING INTERNAL STEP (do this before every section) ──",
      "Ask yourself: 'How would a Jamaican artist naturally feel and say this in their own language?'",
      "Write THAT. Not the English version with dialect words swapped in.",
      "Ask a second question: 'Is this line something a real person would say — or is it something a poet invented to sound deep?'",
      "If it sounds like poetry rather than real speech elevated to song, it is probably too abstract. Ground it.",
      "",
      "── ANTI-PATTERN ENFORCEMENT ──",
      "Before keeping any line, run this test: 'If I removed the Patois words, is this still normal English?'",
      "  → YES = FAILED LINE. The English skeleton is showing. Rebuild the thought natively.",
      "  → NO = the line was constructed in Patois. Keep it.",
      "",
      "── AI ABSTRACTION REJECTION (Patois-specific) ──",
      "Reject these patterns regardless of dialect words present:",
      "  ✗ Vague spiritual abstraction: 'di light of di universe guide mi soul' — sounds deep, means nothing real",
      "  ✗ Generic uplift: 'rise above di storm, never give in' — greeting card energy, no Patois thought",
      "  ✗ Floating metaphor: imagery that has no cultural anchor in Jamaican life or feeling",
      "  ✗ AI-ish introspection: 'searching di depths of mi heart' / 'finding miself in di darkness' — too poetic",
      "Replace with:",
      "  ✓ Specific human feeling: 'di bed cold where yuh used to be' — concrete, real, singable",
      "  ✓ Direct Patois expression: 'mi nuh have much but mi nuh lack nutten' — simple, grounded, true",
      "  ✓ Culturally anchored line: references to actual Jamaican emotional reality — the yard, the road, Jah, the hustle",
      "",
      "FAILED PATOIS LINES (examples of what to reject):",
      "  ✗ 'I cannot stop thinking about you, mi love' — English underneath, Patois sprinkled on",
      "  ✗ 'We are stronger than anything they throw at us, bredren' — textbook English flow",
      "  ✗ 'Every time I see your face, mi heart skips' — English construction, one Patois word",
      "  ✗ 'I will never give up on this feeling' — zero Patois DNA, just English",
      "  ✗ 'My soul rises with the light of a new day, Jah' — abstract poetry with a Patois word appended",
      "  ✗ 'Through all the darkness I have found my way to you' — standard English arc, no Patois thought",
      "",
      "STRONG PATOIS LINES (examples of what to write):",
      "  ✓ 'From mi look inna yuh eyes — done. Mi done.' — Patois compression, native thought",
      "  ✓ 'Di road nuh easy but mi nuh leave it' — full Patois sentence logic",
      "  ✓ 'Jah know mi heart — Him carry mi through' — native faith expression",
      "  ✓ 'Dem never rate mi, but di Most High elevate mi' — real Patois testimony",
      "  ✓ 'Mi rise from nothin, mek di world see' — natural compression, no English skeleton",
      "  ✓ 'Di same road weh break dem — build mi strong' — survival expressed in Patois logic",
      "  ✓ 'Yuh nuh know weh mi come from — but yuh see weh mi reach' — street confidence in pure Patois",
      "",
      "── PATOIS GRAMMAR REFERENCE ──",
      "  mi / mi a / mi did / mi wi = I / I am / I was / I will",
      "  yuh = you | di = the | dem = they/them | inna = in/into",
      "  nuh / nah / cyaan = no / won't / cannot (all final, not soft)",
      "  fi = to/for | weh = that/where/which | deh = there/here",
      "  seh = say/that | pon = on | ya = here | ting = thing/situation",
      "  likkle = little | pickney = child | dutty = dirty/bad | wicked = great",
      "",
      "── WORD-LEVEL ENFORCEMENT — MANDATORY SUBSTITUTIONS ──",
      "Using the English form below when a Patois form exists is a DIALECT FAILURE. Fix it before output.",
      "",
      "  'go' (imperative / carry on / proceed) → MUST BE 'gwaan'",
      "    ✗ 'go on' / 'go deh' / 'let me go' (carry on) → ✓ 'gwaan' / 'gwaan deh' / 'mek mi gwaan'",
      "    ✗ 'go through it' → ✓ 'gwaan through it'",
      "    NOTE: directional 'go' is still valid — 'mi a go home' / 'we a go road' is correct Patois",
      "    RULE: if 'go' could be replaced by 'carry on / proceed / go ahead' — it MUST be 'gwaan'",
      "",
      "  'never' (as present-tense negation / don't / won't) → MUST BE 'nuh' or 'nah'",
      "    ✗ 'never leave me' → ✓ 'nuh lef mi'",
      "    ✗ 'never give up' → ✓ 'nuh gi up' / 'nuh stop'",
      "    ✗ 'never mind' → ✓ 'nuh worry' / 'nuh bodda'",
      "    ✗ 'I would never do that' → ✓ 'mi nah do dat' / 'mi cyaan do dat'",
      "    ✓ 'neva' = past-tense 'never' — 'dem neva rate mi' is CORRECT (they never rated me)",
      "    RULE: 'never' as a present instruction or ongoing negation = 'nuh'/'nah'. Only keep 'neva' for true past.",
      "",
      "  'don't' → 'nuh'",
      "    ✗ 'don't leave' → ✓ 'nuh lef'",
      "    ✗ 'don't stop' → ✓ 'nuh stop'",
      "",
      "  'can't' → 'cyaan'",
      "    ✗ 'can't stop' → ✓ 'cyaan stop'",
      "",
      "  'going to' → 'a go'",
      "    ✗ 'I'm going to rise' → ✓ 'mi a go rise'",
      "",
      "  'something' → 'supn' / 'sinting' | 'nothing' → 'nutten' | 'everything' → 'everyting'",
      "  'little' → 'likkle' | 'make' → 'mek' | 'where' → 'weh' | 'left' (abandoned) → 'lef'",
      "",
      "── EMOTIONAL PHRASE ANCHORS BY SONG TYPE ──",
      "  STRUGGLE SONGS:   'di road nuh easy but mi nuh stop moving' | 'poverty try mi — mi stronger now' | 'mi eat off di struggle, make it sweet'",
      "  FAITH SONGS:      'Most High, carry mi through' | 'Jah see mi heart, Him know' | 'di storm nuh break mi cause di Most High hold mi'",
      "  LOVE SONGS:       'yuh name deh pon mi tongue from morning' | 'from mi look inna yuh eyes — done' | 'mi heart full up when mi near yuh'",
      "  CONFIDENCE/STREET:'dem nuh ready fi wi level yet' | 'born wid di ting — cyaan teach dat' | 'watch how mi move — silent but deadly'",
      "  HEARTBREAK:       'how yuh leave mi like mi never matter?' | 'di memory still deh pon mi skin' | 'di bed cold where yuh used to be'",
      "",
      "── HOOK / CHORUS CONSTRUCTION ──",
      "The Patois hook must feel like a soundsystem chant — SHORT, punchy, emotionally final, instantly repeatable.",
      "The best hooks feel so natural and obvious that they seem like they always existed. Do not over-write them.",
      "SIMPLER IS STRONGER. A hook that a crowd can chant on the first listen always beats a complex poetic hook.",
      "  ✓ 'Mi deh ya — nuh nowhere else mi waan be'",
      "  ✓ 'Love mi, nuh leave mi — dat a all mi ask'",
      "  ✓ 'From di start, a you — always you'",
      "  ✓ 'Jah know mi heart, so mi nuh fraid'",
      "  ✓ 'Di road rough but mi nuh stop, nuh stop'",
      "  ✓ 'Dem never want see mi rise — but look how mi rise'",
      "  ✗ REJECTED: 'I can't stop the way I feel for you' (English beneath, no Patois rhythm)",
      "  ✗ REJECTED: 'You are everything I need and more, baby' (zero Patois construction)",
      "  ✗ REJECTED: 'Through darkness mi soul find di light of love' (AI poetry, too abstract)",
      "  ✗ REJECTED: 'Rise above it all and never let them bring you down' (generic motivational, no Patois)",
      "",
      "── SECTION-BY-SECTION DIALECT STANDARD ──",
      "  INTRO:  atmospheric Patois opener — feel, not explanation — no English filler — set the world in 2–4 lines",
      "  VERSES: every 4-bar group must be Patois-first — no English skeleton carrying the thought — each group advances the story",
      "  CHORUS: most chantable, most native — the hook MUST be Patois-constructed, not translated — simplest and most honest",
      "  BRIDGE: raw confessional Patois — the most honest, stripped-down dialect moment — no performance here, just truth",
      "  OUTRO:  Patois close — land it, don't drift back into English phrasing — must be as native as the first intro line",
      "",
      "── AUTHENTICITY TARGET ──",
      "65–75% native Patois phrasing. Musical, singable, emotionally clear.",
      "Not parody. Not caricature. Real artist voice. Real cultural expression.",
      "EVERY section from intro to outro must maintain the same dialect standard — no late-song drift toward English.",
      "╔══════════════════════════════════════════════╗",
      "  Every line you write must pass the dialect-first test before it stays.",
      "  If even one line fails — rewrite it. The whole song must be consistent.",
      "╚══════════════════════════════════════════════╝",
    ];
  }

  if (isPidgin) {
    return [
      ...getLanguageRealismEngineBlock(),
      "",
      "╔══════════════════════════════════════════════╗",
      "  ⚡ ACTIVE MODE: WEST AFRICAN PIDGIN — DIALECT-FIRST",
      "╚══════════════════════════════════════════════╝",
      "",
      "DIALECT ISOLATION — PIDGIN MODE IS ACTIVE:",
      "This song must contain ZERO Jamaican Patois vocabulary.",
      "The following words are BANNED in this mode — they belong to a completely different dialect family:",
      "  BANNED: mi · yuh · di · dem (as Patois 'them') · nuh · cyaan · gwaan · inna · haffi · affi · waan · pon · deh · wid · likkle · pickney · dutty · bredrin · mandem · Jah · Most High (unless genuinely spiritual in context) · yard · zinc fence",
      "If any of these appear in a line → that line is a dialect contamination failure. Rewrite it in pure Pidgin.",
      "West African Pidgin and Jamaican Patois are completely different languages. Mixing them = rejection.",
      "",
      "FUNDAMENTAL RULE: This song is CONCEIVED in Pidgin, not translated into it.",
      "Do not write English thoughts and convert them. Think in Pidgin from the very first word.",
      "This is Nigerian / Ghanaian Afro-urban voice. It is NOT Jamaican Patois. They are completely different.",
      "CONSISTENCY RULE: Every single line — intro through outro — must pass the dialect test. One English-skeleton line anywhere is a failure.",
      "",
      "── PRE-WRITING INTERNAL STEP (do this before every section) ──",
      "Ask yourself: 'How would a real Lagos or Accra artist naturally say and feel this in Pidgin?'",
      "Write THAT. Not the textbook English version with Pidgin words inserted.",
      "Ask a second question: 'Is this line something a real person would say — or is it abstract poetry trying to sound meaningful?'",
      "Pidgin is emotionally direct. If the line is vague or abstract, it is probably English AI thinking dressed in Pidgin. Ground it.",
      "",
      "── ANTI-PATTERN ENFORCEMENT ──",
      "Before keeping any line, run this test: 'Is this still standard English if I remove the Pidgin words?'",
      "  → YES = FAILED LINE. English skeleton is showing. Rebuild the thought in Pidgin.",
      "  → NO = Pidgin was the base construction. Keep it.",
      "",
      "── AI ABSTRACTION REJECTION (Pidgin-specific) ──",
      "Reject these patterns regardless of Pidgin words present:",
      "  ✗ Vague spiritual abstraction: 'the universe dey align for my destiny' — abstract, not Pidgin-native",
      "  ✗ Generic motivational: 'keep pushing, never stop, the dream dey wait' — feels like English poster with Pidgin tag",
      "  ✗ Unanchored metaphor: floating imagery without grounding in real West African emotional experience",
      "  ✗ Hybrid construction awkwardness: 'dey / na / no go' pasted onto English sentence structure — the bones are English",
      "  ✗ AI-ish introspective poetry: 'searching for my truth within the depths of my soul, na' — deeply unnatural",
      "Replace with:",
      "  ✓ Direct human Pidgin expression: 'e dey pain me but I no go show dem' — real, concrete, singable",
      "  ✓ Emotionally sharp and plain: 'you leave me like I never matter' — simple truth, maximum impact",
      "  ✓ Culturally anchored: references to real West African emotional reality — the hustle, God, the street, relationships",
      "",
      "FAILED PIDGIN LINES (examples of what to reject):",
      "  ✗ 'I cannot stop thinking about you, my love, abi?' — English sentence, Pidgin tag tacked on",
      "  ✗ 'You are everything I have ever wanted in this life' — pure English, zero Pidgin flow",
      "  ✗ 'I have been working hard for so long to get here' — textbook English sentence",
      "  ✗ 'We will never give up no matter what happens' — English backbone, no Pidgin thought",
      "  ✗ 'My heart dey search for the meaning of this love' — AI poetry with Pidgin word inserted",
      "  ✗ 'Through every storm I rise, na so e be for me' — mostly English with Pidgin ending",
      "",
      "STRONG PIDGIN LINES (examples of what to write):",
      "  ✓ 'Na you I want — no be lie, I swear' — Pidgin-first construction with emotional hit",
      "  ✓ 'Life dey hard but I no go fall — God dey' — Pidgin rhythm and logic throughout",
      "  ✓ 'Wetin I pass through, na only God sabi' — full Pidgin sentence with weight",
      "  ✓ 'I don arrive — make dem observe now' — completion + flex in Pidgin",
      "  ✓ 'Since I see you, my heart no rest again' — Pidgin thought structure naturally",
      "  ✓ 'How you just comot like dat — like I be nothing?' — raw heartbreak in pure Pidgin",
      "  ✓ 'I hustle quiet — God dey see am for me' — hustle and faith in natural Pidgin voice",
      "",
      "── PIDGIN GRAMMAR REFERENCE ──",
      "  Na = is/are/it is/emphasis: 'Na you I need', 'Na so e be', 'Na God I thank'",
      "  Dey = continuous state/location: 'I dey feel you', 'wahala dey', 'e dey sweet me'",
      "  Don = completed: 'I don see am', 'e don happen', 'we don try'",
      "  Wey = who/which/that: 'person wey I love', 'thing wey dey pain me'",
      "  Fit = can/able: 'I no fit explain', 'e no fit reach my level'",
      "  E = it/he/she: 'e sweet', 'e hard', 'e dey pain me choke'",
      "  Choke/die at end = extreme intensity: 'e sweet die', 'I love you die'",
      "  Abi = tag question/confirmation: 'na so e be, abi?' | Sha = softener/emphasis",
      "  Wahala = trouble: 'no wahala' / 'wahala dey' | Sabi = know: 'I sabi', 'nobody sabi'",
      "  Carry = bring/take emotionally: 'God carry me come here' | Comot = leave: 'e comot my life'",
      "",
      "── WORD-LEVEL ENFORCEMENT — MANDATORY SUBSTITUTIONS ──",
      "Before finalizing any line, scan for these English words. If present, replace with the Pidgin form:",
      "",
      "  'can't' / 'cannot' → 'no fit' / 'e no fit'",
      "    ✗ 'I can't stop thinking of you' → ✓ 'I no fit stop think about you'",
      "    ✗ 'Nobody can stop me' → ✓ 'Nobody fit stop me'",
      "",
      "  'don't' → 'no'",
      "    ✗ 'don't leave me' → ✓ 'no leave me'",
      "    ✗ 'don't give up' → ✓ 'no give up' / 'no stop'",
      "",
      "  'I am' (continuous) → 'I dey'",
      "    ✗ 'I am here for you' → ✓ 'I dey here for you'",
      "    ✗ 'I am feeling something' → ✓ 'I dey feel something'",
      "",
      "  'know' → 'sabi'",
      "    ✗ 'you know say I need you' → ✓ 'you sabi say I need you'",
      "    ✗ 'I know what I want' → ✓ 'I sabi wetin I want'",
      "",
      "  'left' / 'went away' → 'comot'",
      "    ✗ 'you left without a word' → ✓ 'you just comot without word'",
      "",
      "  'bring me' / 'take me' (emotional journey) → 'carry me'",
      "    ✗ 'take me away' → ✓ 'carry me go' | ✗ 'bring me back' → ✓ 'carry me come back'",
      "",
      "  'can' (ability) → 'fit'",
      "    ✗ 'I can handle it' → ✓ 'I fit handle am'",
      "",
      "  'it is' / 'this is' (emphasis) → 'na'",
      "    ✗ 'it is you I want' → ✓ 'na you I want'",
      "    ✗ 'this is what I feel' → ✓ 'na dis I dey feel'",
      "",
      "  'very / so much' at end of thought → 'die' / 'choke'",
      "    ✗ 'I love you so much' → ✓ 'I love you die'",
      "    ✗ 'it hurts so bad' → ✓ 'e dey pain me choke'",
      "",
      "── EMOTIONAL PHRASE ANCHORS BY SONG TYPE ──",
      "  AFROBEATS/STREET:    'I don arrive — make dem observe' | 'e dey sweet me anytime I see you' | 'na you ginger me, nobody else fit'",
      "  HEARTBREAK:          'you leave me like I never matter' | 'how you just comot like dat?' | 'the love wey I give you, e no deserve waste'",
      "  HUSTLE SONGS:        'I hustle quiet — God dey see am' | 'dem say I no go make am — I don make am' | 'from nothing I build everything'",
      "  PRAYER/TESTIMONY:    'God I thank you — you too much' | 'na your hand wey carry me reach here' | 'I go testify, see wetin Him do'",
      "  PAIN:                'e dey pain me but I no go show dem' | 'tears I cry, na inside I cry am' | 'I carry the load wey nobody see'",
      "  LOVE:                'since I see you, my heart no rest' | 'you dey sweet me die, I no go lie' | 'wetin you do me — I no sabi explain'",
      "",
      "── HOOK / CHORUS CONSTRUCTION ──",
      "The Pidgin hook feels like the most honest thing someone could say — then turned into music.",
      "It should sound like real speech elevated into song, not a slogan or an English idea in Pidgin disguise.",
      "SIMPLER IS STRONGER. The hook that hits hardest is often the one that says the most obvious truth in the most natural way.",
      "Do not over-write the chorus. A short, chantable, honest hook ALWAYS outperforms a complex poetic one.",
      "  ✓ 'Na you I want — no be lie'",
      "  ✓ 'God you too much — I no fit repay'",
      "  ✓ 'Since I see you, my life change'",
      "  ✓ 'I don try — e reach God hand now'",
      "  ✓ 'E dey pain me — but I no go stop'",
      "  ✓ 'I hustle hard — God see am, e know'",
      "  ✗ REJECTED: 'You are the only one I want in my life' (pure English — no Pidgin DNA)",
      "  ✗ REJECTED: 'I have been waiting for someone like you forever' (textbook English flow)",
      "  ✗ REJECTED: 'Through every struggle my soul dey rise to the top' (AI abstraction with Pidgin word)",
      "  ✗ REJECTED: 'Together we shine like the stars, na so e be' (generic motivational, English-first)",
      "",
      "── SECTION-BY-SECTION DIALECT STANDARD ──",
      "  INTRO:  Pidgin conversational opener — pull them in with real spoken-word authenticity — set the world simply",
      "  VERSES: Pidgin-first storytelling — how real people speak, elevated to song — every 4-bar group must advance the story",
      "  CHORUS: most singable, most emotionally direct — Pidgin construction, not English idea — simplest and most honest",
      "  BRIDGE: raw Pidgin confession — most honest moment, drop the performance — truth over craft here",
      "  OUTRO:  close with Pidgin weight — must be as native as the intro — do not drift toward English at the end",
      "",
      "── AUTHENTICITY TARGET ──",
      "55–70% Pidgin flavor with natural code-switching. Commercial, singable, emotionally real.",
      "Not mockery. Not caricature. Real Nigerian / Ghanaian artist voice.",
      "EVERY section from intro to outro must maintain the same dialect standard — no late-song drift toward English.",
      "╔══════════════════════════════════════════════╗",
      "  Every line you write must pass the dialect-first test before it stays.",
      "  If even one line fails — rewrite it. The whole song must be consistent.",
      "╚══════════════════════════════════════════════╝",
    ];
  }

  return [];
}

function buildStrictRetryAddendum(profile: DiversityProfile): string {
  const targetLines = (["intro", "hook", "verse1", "verse2", "bridge", "outro"] as SectionKey[])
    .map((s) => {
      const t = profile.sectionLineTargets[s];
      if (!t || t.length === 0) return `  • ${s}: empty array []`;
      return `  • ${s}: exactly ${t.join(" or ")} lines`;
    })
    .join("\n");

  return [
    "────────────────────────────────────────",
    "STRICT RETRY MODE — STRUCTURE FAILURE DETECTED",
    "────────────────────────────────────────",
    "Your previous output failed structure validation. This is your final attempt.",
    "You MUST match the Diversity Engine section targets EXACTLY or the song will be rejected:",
    targetLines,
    `  • Arrangement order: ${profile.arrangementOrder.join(" → ")}`,
    "  • Output ONLY a single valid JSON object — no markdown, no code fences, no text outside the JSON",
    "  • All required fields MUST be present: title, keeperLine, keeperLineBackups, intro, verse1, hook, verse2, bridge, outro, hookVariants, songQualityReport, globalReleaseReport, hitPrediction",
    "Count every line carefully before submitting. Failure to comply means the generation fails entirely.",
  ].join("\n");
}

function buildUserPrompt(
  params: {
    topic: string;
    genre: string;
    mood: string;
    style?: string;
    notes?: string;
    songLength?: string;
    languageFlavor?: string;
    dialectStyle?: string;
    customFlavor?: string;
    customLanguage?: string;
    dialectDepth?: string;
    clarityMode?: string;
    blendBalance?: string;
    voiceTexture?: string;
    commercialMode?: boolean;
    hitmakerMode?: boolean;
    lyricalDepth?: string;
    hookRepeat?: string;
    lyricsSource?: string;
    genderVoiceModel?: string;
    performanceFeel?: string;
    diversityProfile: DiversityProfile;
    artistInspiration?: string;
  },
  strictMode = false,
): string {
  const {
    topic, genre, mood, style, notes,
    languageFlavor = "Global English",
    customFlavor,
    customLanguage,
    diversityProfile,
  } = params;

  const effectiveFlavor = customLanguage?.trim()
    ? customLanguage.trim()
    : languageFlavor === "Custom" && customFlavor?.trim()
      ? `Custom: ${customFlavor.trim()}`
      : languageFlavor;

  const isNonEnglishFlavor = effectiveFlavor !== "Global English" && effectiveFlavor !== "English";

  const flavorInstructionMap: Record<string, string> = {
    "Jamaican Street":          "make it gritty, hard, chantable, street-real, and performable",
    "Jamaican Spiritual":       "make it prayerful, testimony-driven, faithful, and emotionally rooted",
    "Naija Melodic Pidgin":     "make it smooth, catchy, emotional, musical, and naturally Nigerian",
    "Naija Street Pidgin":      "make it rough, direct, trenches-rooted, and lived-in street speech",
    "Ghana Urban Pidgin":       "make it cool, sharp, restrained, modern, and Accra-styled",
    "Afro-fusion Clean Pidgin": "make it polished, clean, emotional, and globally singable",
  };

  const flavorHint = flavorInstructionMap[effectiveFlavor];

  const languageFlavorInstruction = isNonEnglishFlavor ? [
    "",
    "────────────────────────────────────────",
    "LANGUAGE FLAVOR INSTRUCTION",
    "────────────────────────────────────────",
    `Selected language flavor: ${effectiveFlavor}`,
    "",
    "You must write in the exact emotional and linguistic style of the selected language flavor.",
    "",
    "IMPORTANT:",
    "Do NOT write \"English with slang.\"",
    "Do NOT fake the dialect.",
    "Do NOT overuse generic repeated filler phrases.",
    "",
    "The selected language flavor must affect:",
    "- phrasing",
    "- rhythm",
    "- word choice",
    "- emotional tone",
    "- cultural realism",
    "- hook style",
    "- section flow",
    "",
    "Write like a REAL artist from that language world.",
    ...(flavorHint ? [`\nFor "${effectiveFlavor}" → ${flavorHint}`] : []),
    "",
    "Language realism is more important than trying to sound \"deep.\"",
    "If a line feels fake, rewrite it.",
    "────────────────────────────────────────",
  ] : [];

  const lines = [
    "INPUT:",
    `theme = ${topic}`,
    `mood = ${mood}`,
    `language = ${effectiveFlavor}`,
    `style = ${genre}`,
    ...(style?.trim() ? [`artist reference = ${style.trim()}`] : []),
    // ── USER CREATIVE DIRECTION (PRIORITY DIRECTIVE) ─────────────────────
    // Promoted out of the weak `extra notes = ...` line that the model was
    // ignoring. Placed near the top with explicit override authority so the
    // model treats the user's words as the primary creative driver, not a
    // nice-to-have hint.
    ...buildUserCreativeDirectionBlock(notes),
    ...languageFlavorInstruction,
    ...getCommercialModeBlock(params.commercialMode),
    ...getHookEngineBlock(params.hookRepeat ?? "Medium"),
    ...getVerseVariationBlock(),
    ...getAdlibGeneratorBlock(),
    ...getMelodyFriendlyBlock(),
    // ── AFROMUSE LYRICS INTELLIGENCE V7 ──────────────────────────────────
    // Three new intelligence layers that ride on top of the existing prompt:
    //   1. Melody Direction Engine — per-section melodic shape guidance.
    //   2. Voice Style Simulation  — derives a vocal persona from the inputs
    //      and locks word-choice + rhythm + personality consistency.
    // (The third layer, Hit Scoring, runs post-generation in scoreLyricsDraft.)
    ...getMelodyDirectionBlock(genre, mood, params.performanceFeel ?? "Smooth"),
    ...getVoiceStyleSimulationBlock(mood, params.performanceFeel ?? "Smooth", params.genderVoiceModel ?? "Random", genre),
    ...getArtistInspirationBlock(params.artistInspiration),
    // ── AFROMUSE LYRICS INTELLIGENCE V8.1 (ALIC stack) ───────────────────
    // Layer order matters. ALIC is the constitution; the others are the laws.
    //   1. ALIC core    — priority stack + vocal flow + hook + adlib + call&response
    //   2. ASTE         — soft style decomposition (5-attribute decomposition)
    //   3. ASOE         — hard artist override (chant mode, line length, etc.)
    //   4. DET / DETE   — section-aware behavior-driving emotion tags
    // When two engines disagree, the higher-priority one wins per ALIC §1.
    ...getAfromuseLyricsIntelligenceCoreBlock(params.artistInspiration, style, mood, genre),
    ...getArtistStyleTranslationBlock(params.artistInspiration, style, genre, mood, effectiveFlavor),
    ...getArtistStyleOverrideBlock(params.artistInspiration, style, genre, mood),
    ...getDynamicEmotionTagBlock(topic, params.artistInspiration, style, genre, mood, effectiveFlavor, params.performanceFeel ?? "Smooth"),
    ...getLyricalDepthBlock(params.lyricalDepth ?? "Balanced"),
    ...getPerformanceFeelBlock(params.performanceFeel ?? "Smooth"),
    ...getVoiceTextureBlock(params.voiceTexture ?? "Balanced"),
    ...buildDiversityDirective(diversityProfile),
    ...(strictMode ? [buildStrictRetryAddendum(diversityProfile)] : []),
    // ── USER CREATIVE DIRECTION (REINFORCEMENT) ──────────────────────────
    // Re-stated at the very end of the user prompt so it's the last thing
    // in the model's working context before generation. This double-anchor
    // (top + bottom) is the most reliable way to make a smaller LLM
    // actually honor user-supplied direction.
    ...buildUserCreativeDirectionReminder(notes),
  ];

  return lines.join("\n");
}

// ─── Structure Validation ────────────────────────────────────────────────────

interface SongDraft {
  intro?: unknown[];
  verse1?: unknown[];
  hook?: unknown[];
  verse2?: unknown[];
  bridge?: unknown[];
  outro?: unknown[];
  [key: string]: unknown;
}

interface ValidationResult {
  valid: boolean;
  failures: string[];
  /**
   * Soft-quality issues that don't break the schema but indicate the model
   * drifted (model-prefix leaks, empty lines, refusals, missing keeper line,
   * etc.). Used as a tie-breaker when picking between competing drafts.
   */
  softIssues?: string[];
  /**
   * 0–1000 quality score — higher is better. Combines structural validity,
   * soft-issue count, and presence of the intelligence-layer signals
   * (keeper line, all sections populated, no leaked instructions).
   * Used INTERNALLY to drive the retry loop and pick the winning draft.
   */
  qualityScore?: number;
  /**
   * 0–100 commercial hit-potential score with sub-dimensions. Surfaced to the
   * frontend as part of the AfroMuse Lyrics Intelligence V7 layer. Distinct
   * from qualityScore: qualityScore answers "did the model follow our spec?",
   * hitScore answers "how commercially potent are these lyrics?".
   */
  hitScore?: HitScoreReport;
}

export interface HitScoreReport {
  overall: number; // 0-100 weighted composite
  hookStrength: number; // 0-100 chantability + repetition + length
  emotionalImpact: number; // 0-100 sentiment density + imagery
  flowQuality: number; // 0-100 line-length variance + breathing
  originality: number; // 0-100 lexical diversity vs cliche
  performanceFeel: number; // 0-100 adlib + open-vowel ratio
  notes: string[]; // human-readable highlights and warnings
}

function validateStructure(draft: SongDraft, profile: DiversityProfile): ValidationResult {
  const failures: string[] = [];
  const softIssues: string[] = [];
  const sections: SectionKey[] = ["intro", "hook", "verse1", "verse2", "bridge", "outro"];

  // Tolerance: line count within ±2 of any target is a SOFT drift (acceptable
  // — kept as best-effort), not a hard failure. This prevents wasting a 100 s+
  // strict-retry on a draft Qwen produced 1 line over schema. Drift >2 lines
  // stays a hard failure (real structural problem we want to retry).
  const LINE_DRIFT_TOLERANCE = 2;

  for (const section of sections) {
    const value = draft[section];
    const len = Array.isArray(value) ? value.length : -1;
    const targets = profile.sectionLineTargets[section] ?? [];

    if (targets.length === 0) {
      if (Array.isArray(value) && value.length > 0) {
        failures.push(`${section} has ${len} lines — this Diversity Engine arrangement requires an empty array`);
      }
      continue;
    }

    if (!targets.includes(len)) {
      const minDrift = Math.min(...targets.map((t) => Math.abs(t - len)));
      const message = `${section} has ${len} lines — expected ${targets.join(" or ")} for ${profile.dnaMode}`;
      if (len > 0 && minDrift <= LINE_DRIFT_TOLERANCE) {
        softIssues.push(`${message} (within ±${LINE_DRIFT_TOLERANCE} tolerance)`);
      } else {
        failures.push(message);
      }
    }
  }

  return { valid: failures.length === 0, failures, softIssues };
}

/**
 * Deep lyrics check — runs AFTER structural validation passes.
 *
 * Catches the subtle ways an LLM can produce a "valid-looking" draft that
 * still violates the intelligence layers we asked it to honor. Every issue
 * here costs quality-score points; a model with zero deep issues wins the
 * head-to-head against a model that left meta artifacts in the lyric lines.
 *
 * Specifically guards against:
 *   - Model refusal / safety canned responses ("I cannot", "As an AI")
 *   - Bracketed instruction leaks inside lyric lines ("(Note:", "[Verse 1]")
 *   - Empty / whitespace-only lines that would silence vocals
 *   - Missing or non-string keeper line (intelligence layer signal)
 *   - Markdown artifacts (asterisks, code fences) leaking into lyrics
 *   - Lines that are obviously meta ("Translation:", "Explanation:")
 */
function deepCheckLyrics(draft: SongDraft): { issues: string[] } {
  const issues: string[] = [];
  const sections: SectionKey[] = ["intro", "hook", "verse1", "verse2", "bridge", "outro"];

  // Refusal / safety / meta phrases the model occasionally emits when the
  // prompt confuses it. Any of these inside a lyric line means a re-roll.
  const REFUSAL_PHRASES = [
    /\bas an ai\b/i,
    /\bi cannot\b/i,
    /\bi can'?t\b/i,
    /\bi'?m not able\b/i,
    /\bi apologi[sz]e\b/i,
    /\bcontent policy\b/i,
  ];
  const META_PREFIXES = [
    /^\s*\(?\s*(note|translation|explanation|context|meaning|reasoning|disclaimer)\s*[:：-]/i,
    /^\s*\[\s*(verse|chorus|hook|intro|outro|bridge|break)\b[^\]]*\]\s*$/i, // a [Section] line accidentally inside the lines array
    /^\s*```/, // code fence leak
  ];
  const MARKDOWN_ARTIFACTS = /\*\*|__|`{3}/;

  for (const section of sections) {
    const value = draft[section];
    if (!Array.isArray(value)) continue;
    value.forEach((line, idx) => {
      if (typeof line !== "string") {
        issues.push(`${section}[${idx}] is not a string`);
        return;
      }
      const trimmed = line.trim();
      if (trimmed.length === 0) {
        issues.push(`${section}[${idx}] is empty`);
        return;
      }
      if (META_PREFIXES.some((re) => re.test(trimmed))) {
        issues.push(`${section}[${idx}] looks like a meta/instruction leak: "${trimmed.slice(0, 60)}"`);
      }
      if (MARKDOWN_ARTIFACTS.test(trimmed)) {
        issues.push(`${section}[${idx}] contains markdown artifacts`);
      }
      if (REFUSAL_PHRASES.some((re) => re.test(trimmed))) {
        issues.push(`${section}[${idx}] contains a refusal/AI-disclosure phrase`);
      }
    });
  }

  // Intelligence-layer signal: the keeper line is what binds the song's
  // emotional spine. A draft missing it is a draft the model didn't follow.
  const keeperLine = (draft as { keeperLine?: unknown }).keeperLine;
  if (typeof keeperLine !== "string" || keeperLine.trim().length === 0) {
    issues.push("missing keeperLine — intelligence layer not honored");
  } else {
    // The keeper line should appear (substring or fuzzy) inside the chorus
    // since that's where the hook crystallizes. If it doesn't, the model
    // generated a keeper but didn't actually use it.
    const chorusJoined = Array.isArray(draft.hook)
      ? draft.hook.filter((l) => typeof l === "string").join(" ").toLowerCase()
      : "";
    const kl = keeperLine.toLowerCase().slice(0, 24); // first 24 chars is enough for a fuzzy match
    if (kl && chorusJoined && !chorusJoined.includes(kl)) {
      issues.push("keeperLine does not appear in the chorus");
    }
  }

  // Title sanity — empty/placeholder titles ("Untitled", "Song Title") are a
  // tell that the model gave up partway through.
  const title = (draft as { title?: unknown }).title;
  if (typeof title !== "string" || /^(untitled|song title|placeholder)?$/i.test(title.trim())) {
    issues.push("missing or placeholder title");
  }

  return { issues };
}

/**
 * Combine structural validation + deep checks into a single 0–1000 quality
 * score. Higher is better. We use this to pick a winner when multiple models
 * race in parallel.
 *
 * Scoring:
 *   start at 1000, subtract 100 per structural failure, subtract 25 per soft
 *   issue, floor at 0. A perfect draft scores 1000.
 */
// ─────────────────────────────────────────────────────────────────────────────
// AFROMUSE LYRICS INTELLIGENCE V8.1 — ENGINE COMPLIANCE AUDIT
// ─────────────────────────────────────────────────────────────────────────────
//
// Programmatic gate that converts the ALIC / ASOE / DET prompt rules from
// "please" into "must". Every draft is audited against the trace fields the
// model is REQUIRED to populate. Non-compliant drafts get heavily demoted in
// best-of-N selection so the better-behaved sibling wins. We deliberately
// don't auto-regenerate (would 2x latency); instead, the parallel Qwen +
// Llama-4 race already gives us a second draft to fall back on.
//
// HARD FAILS (-200 each — usually disqualifying):
//   - All three trace fields missing entirely (model ignored everything)
//   - artistStyleOverride.isHardChant=true but callAndResponse is empty
//   - dynamicEmotionTags missing or empty when an artist reference exists
//   - Any banned static tag appears verbatim in dynamicEmotionTags
//   - Hook lines exceed the artist's line-length budget by >2 words
//
// SOFT ISSUES (-25 each — penalty but not disqualifying):
//   - Same emotion tag appears in 2+ sections (tag diversity violation)
//   - lyricsIntelligenceCore.failureChecks.regenerate flagged true by model
//   - vocalFlowBySection or adlibsBySection missing
//   - Generic-looking tag (no concrete storyline word, < 2 words long)
// ─────────────────────────────────────────────────────────────────────────────

const BANNED_EMOTION_TAGS_LC = new Set([
  "anthemic energy", "catchy hook energy", "emotional peak", "powerful performance",
  "smooth & melodic", "smooth and melodic", "high energy", "vibey mood",
  "confident rhythm", "soft & reflective", "soft and reflective", "energetic vibe",
  "uplifting mood", "chill vibe", "hype energy", "romantic mood", "sad reflection",
  "party energy", "generic pain", "generic joy", "generic spiritual", "generic love",
  "anthemic", "energetic", "smooth & seductive", "smooth and seductive",
]);

interface ComplianceAudit {
  hardFails: string[];
  softIssues: string[];
}

function auditEngineCompliance(draft: SongDraft): ComplianceAudit {
  const hardFails: string[] = [];
  const softIssues: string[] = [];

  const aso = draft.artistStyleOverride as Record<string, unknown> | undefined;
  const det = draft.dynamicEmotionTags as Record<string, unknown> | undefined;
  const alic = draft.lyricsIntelligenceCore as Record<string, unknown> | undefined;

  // ── Trace field presence ────────────────────────────────────────────────
  const allMissing = !aso && !det && !alic;
  if (allMissing) {
    hardFails.push("ALIC/ASOE/DET trace fields all missing — model ignored intelligence layers");
    return { hardFails, softIssues }; // no point checking further
  }

  // ── Chant-mode call-and-response enforcement ───────────────────────────
  const isHardChant = Boolean(aso?.isHardChant);
  const cAndR = alic?.callAndResponse;
  const cAndRCount = Array.isArray(cAndR) ? cAndR.length : 0;
  if (isHardChant && cAndRCount === 0) {
    hardFails.push("ASOE chant mode active but callAndResponse pairs are empty");
  }

  // ── DET tag presence + banned-tag detection ────────────────────────────
  if (det) {
    const allTags: string[] = [];
    for (const v of Object.values(det)) {
      if (Array.isArray(v)) {
        for (const t of v) {
          if (typeof t === "string") allTags.push(t);
        }
      }
    }
    if (allTags.length === 0 && aso && (aso as { active?: boolean }).active) {
      hardFails.push("dynamicEmotionTags empty despite an artist reference");
    }
    // Banned-tag check — case-insensitive whole-tag match
    for (const t of allTags) {
      const norm = t.trim().toLowerCase();
      if (BANNED_EMOTION_TAGS_LC.has(norm)) {
        hardFails.push(`Banned static emotion tag used verbatim: "${t}"`);
      }
    }
    // Soft tag-diversity check — same tag across 2+ sections
    const seenInSection = new Map<string, string[]>();
    for (const [section, val] of Object.entries(det)) {
      if (!Array.isArray(val)) continue;
      for (const t of val) {
        if (typeof t !== "string") continue;
        const k = t.trim().toLowerCase();
        if (!k) continue;
        const arr = seenInSection.get(k) ?? [];
        arr.push(section);
        seenInSection.set(k, arr);
      }
    }
    for (const [tag, sections] of seenInSection) {
      if (sections.length >= 2) {
        softIssues.push(`Tag "${tag}" repeats across sections: ${sections.join(", ")}`);
      }
    }
    // Soft generic-looking-tag check — single word OR contains only generic words
    for (const t of allTags) {
      const words = t.trim().split(/\s+/).filter(Boolean);
      if (words.length < 2) softIssues.push(`Tag too generic (single word): "${t}"`);
    }
  }

  // ── Hook line-length budget enforcement when override active ───────────
  const lineLengthBudget = (aso?.lineLengthBudget as string | undefined) ?? "";
  const budgetMatch = lineLengthBudget.match(/(\d+)\s*[–\-]\s*(\d+)/);
  if (isHardChant && budgetMatch && Array.isArray(draft.hook)) {
    const maxBudget = parseInt(budgetMatch[2], 10);
    const hookLines = draft.hook.filter((l): l is string => typeof l === "string");
    const overshoot = hookLines.filter(
      (l) => l.replace(/\([^)]*\)/g, "").trim().split(/\s+/).filter(Boolean).length > maxBudget + 2,
    );
    if (overshoot.length > 0) {
      hardFails.push(
        `${overshoot.length} hook line(s) exceed chant-mode line-length budget (${maxBudget} words)`,
      );
    }
  }

  // ── Self-flagged regeneration ──────────────────────────────────────────
  const failureChecks = alic?.failureChecks as Record<string, unknown> | undefined;
  if (failureChecks?.regenerate === true) {
    softIssues.push("Model self-flagged failureChecks.regenerate=true");
  }

  // ── Trace coverage ─────────────────────────────────────────────────────
  if (alic) {
    const flow = alic.vocalFlowBySection as Record<string, unknown> | undefined;
    const adlibs = alic.adlibsBySection as Record<string, unknown> | undefined;
    if (!flow || Object.keys(flow).length === 0) softIssues.push("vocalFlowBySection missing");
    if (!adlibs || Object.keys(adlibs).length === 0) softIssues.push("adlibsBySection missing");
  }

  return { hardFails, softIssues };
}

function scoreLyricsDraft(draft: SongDraft, profile: DiversityProfile): ValidationResult {
  const structural = validateStructure(draft, profile);
  const deep = deepCheckLyrics(draft);
  const compliance = auditEngineCompliance(draft);
  const score = Math.max(
    0,
    1000
      - structural.failures.length * 100
      - deep.issues.length * 25
      - compliance.hardFails.length * 200
      - compliance.softIssues.length * 25,
  );
  return {
    valid: structural.valid && deep.issues.length === 0 && compliance.hardFails.length === 0,
    failures: [...structural.failures, ...compliance.hardFails],
    softIssues: [
      ...(structural.softIssues ?? []),
      ...deep.issues,
      ...compliance.softIssues,
    ],
    qualityScore: score,
    hitScore: computeHitScore(draft),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AFROMUSE LYRICS INTELLIGENCE V7 — LAYER 3: HIT SCORING SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
//
// Heuristic, deterministic, fully-offline commercial-potential scorer. Runs on
// every generated draft and returns a 0-100 composite plus five sub-scores so
// the UI can show the artist WHY the score is what it is.
//
// We deliberately avoid running another LLM here for three reasons:
//   1. Speed — we already have two LLM calls in the pipeline (lyrics + flow);
//      a third would push p95 past acceptable response times.
//   2. Cost — every track generation would trigger another paid call.
//   3. Reliability — the current heuristics are explainable and testable.
//
// The five dimensions are weighted to reflect commercial reality:
//   Hook strength    35% — the hook is the single biggest predictor of replay.
//   Emotional impact 20% — songs that connect emotionally win.
//   Flow quality     15% — bad flow is a hard ceiling on radio play.
//   Originality      15% — recycled cliche caps the song's reach.
//   Performance feel 15% — adlibs/vowel openness signal real artist energy.
// ─────────────────────────────────────────────────────────────────────────────

function pullSectionLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.replace(/\([^)]*\)/g, " ").trim()) // strip adlibs from text counts
    .filter((l) => l.length > 0);
}

// Like pullSectionLines but PRESERVES the (adlibs) so we can count them.
// We use this only for the performance-feel dimension; everything else
// (length / variance / vocab) should ignore adlibs to stay accurate.
function pullSectionLinesRaw(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function clamp(n: number, lo = 0, hi = 100): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

const HIT_CLICHE_PATTERNS = [
  /\bbaby (girl|boy)\b/i,
  /\bin the club\b/i,
  /\bturn it up\b/i,
  /\bnight is young\b/i,
  /\bup all night\b/i,
  /\blove is in the air\b/i,
  /\blet the music play\b/i,
  /\bone of a kind\b/i,
  /\blike no other\b/i,
  /\btill the morning\b/i,
];

const HIT_EMOTION_WORDS = [
  "love","heart","soul","fire","dream","cry","pain","alone","hope","fall",
  "rise","light","dark","prayer","blessing","faith","run","stay","gone","forever",
  "broken","whole","free","chains","sky","ocean","fight","hold","never","always",
  "tonight","forever","goodbye","hello","reach","touch","pray","believe","trust","heal",
];

const OPEN_VOWELS = /[aeiouAEIOU]/g;

export function computeHitScore(draft: SongDraft): HitScoreReport {
  const intro   = pullSectionLines(draft.intro);
  const verse1  = pullSectionLines(draft.verse1);
  const hook    = pullSectionLines(draft.hook);
  const verse2  = pullSectionLines(draft.verse2);
  const bridge  = pullSectionLines(draft.bridge);
  const outro   = pullSectionLines(draft.outro);
  const allBody = [...intro, ...verse1, ...hook, ...verse2, ...bridge, ...outro];
  const totalText = allBody.join(" ").toLowerCase();
  const notes: string[] = [];

  // ── Hook strength ────────────────────────────────────────────────────────
  // Chantability factors: hook exists, length is in pop sweet-spot (4-8 lines),
  // hook lines are short (<= 10 words), at least one line repeats, last word
  // ends in an open vowel for vocal extension.
  let hookStrength = 0;
  if (hook.length === 0) {
    notes.push("No chorus/hook lines — major hit-potential penalty.");
  } else {
    hookStrength += 25; // baseline for having a hook
    if (hook.length >= 4 && hook.length <= 8) hookStrength += 20;
    else notes.push(`Hook is ${hook.length} lines — sweet spot is 4–8 for replay value.`);

    const hookLineLengths = hook.map((l) => l.split(/\s+/).filter(Boolean).length);
    const avgHookLen = hookLineLengths.reduce((s, n) => s + n, 0) / Math.max(1, hookLineLengths.length);
    if (avgHookLen > 0 && avgHookLen <= 9) hookStrength += 20;
    else if (avgHookLen <= 12) hookStrength += 10;
    else notes.push(`Hook lines average ${avgHookLen.toFixed(1)} words — long hooks lose chantability.`);

    const hookLower = hook.map((l) => l.toLowerCase().trim());
    const hookSet = new Set(hookLower);
    const repeatedLines = hookLower.length - hookSet.size;
    if (repeatedLines >= 1) hookStrength += 20;
    else notes.push("No repeated lines in the hook — repetition is what makes hooks stick.");

    const lastChar = hook[hook.length - 1].replace(/[^a-zA-Z]/g, "").slice(-1).toLowerCase();
    if ("aeiou".includes(lastChar)) hookStrength += 15;
    else notes.push("Hook ends on a closed consonant — open vowel endings are more singable.");
  }

  // ── Emotional impact ─────────────────────────────────────────────────────
  // Density of emotional vocabulary across body lines, plus presence of a
  // keeper line (the song's emotional spine).
  const wordCount = totalText.split(/\s+/).filter(Boolean).length;
  const emotionHits = HIT_EMOTION_WORDS.reduce((sum, w) => {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    const matches = totalText.match(re);
    return sum + (matches ? matches.length : 0);
  }, 0);
  const emotionDensity = wordCount > 0 ? emotionHits / wordCount : 0;
  // 1 emotion word per ~20 body words is the sweet spot (~5%).
  let emotionalImpact = clamp(emotionDensity * 1500); // density 0.05 -> 75
  const keeperLine = (draft as { keeperLine?: unknown }).keeperLine;
  if (typeof keeperLine === "string" && keeperLine.trim().length > 0) emotionalImpact += 20;
  else notes.push("Missing keeperLine — songs without a clear emotional spine score lower.");
  emotionalImpact = clamp(emotionalImpact);

  // ── Flow quality ─────────────────────────────────────────────────────────
  // Variance in line length signals a melodic contour; flat = monotone.
  // Average words per line should be in the 5-12 range for singability.
  let flowQuality = 50;
  if (allBody.length === 0) {
    flowQuality = 0;
  } else {
    const lens = allBody.map((l) => l.split(/\s+/).filter(Boolean).length);
    const avg = lens.reduce((s, n) => s + n, 0) / lens.length;
    const variance = lens.reduce((s, n) => s + (n - avg) ** 2, 0) / lens.length;
    const sdev = Math.sqrt(variance);
    if (avg >= 5 && avg <= 12) flowQuality += 20;
    else if (avg < 5) notes.push(`Average line is ${avg.toFixed(1)} words — too short, may feel choppy.`);
    else notes.push(`Average line is ${avg.toFixed(1)} words — too long, melodic shape gets buried.`);
    if (sdev >= 1.5 && sdev <= 5) flowQuality += 20;
    else if (sdev < 1.5) notes.push("Line lengths are too uniform — flat contour reads as monotone.");
    else notes.push("Line lengths vary too wildly — pacing feels inconsistent.");

    const verseHookContrast =
      verse1.length > 0 && hook.length > 0
        ? Math.abs(
            verse1.reduce((s, l) => s + l.length, 0) / verse1.length -
              hook.reduce((s, l) => s + l.length, 0) / hook.length,
          )
        : 0;
    if (verseHookContrast >= 5) flowQuality += 10;
    else notes.push("Verse and hook feel too similar in shape — listener won't feel the lift into the chorus.");
  }
  flowQuality = clamp(flowQuality);

  // ── Originality ──────────────────────────────────────────────────────────
  // Type/token ratio across body + cliche penalty.
  let originality = 50;
  if (wordCount > 0) {
    const tokens = totalText.split(/\s+/).filter(Boolean);
    const unique = new Set(tokens);
    const ttr = unique.size / tokens.length; // type/token ratio
    if (ttr >= 0.45) originality += 30;
    else if (ttr >= 0.35) originality += 15;
    else notes.push(`Low lexical diversity (${(ttr * 100).toFixed(0)}%) — words are recycling too much.`);

    const clicheHits = HIT_CLICHE_PATTERNS.reduce((sum, re) => sum + (re.test(totalText) ? 1 : 0), 0);
    if (clicheHits === 0) originality += 20;
    else {
      originality -= clicheHits * 15;
      notes.push(`Detected ${clicheHits} pop-cliche phrase${clicheHits > 1 ? "s" : ""} — penalty applied.`);
    }
  } else {
    originality = 0;
  }
  originality = clamp(originality);

  // ── Performance feel ─────────────────────────────────────────────────────
  // Adlib presence + open-vowel ratio + at least one bridge that breaks pattern.
  // We must count adlibs from the RAW (unstripped) lines because pullSectionLines
  // intentionally removes "(adlibs)" so they don't pollute the length/vocab math.
  let performanceFeel = 40;
  const rawBody = [
    ...pullSectionLinesRaw(draft.intro),
    ...pullSectionLinesRaw(draft.verse1),
    ...pullSectionLinesRaw(draft.hook),
    ...pullSectionLinesRaw(draft.verse2),
    ...pullSectionLinesRaw(draft.bridge),
    ...pullSectionLinesRaw(draft.outro),
  ];
  const adlibCount = rawBody.reduce((sum, l) => sum + (l.match(/\([^)]+\)/g)?.length ?? 0), 0);
  if (adlibCount >= 2) performanceFeel += 20;
  else if (adlibCount === 1) performanceFeel += 10;
  else notes.push("No adlibs detected — songs without performance touches feel un-recorded.");

  const allChars = totalText.replace(/[^a-z]/g, "");
  if (allChars.length > 0) {
    const vowels = allChars.match(OPEN_VOWELS)?.length ?? 0;
    const ratio = vowels / allChars.length;
    if (ratio >= 0.36) performanceFeel += 20; // healthy open-vowel mix for singability
    else if (ratio >= 0.30) performanceFeel += 10;
    else notes.push("Lyric is consonant-heavy — vowel scarcity makes it harder to sing.");
  }

  if (bridge.length > 0) performanceFeel += 10;
  else notes.push("No bridge — a strong bridge usually adds replay value.");
  performanceFeel = clamp(performanceFeel);

  // ── Composite ────────────────────────────────────────────────────────────
  const overall = clamp(
    hookStrength * 0.35 +
      emotionalImpact * 0.20 +
      flowQuality * 0.15 +
      originality * 0.15 +
      performanceFeel * 0.15,
  );

  return {
    overall,
    hookStrength,
    emotionalImpact,
    flowQuality,
    originality,
    performanceFeel,
    notes,
  };
}

// ─── Models ───────────────────────────────────────────────────────────────────
// CLEAN ROLE SPLIT (locked April 30, 2026 — user directive: "only Qwen for
// lyrics, only Maverick for the Blueprint, Qwen is more good at lyrics").
//
// LYRICS — Qwen3.5-122B owns the lyrics end-to-end. 122B params, purpose-built
//   for dense instruction-following: keeper-line placement, dialect rules,
//   exact line counts, and the full JSON schema. If the first Qwen pass has
//   structural issues, we re-roll Qwen with the strict prompt; if Qwen still
//   fails, we re-roll Qwen one more time at a cooler temperature for stability.
//   Maverick is intentionally NOT in the lyrics path — it does not see the
//   lyrics prompt under any circumstances.
//
// BLUEPRINT (production / flow) — Llama-4-Maverick (17B MoE) owns the blueprint
//   end-to-end. Faster for the shorter, structured production brief and frees
//   Qwen to focus entirely on lyrics. If the first Maverick call fails, we
//   re-roll Maverick at a cooler temperature. Qwen is intentionally NOT in
//   the blueprint path.

const QWEN_LYRICS_MODEL       = { id: "qwen/qwen3.5-122b-a10b",                  name: "Qwen3.5-122B",     temperature: 0.88 };
const QWEN_LYRICS_RETRY_MODEL = { id: "qwen/qwen3.5-122b-a10b",                  name: "Qwen3.5-122B",     temperature: 0.72 };
const MAVERICK_FLOW_MODEL     = { id: "meta/llama-4-maverick-17b-128e-instruct", name: "Llama-4-Maverick", temperature: 0.78 };
const MAVERICK_FLOW_RETRY     = { id: "meta/llama-4-maverick-17b-128e-instruct", name: "Llama-4-Maverick", temperature: 0.62 };
// AFROMUSE 4-MODEL ORCHESTRATION (April 30, 2026 spec)
//   Stage 1 STRUCTURE  → Maverick     (above)
//   Stage 2 EMOTION    → LLaMA 3.2 3B (small/fast/cool — strict authority on emotion direction)
//   Stage 3 LYRICS     → Qwen 122B    (above)
//   Stage 4 POLISH     → Solar 10.7B  (cool — flow polish only, never restructures)
// Emotion engine temperature was 0.45 historically, which made LLaMA 3.2
// converge on the same handful of "safe" tags every generation
// (e.g. "Quiet Pain Float", "Reflective Pause"). Bumped to 0.85 for
// real per-generation variety. Combined with response_format=json_object
// + a per-request creative spice token, the fallback table now triggers
// far less often.
const LLAMA_EMOTION_MODEL     = { id: "meta/llama-3.2-3b-instruct",              name: "Llama-3.2-3B",     temperature: 0.85 };
const SOLAR_POLISH_MODEL      = { id: "upstage/solar-10.7b-instruct",            name: "Solar-10.7B",      temperature: 0.55 };
// Stage 6 LOCALIZATION (Custom Language only) → LLaMA 3.1 70B Instruct
// Rewrites finished lyrics into the user's chosen language as a NATIVE
// songwriter would — preserving structure, emotion, rhythm, and chant
// patterns. Activates ONLY when `customLanguage` is provided. Otherwise
// the Qwen lyrics output ships as-is.
const LLAMA_LOCALIZATION_MODEL = { id: "meta/llama-3.1-70b-instruct",            name: "Llama-3.1-70B",    temperature: 0.55 };
// Stage 2.5 DIRECTOR LAYER → Qwen 3.5 397B
// Sits between Stage 1 (blueprint) and Stage 3 (lyrics). Does NOT write
// lyrics, does NOT repeat the blueprint, does NOT generate structure.
// Produces a tight DIRECTOR BRIEF (300–500 words, JSON) that interprets
// the blueprint and guides Qwen 122B with emotional truth, vocal
// behavior, artist interpretation, hook strategy, language authenticity,
// avoidance rules, and performance intent.
const QWEN_DIRECTOR_MODEL      = { id: "qwen/qwen3.5-397b-a17b",                 name: "Qwen3.5-397B",     temperature: 0.6  };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function draftToLyricsText(draft: SongDraft): string {
  const sections: string[] = [];
  const order = Array.isArray(draft.diversityReport) ? [] : (draft.diversityReport as { arrangementOrder?: SectionKey[] } | undefined)?.arrangementOrder;
  const sectionMap: Record<SectionKey, { label: string; lines: unknown[] | undefined }> = {
    intro: { label: "Intro", lines: draft.intro },
    hook: { label: "Chorus", lines: draft.hook },
    verse1: { label: "Verse 1", lines: draft.verse1 },
    verse2: { label: "Verse 2", lines: draft.verse2 },
    bridge: { label: "Bridge / Break", lines: draft.bridge },
    outro: { label: "Outro", lines: draft.outro },
  };
  const keys = order?.length ? order : ["intro", "verse1", "hook", "verse2", "bridge", "outro"] as SectionKey[];
  for (const key of keys) {
    const section = sectionMap[key as SectionKey];
    if (!section) continue;
    if (Array.isArray(section.lines) && section.lines.length > 0) {
      sections.push(`[${section.label}]\n${(section.lines as string[]).join("\n")}`);
    }
  }
  return sections.join("\n\n");
}

// ─── MULTI-STAGE GENERATION PIPELINE (MSGP) — locked April 30, 2026 ──────────
//
// Replaces the legacy "monolithic Qwen prompt with the entire V8.1 intelligence
// stack inlined" flow with a clean three-stage pipeline:
//
//   STAGE 1 — BLUEPRINT (Maverick): structure + behavior decisions only.
//     Output: emotion_map, flow_map, hook_style, adlib_style, artist_behavior.
//     NO lyrics here.
//
//   STAGE 2 — LYRICS (Qwen): writes the lyrics using a COMPRESSED rules
//     prompt PLUS the blueprint from Stage 1. The full V8.1 intelligence stack
//     is NOT resent here — the blueprint carries the intelligence.
//
//   STAGE 3 — LIGHT VALIDATION (programmatic + Qwen targeted fix): checks
//     hook strength, repetition, artist alignment. Minor fixes only — never
//     a full regeneration.
//
// Why: split THINKING (blueprint) from CREATION (lyrics). The model must not
// think and write at the same time.

// CreativeBlueprint now mirrors the AFROMUSE 4-model orchestration:
//   - flow_map / hook_style / adlib_style / artist_behavior are produced by
//     Stage 1 (Maverick) — STRUCTURE BRAIN.
//   - emotion_map is produced by Stage 2 (LLaMA 3.2 3B) — EMOTION TAG ENGINE.
//   The two are merged into a single CreativeBlueprint before Stage 3 (Qwen)
//   so the lyrics writer sees one unified contract — and downstream consumers
//   (frontend, production blueprint step) keep working unchanged.
interface CreativeBlueprint {
  emotion_map: Partial<Record<SectionKey, string>>;
  flow_map: Partial<Record<SectionKey, string>>;
  hook_style: string;
  adlib_style: string;
  artist_behavior: string;
}

// Stage 2 output — JSON emotion map, one tag per section, produced by the
// LLaMA 3.2 3B emotion engine. Strict authority on emotion direction.
type EmotionTagMap = Partial<Record<SectionKey, string>>;

// ─── PDLCS — Prompt Distribution + Light Compression System ───────────────────
//
// PRINCIPLE: full intelligence lives ONLY in Stage 1 (the THINKING brain).
// Stage 2 (the WRITING brain) gets the blueprint + bullet commands only.
// Anything stated in the blueprint MUST NOT be restated in the Stage 2 prompt.
//
// Stage 1 system prompt = full ALIC + ASTE/ASOE/DET hints, distilled to the
// rules a structural decision-maker needs. The model THINKS HARD here once,
// then Stage 2 just executes.

const BLUEPRINT_SYSTEM_PROMPT = `AFROMUSE STRUCTURE BLUEPRINT — STAGE 1 (4-MODEL PIPELINE)

You are the STRUCTURAL BRAIN of a 4-stage AfroMuse songwriting pipeline:
  Stage 1 (you)        → STRUCTURE (this output)
  Stage 2 LLaMA 3.2 3B → EMOTION TAGS (separate model, strict authority)
  Stage 3 Qwen 122B    → LYRICS
  Stage 4 Solar 10.7B  → POLISH

Your ONLY output is a STRUCTURE blueprint JSON. You do NOT write lyrics.
You do NOT decide emotion tags — the emotion engine owns that. Use the
emotion context below ONLY to choose smart flow / hook / adlib structure.

═══ PRIORITY STACK (LOCKED — DO NOT REORDER) ═══
When two engines conflict, the higher-listed one wins:
  1. ARTIST STYLE       — hard override when an artist reference is present
  2. EMOTION            — section-aware behavioral tags (DET / DETE)
  3. PERFORMANCE        — chant / flow / repetition density
  4. STORY              — LAST. Story serves the song, never the other way.

═══ EMOTION → WRITING CONTROL (TAG-DRIVEN BEHAVIOR) ═══
Each emotion tag is a BEHAVIORAL CONTROL — it dictates line length,
repetition density, vocabulary register, and vocal delivery:
  PAIN CHANT          → short lines · high repetition · simple words · echo phrasing
  HYPE / CONFIDENT    → punchy lines · call & response · crowd adlibs · less repetition
  SPIRITUAL WAVE      → slower phrases · reflective vocab · chant-like · breath in gaps
  STREET SURVIVAL     → concrete street imagery · clipped lines · no abstract metaphor
  BROKEN LOVE ECHO    → fragmented · pause-heavy · sense memory · no flex vocabulary

═══ VOCAL FLOW ENGINE (PER SECTION — pick ONE) ═══
  • CHANT       — repetitive · rhythmic · crowd-ready
  • SMOOTH      — connected phrasing · melodic pocket
  • BROKEN      — staggered · intentional pauses
  • PERCUSSIVE  — rhythm-first · words land like drums
Mixing flows mid-section breaks the spell. Lock one per section.

═══ HOOK ENGINE (MEMORABILITY GATE — all 4 must pass) ═══
  ☐ Repeatable           — uses an anchor phrase that returns
  ☐ Chantable            — a stranger can sing it back after ONE listen
  ☐ Simple               — vocabulary a 12-year-old could repeat
  ☐ Emotionally dominant — the song's peak, not filler
Weak hook → fix the blueprint hook_style before you submit.

═══ ADLIB INTELLIGENCE (PER EMOTION — pick 1–3 per section) ═══
  PAIN        → (cry) (ahh) (why) (oh Lord) (mmm)
  HYPE        → (hey!) (go!) (run am!) (shout!) (woo!)
  SPIRITUAL   → (amen) (jah) (pray) (halle) (rise)
  STREET      → (oya!) (gbera!) (move!) (eh!)
  ROMANTIC    → (baby) (mmm) (oh) (yeah)
Place strategically — end of phrases, hook climax, between leader/response calls.

═══ ARTIST-AWARE TAG ADAPTATION ═══
  • Asake-type     → "Pain Chant (Street Choir)", "Street Hype Bounce", "Prayer Chant Wave"
  • Burna-type     → "Layered Pain Groove", "Confident Global Swagger"
  • Wizkid-type    → "Quiet Pain Float", "Effortless Cool"
  • Davido-type    → "Crowd-Ready Confident Roll"
  • Unknown artist → extend the tag with the artist's strongest stylistic cue
  • No artist      → balanced AfroMuse default lane

═══ EMOTIONAL PROGRESSION RULE ═══
The song must EVOLVE — never plateau:
  Intro  → entry vibe / curiosity / scene-set
  Verse  → build / story or rhythm setup
  Chorus → peak emotion (chant climax in chant mode)
  Bridge → shift / breakdown / reflection
  Outro  → resolution or fade
Each section must FEEL different from the last.

═══ TAG DIVERSITY RULE ═══
  • No emotion tag may repeat verbatim across sections.
  • Hook returns are different emotional events each time.

═══ BANNED GENERIC TAGS (NEVER USE — fail-on-sight) ═══
  Anthemic / Anthemic Energy / Catchy Hook Energy / Smooth & Melodic /
  Smooth & Seductive / High Energy / Generic Pain / Energetic /
  Reflective / Uplifting (as a TAG — fine as a mood input).
Tags must be SPECIFIC and storyline-rooted.

═══ AUTO-CHANT MODE ═══
Auto-engage chant flow on hook + verses when the artist or genre signal
contains: asake / chant / choir / street / gospel / spiritual / fuji /
hymn / call-response / crowd / amapiano (chant lane) / fuji.

═══ OUTPUT — STRUCTURE BLUEPRINT JSON ONLY ═══
Return ONLY this JSON. No markdown, no code fences, no prose.
Note: emotion_map is INTENTIONALLY ABSENT — the emotion engine produces it.

{
  "flow_map":        { "intro": "", "hook": "", "verse1": "", "verse2": "", "bridge": "", "outro": "" },
  "hook_style":      "",
  "adlib_style":     "",
  "artist_behavior": ""
}

FIELD CONTRACTS:
- flow_map[section]: exactly ONE of "chant" | "smooth" | "broken" | "percussive".
- hook_style: ONE line — how the hook is delivered (e.g. "4-line chant with
  crowd response on lines 2 and 4, anchored by the keeper line at bars 1 and 3").
- adlib_style: ONE line per section, semicolon-separated (e.g. "hook: (woo!),
  (run am!); bridge: (mmm), (cry); outro: (oh Lord)").
- artist_behavior: ONE paragraph — energy arc, mic distance, breath placement,
  signature moves the lead vocalist should hit across the whole song.

Be DECISIVE. NO maybe / could / might. NO lyrics. NO explanation outside JSON.`;

function buildBlueprintPrompt(params: {
  topic: string;
  genre: string;
  mood: string;
  artistInspiration?: string;
  styleReference?: string;
  languageFlavor: string;
  diversityProfile: DiversityProfile;
  performanceFeel: string;
  notes?: string;
}): string {
  const { topic, genre, mood, artistInspiration, styleReference, languageFlavor, diversityProfile, performanceFeel, notes } = params;
  const artistLine = [artistInspiration, styleReference].filter(Boolean).join(" + ")
    || "no specific artist — use balanced AfroMuse default lane";

  return [
    "INPUT:",
    `idea = ${topic}`,
    `genre = ${genre}`,
    `mood = ${mood}`,
    `language flavor = ${languageFlavor}`,
    `performance feel = ${performanceFeel}`,
    `artist reference = ${artistLine}`,
    ...(notes?.trim() ? ["", "USER CREATIVE DIRECTION (must influence blueprint):", notes.trim()] : []),
    "",
    "DIVERSITY PROFILE (must respect):",
    `  dnaMode:           ${diversityProfile.dnaMode}`,
    `  emotionalLens:     ${diversityProfile.emotionalLens}`,
    `  energyLevel:       ${diversityProfile.energyLevel}`,
    `  hookStructure:     ${diversityProfile.hookStructure}`,
    `  energyCurve:       ${diversityProfile.energyCurve}`,
    `  urgencyLevel:      ${diversityProfile.urgencyLevel}`,
    `  artistMindset:     ${diversityProfile.artistMindset}`,
    `  arrangementOrder:  ${diversityProfile.arrangementOrder.join(" → ")}`,
    "",
    "TASK: produce the STRUCTURE blueprint JSON. Decisive choices only. NO emotion_map. NO lyrics.",
  ].join("\n");
}

// ─── STAGE 2 — EMOTION TAG ENGINE (LLaMA 3.2 3B) ─────────────────────────────
// Tiny, fast, low-temperature model whose ONLY job is to assign one emotion
// tag per section. Strict authority: Stage 3 (Qwen) MUST honor these tags.
// Rules: no flat repetition, must evolve, must reflect the artist's style.

const EMOTION_TAG_SYSTEM_PROMPT = `AFROMUSE EMOTION TAG ENGINE — STAGE 2

You are the EMOTION AUTHORITY for an AfroMuse song. You do NOT write lyrics.
You do NOT decide structure. You ONLY assign one emotion tag per section.

RULES:
- One tag per section: intro, verse1, hook, verse2, bridge, outro.
- Each tag is SHORT and BEHAVIORAL — e.g. "Pain Chant (Street Choir)",
  "Confident Global Swagger", "Quiet Pain Float", "Prayer Chant Wave",
  "Crowd-Ready Confident Roll", "Layered Pain Groove".
- NEVER use flat words like "happy" / "sad" / "energetic" / "reflective".
- NEVER repeat the SAME tag verbatim across sections. verse2 MUST differ
  from verse1. outro MUST differ from intro. If hook returns, the second
  hook tag must be a different emotional state of the same hook.
- Emotion MUST EVOLVE across the song:
    intro  → entry vibe / curiosity / scene-set
    verse  → build / story / setup
    hook   → peak emotional climax
    bridge → shift / breakdown / reflection
    outro  → resolution or fade
- Tag MUST reflect the artist reference style when one is given:
    Asake-type     → chant / call-response / street wave logic
    Burna-type     → layered / global / reflective swagger
    Wizkid-type    → smooth / quiet float / effortless cool
    Davido-type    → crowd-ready / confident roll
    no artist      → neutral AfroMuse default lane

🚫 STALE-VOCAB BAN (CRITICAL — per-generation freshness):
You are STATELESS — do NOT default to your "safe" repeat phrases.
The following tag stems are OVERUSED and BANNED unless the input
explicitly demands them:
  "Quiet Pain Float", "Pain Chant Wave", "Pain Chant Climax",
  "Reflective Pause", "Resolution Wave", "Resolution Whisper",
  "Curious Entry Vibe", "Story Build Roll", "Confident Chant Climax",
  "Layered Drive", "Survival Drive", "Triumphant Chant".
Invent fresh phrasing every generation. Use the CREATIVE SPICE token
in the user prompt as a randomness anchor — let it nudge your word
choice into a different lane than the previous run.

OUTPUT — JSON ONLY, no markdown, no fences:
{
  "intro":  "",
  "verse1": "",
  "hook":   "",
  "verse2": "",
  "bridge": "",
  "outro":  ""
}`;

// Word pools for the per-request "creative spice" — randomly picked per
// generation so the prompt is never byte-identical twice. This nudges
// LLaMA out of its "safe" repeat region without changing meaning.
const SPICE_LANES = [
  "street-corner cinematic", "midnight prayer-room", "festival-stage live",
  "after-rain reflective", "dance-floor sweat", "highway-night cruise",
  "back-alley confession", "rooftop celebration", "studio-booth raw",
  "morning-light awakening", "thunderstorm release", "candle-lit intimate",
];
const SPICE_TEXTURES = [
  "raspy", "airy", "guttural", "whispered", "soaring", "anchored",
  "fractured", "molten", "silken", "jagged", "hushed", "blazing",
];
const SPICE_VERBS = [
  "twist", "pivot", "ignite", "unravel", "ascend", "splinter",
  "swell", "bloom", "rupture", "linger", "crackle", "shimmer",
];

function buildEmotionTagPrompt(params: {
  topic: string;
  genre: string;
  mood: string;
  artistInspiration?: string;
  styleReference?: string;
  languageFlavor: string;
  notes?: string;
  structureBlueprint: CreativeBlueprint;
}): string {
  const { topic, genre, mood, artistInspiration, styleReference, languageFlavor, notes, structureBlueprint } = params;
  const artistLine = [artistInspiration, styleReference].filter(Boolean).join(" + ")
    || "no specific artist — use balanced AfroMuse default lane";

  // Per-request creative spice — random lane / texture / verb + a short
  // nonce. The model uses this as a randomness anchor so consecutive
  // generations don't converge on the same "safe" tag set.
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)] as T;
  const spice = {
    lane:    pick(SPICE_LANES),
    texture: pick(SPICE_TEXTURES),
    verb:    pick(SPICE_VERBS),
    nonce:   Math.random().toString(36).slice(2, 10),
  };

  return [
    "INPUT:",
    `idea = ${topic}`,
    `genre = ${genre} | mood = ${mood} | language = ${languageFlavor}`,
    `artist reference = ${artistLine}`,
    ...(notes?.trim() ? ["", "USER DIRECTION (must influence emotion choices):", notes.trim()] : []),
    "",
    "CREATIVE SPICE (use as a freshness anchor — DO NOT echo verbatim):",
    `  lane    = ${spice.lane}`,
    `  texture = ${spice.texture}`,
    `  verb    = ${spice.verb}`,
    `  nonce   = ${spice.nonce}`,
    "",
    "STRUCTURE BLUEPRINT (read for context — do not modify):",
    JSON.stringify(structureBlueprint),
    "",
    "TASK: assign one EVOLVING emotion tag per section. JSON only.",
    "Each tag must FEEL different from your last generation — the spice",
    "above is your randomness seed. Lean into it.",
  ].join("\n");
}

// ─── STAGE 4 — SOLAR POLISH ENGINE (Solar 10.7B) ─────────────────────────────
// Final pass. Improves flow / rhythm / weak lines. NEVER changes meaning,
// structure, section order, line counts, emotion tags, or the keeperLine.
// Returns the SAME JSON shape so we can drop it back into the pipeline.

// Solar 10.7B has a HARD 4096-token context window (input + output combined).
// To fit, we send ONLY the lyric arrays (no intelligenceCore, no backups) and
// ask for ONLY the lyric arrays back. The original draft's keeperLine, title,
// and lyricsIntelligenceCore are preserved on our side after polish.

const SOLAR_POLISH_SYSTEM_PROMPT = `AFROMUSE QUALITY POLISH — STAGE 4

You are the FINAL POLISH layer for an AfroMuse song. Your only job is to
make every line flow better, rhyme tighter, and chant harder where needed.

HARD CONSTRAINTS — VIOLATING ANY = REJECT:
- DO NOT change the song's meaning, story, or theme.
- DO NOT change the number of lines in any section.
- DO NOT change the emotion of any section.
- DO NOT add meta inside lyrics: no [Verse 1], no (Note:), no asterisks.
- DO NOT add new sections.

WHAT YOU MAY DO:
- Tighten word choice for rhythm and singability.
- Strengthen weak rhymes / patch awkward phrasing.
- Sharpen chant cadence on chant sections.
- Keep dialect native to the language flavor.

OUTPUT — JSON ONLY, lyric arrays in the same shape & length:
{
  "intro":  ["",""],
  "hook":   ["","","",""],
  "verse1": ["","","","","","","",""],
  "verse2": ["","","","","","","",""],
  "bridge": ["","","",""],
  "outro":  ["",""]
}`;

function buildSolarPolishPrompt(params: {
  draft: SongDraft;
  blueprint: CreativeBlueprint;
  languageFlavor: string;
}): string {
  const { draft, blueprint, languageFlavor } = params;
  // Compact section dump — only the line arrays.
  const sections = {
    intro:  Array.isArray(draft.intro)  ? draft.intro  : [],
    hook:   Array.isArray(draft.hook)   ? draft.hook   : [],
    verse1: Array.isArray(draft.verse1) ? draft.verse1 : [],
    verse2: Array.isArray(draft.verse2) ? draft.verse2 : [],
    bridge: Array.isArray(draft.bridge) ? draft.bridge : [],
    outro:  Array.isArray(draft.outro)  ? draft.outro  : [],
  };
  // Compact blueprint — flow + emotion only (Solar doesn't need adlib palettes).
  const tightBlueprint = {
    flow:    blueprint.flow_map,
    emotion: blueprint.emotion_map,
  };
  return [
    `LANGUAGE: ${languageFlavor} | KEEPER (do not change): ${draft.keeperLine ?? ""}`,
    "",
    "BLUEPRINT (locked):",
    JSON.stringify(tightBlueprint),
    "",
    "DRAFT TO POLISH (return SAME shape, improved):",
    JSON.stringify(sections),
    "",
    "TASK: polish. JSON only. Do not change line counts.",
  ].join("\n");
}

// ─── STAGE 6 — LANGUAGE LOCALIZATION (LLaMA 3.1 70B) ─────────────────────────
// You are NOT a translator. You are a NATIVE SONGWRITER in the target
// language. Rewrite the lyrics so they sound like they were originally
// written in that language — keeping the story, emotion, structure,
// chants, adlibs, and singability. Output JSON ONLY with the SAME
// section keys and the SAME line counts. No commentary, no metadata,
// no explanations.
const LOCALIZATION_SYSTEM_PROMPT = `AFROMUSE LANGUAGE LOCALIZATION ENGINE

ROLE
You are a native songwriter in the TARGET LANGUAGE for AfroMuse.
You are NOT a translator. You rewrite the lyrics so they sound like a real
hit song originally written in that language by a native artist.

CORE RULES
NEVER:
- Translate word-for-word.
- Change the story, meaning, or narrative arc.
- Add new lyrics or remove important lines.
- Break song structure (intro / hook / verse1 / verse2 / bridge / outro).
- Flatten emotions into literal phrases.
- Produce robotic, dictionary-style, or touristy output.
- Mix in source-language words unless they are part of the natural
  bilingual flow common in that culture's music.

ALWAYS:
- Preserve emotional meaning and storytelling beat-for-beat.
- Keep rhythm, syllable feel, and singability over the original groove.
- Maintain chant, adlibs, and call-and-response patterns.
- Adapt expressions into natural native phrasing for the target language.
- Match how songs are actually written in that language and culture.
- Keep proper nouns, brand names, and the keeper line's identity intact
  (the keeper line may be re-voiced into the target language but must
  remain the song's most quotable anchor).

LANGUAGE INTELLIGENCE RULE
You must dynamically adapt to ANY language provided. Use that language's
natural songwriting style, cultural tone, and emotional conventions. Do
not rely on fixed templates. If the language has multiple registers
(formal / colloquial / street), pick the one that matches the style
context (genre, mood, artist reference).

STRUCTURE PRESERVATION (HARD CONTRACT)
- Return the SAME JSON keys: intro, hook, verse1, verse2, bridge, outro.
- Each section MUST have the EXACT same number of lines as the input.
- Lines must remain singable and rhythmically equivalent to the source.
- No section labels, no [Verse 1] markers, no (Note:), no asterisks,
  no "Translation:" headers, no language tags inside the lines.

OUTPUT FORMAT — JSON ONLY, NO MARKDOWN, NO FENCES, NO EXTRA TEXT:
{
  "intro":  ["",""],
  "hook":   ["","","",""],
  "verse1": ["","","","","","","",""],
  "verse2": ["","","","","","","",""],
  "bridge": ["","","",""],
  "outro":  ["",""]
}`;

function buildLocalizationPrompt(params: {
  draft: SongDraft;
  targetLanguage: string;
  styleContext: string;
}): string {
  const { draft, targetLanguage, styleContext } = params;
  const sections = {
    intro:  Array.isArray(draft.intro)  ? draft.intro  : [],
    hook:   Array.isArray(draft.hook)   ? draft.hook   : [],
    verse1: Array.isArray(draft.verse1) ? draft.verse1 : [],
    verse2: Array.isArray(draft.verse2) ? draft.verse2 : [],
    bridge: Array.isArray(draft.bridge) ? draft.bridge : [],
    outro:  Array.isArray(draft.outro)  ? draft.outro  : [],
  };
  const lineCounts = (Object.keys(sections) as SectionKey[])
    .map((k) => `  ${k}: ${(sections[k] as unknown[]).length}`)
    .join("\n");
  return [
    `TARGET LANGUAGE: ${targetLanguage}`,
    `STYLE CONTEXT: ${styleContext}`,
    `KEEPER LINE (re-voice in target language, keep it as the song's anchor): ${draft.keeperLine ?? ""}`,
    "",
    "REQUIRED LINE COUNTS PER SECTION (must match exactly):",
    lineCounts,
    "",
    "ORIGINAL LYRICS (rewrite each line as a native songwriter, preserving structure, story, and singability):",
    JSON.stringify(sections),
    "",
    "TASK: localize. JSON only. Same keys. Same line counts. No translation — native rewrite.",
  ].join("\n");
}

// ─── STAGE 2.5 — DIRECTOR LAYER V2 (Qwen 3.5 397B, ENFORCEMENT MODE) ────────
// Converts the blueprint into STRICT CREATIVE RULES that the Stage 3
// lyrics writer MUST obey. Does NOT write lyrics. Does NOT repeat the
// blueprint. Does NOT generate structure. Output is strict JSON with 5
// top-level fields: emotion_arc, vocal_execution, constraints,
// hook_plan, language_lock. Stage 3 prepends it to the user prompt as
// LAW (mandatory rules), not soft guidance.
//
// NOTE on section keys: the V2 spec uses "chorus" but the AfroMuse
// internal pipeline (SectionKey, blueprint.flow_map, draft.hook, etc.)
// uses "hook". We instruct the Director to emit "hook" as the section
// key so everything downstream stays aligned.
interface VocalExecutionEntry {
  delivery_style:      string; // chant | melodic | prayer | aggressive | conversational
  repetition_behavior: string; // none | partial | heavy chant loop
  crowd_interaction:   string; // none | light | call-response | choir layer
}
type EmotionArcType = "struggle" | "pain" | "street_survival";
interface DirectorBrief {
  emotion_arc_type?: EmotionArcType;     // chosen progression archetype (V2.1)
  emotion_arc:      Partial<Record<SectionKey, string>>;
  vocal_execution:  Partial<Record<SectionKey, VocalExecutionEntry>>;
  constraints:      string[];
  hook_plan:        string;
  language_lock:    string;
}

const DIRECTOR_SYSTEM_PROMPT = `AFROMUSE DIRECTOR LAYER V2 — ENFORCEMENT MODE

ROLE
You are the AfroMuse Creative Director — FINAL AUTHORITY.
You do NOT suggest. You do NOT guide.
You DEFINE how the lyrics MUST be written.
The lyrics model MUST follow your decisions.

YOUR JOB
Convert the blueprint into STRICT CREATIVE RULES. You own:
- emotional progression (per section, NOT generic labels)
- vocal delivery style (chant / melodic / prayer / aggressive / conversational)
- chant vs melody decisions
- hook dominance
- realism (no translated, textbook, or flat phrasing)

OUTPUT — 5 TOP-LEVEL FIELDS (strict JSON only, no markdown, no fences, no prose):

1) emotion_arc — EXACT emotional state per section. NO generic labels
   ("sad", "emotional peak"). Use lived, specific phrasing
   ("suppressed pain turning into spiritual release").

   ⚡ EMOTION TRANSFORMATION LAW (CRITICAL — applies to emotion_arc):

   Each section MUST introduce a NEW emotional state.
   - No two sections can carry the same emotional tone.
   - Emotion must PROGRESS, not repeat.
   - Each section must feel like a REACTION to the previous one.

   You MUST choose ONE arc archetype based on the input (genre, mood,
   topic, artist reference) and emit it as "emotion_arc_type":

     • "struggle"        → pressure → frustration → emotional crack →
                           prayer → resilience → rise
     • "pain"            → denial → hurt → breakdown → reflection →
                           acceptance
     • "street_survival" → hustle → stress → anger → defiance →
                           victory mindset

   The chosen arc is the SPINE. Map its stages onto the section keys
   (intro/hook/verse1/verse2/bridge/outro). The hook may revisit the
   arc's anchor emotion, but each REPEAT of the hook MUST shift its
   intensity (see hook_plan).

   ENFORCEMENT (self-check before emitting):
   - If two sections feel similar → REWRITE internally before output.
   - If hook does not shift emotional intensity vs verses → INVALID.
   - If verse2 does not evolve from verse1 → INVALID.
   - Return ONLY a brief that passes these checks.

2) vocal_execution — for EACH section define:
     - delivery_style:      chant | melodic | prayer | aggressive | conversational
     - repetition_behavior: none | partial | heavy chant loop
     - crowd_interaction:   none | light | call-response | choir layer

3) constraints — HARD RULES the lyrics model MUST obey. Examples:
   - "Hook MUST use chant repetition (minimum 3 repeats)"
   - "At least 1 call-response pattern in chorus"
   - "Verses MUST not use same tone as chorus"
   - "Repetition MUST increase intensity (not duplicate lines)"
   - "If artist = Asake → enforce chant + choir energy"

4) hook_plan — how the hook HITS, how it EVOLVES each time
   (adlibs / energy / layering changes per repeat).

5) language_lock — tone lock: raw street vs poetic vs spiritual.
   Forbid translated phrasing. Enforce natural dialect rhythm.

SECTION KEYS — USE EXACTLY: intro, hook, verse1, verse2, bridge, outro
(use "hook", NOT "chorus"). Every section key MUST appear in
emotion_arc and vocal_execution.

CRITICAL RULES
- This OVERRIDES all previous soft logic. This is LAW for the lyrics model.
- DO NOT write lyrics. DO NOT generate example lines.
- DO NOT generate structure or sections beyond the 6 listed.
- DO NOT repeat blueprint fields verbatim — INTERPRET them.
- If you violate the schema → generation is invalid.

OUTPUT FORMAT (exact shape):
{
  "emotion_arc_type": "struggle | pain | street_survival",
  "emotion_arc": {
    "intro": "", "hook": "", "verse1": "", "verse2": "", "bridge": "", "outro": ""
  },
  "vocal_execution": {
    "intro":  { "delivery_style": "", "repetition_behavior": "", "crowd_interaction": "" },
    "hook":   { "delivery_style": "", "repetition_behavior": "", "crowd_interaction": "" },
    "verse1": { "delivery_style": "", "repetition_behavior": "", "crowd_interaction": "" },
    "verse2": { "delivery_style": "", "repetition_behavior": "", "crowd_interaction": "" },
    "bridge": { "delivery_style": "", "repetition_behavior": "", "crowd_interaction": "" },
    "outro":  { "delivery_style": "", "repetition_behavior": "", "crowd_interaction": "" }
  },
  "constraints": ["", ""],
  "hook_plan": "",
  "language_lock": ""
}`;

function buildDirectorPrompt(params: {
  topic: string;
  genre: string;
  mood: string;
  languageFlavor: string;
  artistInspiration?: string;
  styleReference?: string;
  notes?: string;
  blueprint: CreativeBlueprint;
}): string {
  const {
    topic, genre, mood, languageFlavor, artistInspiration, styleReference,
    notes, blueprint,
  } = params;
  const artistLine = [artistInspiration, styleReference].filter(Boolean).join(" + ");
  // Compact blueprint — give the Director only the fields it must
  // interpret. We deliberately omit `arrangement_order` /
  // `section_line_targets` style fields so the Director cannot drift
  // into "structure-generation" territory.
  const blueprintCompact = JSON.stringify({
    flow_map:        blueprint.flow_map,
    emotion_map:     blueprint.emotion_map,
    hook_style:      blueprint.hook_style,
    adlib_style:     blueprint.adlib_style,
    artist_behavior: blueprint.artist_behavior,
    energy_curve:    (blueprint as Record<string, unknown>).energy_curve,
    dna_mode:        (blueprint as Record<string, unknown>).dna_mode,
  });
  return [
    "USER INPUT:",
    `idea = ${topic}`,
    `genre = ${genre} | mood = ${mood} | language = ${languageFlavor}`,
    ...(artistLine    ? [`artist reference = ${artistLine}`] : []),
    ...(notes?.trim() ? ["", "USER DIRECTION:", notes.trim()] : []),
    "",
    "CREATIVE BLUEPRINT (interpret — do not repeat):",
    blueprintCompact,
    "",
    "TASK: emit the V2 DIRECTOR BRIEF as strict JSON only. This is LAW.",
  ].join("\n");
}

// Stage 3 system prompt = TIGHT bullet commands. Anything already in the
// blueprint (priority stack, emotion behaviors, flow types, hook gate,
// adlib palettes, artist adaptation, progression) is NOT restated here.
// Hard target: ≤ 1.5 K chars (~400 tokens).
const LYRICS_COMPRESSED_SYSTEM_PROMPT = `AFROMUSE LYRICS WRITER — STAGE 3 (LIGHT)

The blueprint already decided the SHAPE. WRITE lyrics that fit it.

RULES:
- Honor blueprint emotion_map per section (length, repetition, vocab).
- Honor blueprint flow_map per section (chant/smooth/broken/percussive).
- Hook: simple, chantable, repeatable. Anchor with keeperLine. Reuse keeperLine in outro.
- Adlibs: pull from blueprint adlib_style palette. End of phrases or hook climax.
- Chant flow → leader line, then (crowd response) on the next line.
- Dialect: native to the language flavor. No flat generic English.
- No meta inside lyrics: no [Verse 1], no (Note:), no asterisks, no "Translation:".
- No empty lines. No placeholders.
- Match SECTION LINE TARGETS exactly.
- Title fits the song. Keeper line = quotable anchor.

OUTPUT — JSON only, no markdown, no fences:
{
  "title": "",
  "keeperLine": "",
  "keeperLineBackups": ["","",""],
  "intro":  ["",""],
  "hook":   ["","","",""],
  "verse1": ["","","","","","","",""],
  "verse2": ["","","","","","","",""],
  "bridge": ["","","",""],
  "outro":  ["",""],
  "lyricsIntelligenceCore": {
    "vocalFlowBySection": { "intro":"", "verse1":"", "hook1":"", "verse2":"", "bridge":"", "hook2":"", "outro":"" },
    "callAndResponse":    [{ "leader":"", "crowd":"" }],
    "adlibsBySection":    { "intro":[], "verse1":[], "hook1":[], "verse2":[], "bridge":[], "hook2":[], "outro":[] },
    "failureChecks":      { "weakHook": false, "chantMissing": false, "regenerate": false }
  }
}`;

// Stage 2 user prompt = INPUT + BLUEPRINT + SECTION LINE TARGETS only.
// Anything already encoded in the blueprint (emotion behaviors, flow types,
// hook structure, artist mindset, DNA mode, energy curve) is NOT restated.
// The diversity profile only contributes the line-target schema, which the
// blueprint cannot encode by itself.
function buildCompressedLyricsPrompt(params: {
  topic: string;
  genre: string;
  mood: string;
  languageFlavor: string;
  notes?: string;
  artistInspiration?: string;
  styleReference?: string;
  diversityProfile: DiversityProfile;
  blueprint: CreativeBlueprint;
  directorBrief?: DirectorBrief | null;
}): string {
  const { topic, genre, mood, languageFlavor, notes, artistInspiration, styleReference, diversityProfile, blueprint, directorBrief } = params;
  const artistLine = [artistInspiration, styleReference].filter(Boolean).join(" + ");
  const sectionTargets = (Object.keys(diversityProfile.sectionLineTargets) as SectionKey[])
    .map((k) => `  ${k}: ${diversityProfile.sectionLineTargets[k]?.join(" or ")}`)
    .join("\n");
  // Compact JSON (no indentation) — the blueprint is structured data, the
  // model doesn't need pretty-printing and every newline costs tokens.
  const blueprintCompact = JSON.stringify({
    emotion_map:     blueprint.emotion_map,
    flow_map:        blueprint.flow_map,
    hook_style:      blueprint.hook_style,
    adlib_style:     blueprint.adlib_style,
    artist_behavior: blueprint.artist_behavior,
  });
  // DIRECTOR BRIEF V2 — ENFORCEMENT MODE. When present, it sits ABOVE
  // the blueprint as LAW. The writer MUST obey:
  //   • emotion_arc      — exact emotional state per section
  //   • vocal_execution  — delivery_style / repetition_behavior / crowd_interaction per section
  //   • constraints      — hard rules (chant repeats, call-response, no-translation, etc.)
  //   • hook_plan        — how the hook HITS and EVOLVES across repeats
  //   • language_lock    — tone lock + ban on translated/textbook phrasing
  // Violation of any constraint = invalid generation. The blueprint still
  // locks structure / flow / line counts, but the Director's rules
  // override soft logic on delivery, emotion, hook, and language.
  const directorBlock = directorBrief
    ? [
        "DIRECTOR BRIEF V2 — LAW (MANDATORY, ENFORCEMENT MODE):",
        "You MUST obey every field below. Hook adlibs, chant repeats,",
        "call-response, emotion arc, language tone — all defined here.",
        "Violating any item in `constraints` = invalid generation.",
        "",
        "⚡ EMOTION TRANSFORMATION LAW (CRITICAL):",
        "- Each section MUST carry a NEW emotional state (no two sections same tone).",
        "- Emotion must PROGRESS — each section is a REACTION to the previous one.",
        "- Hook MUST shift emotional intensity vs the verses around it.",
        "- Verse2 MUST evolve from verse1 (no copy-paste emotion).",
        `- Follow the chosen arc: ${directorBrief.emotion_arc_type ?? "see emotion_arc"}.`,
        "",
        JSON.stringify(directorBrief),
        "",
      ]
    : [];

  return [
    "INPUT:",
    `idea = ${topic}`,
    `genre = ${genre} | mood = ${mood} | language = ${languageFlavor}`,
    ...(artistLine ? [`artist reference = ${artistLine}`] : []),
    ...(notes?.trim() ? ["", "USER DIRECTION (write to THIS idea):", notes.trim()] : []),
    "",
    ...directorBlock,
    "BLUEPRINT (honor exactly):",
    blueprintCompact,
    "",
    "SECTION LINE TARGETS (locked):",
    sectionTargets,
    "",
    "TASK: write the lyrics. JSON only.",
  ].join("\n");
}

/**
 * Stage 3 — LIGHT validation. Does NOT regenerate. Returns the issues that
 * a targeted single-pass fix can patch (hook strength, repetition, artist
 * alignment). Heavy structural checks already ran (validateStructure,
 * deepCheckLyrics, auditEngineCompliance) inside scoreLyricsDraft.
 */
function lightValidate(
  draft: SongDraft,
  blueprint: CreativeBlueprint,
): { pass: boolean; issues: string[] } {
  const issues: string[] = [];

  // Hook strength — must have a repeated anchor phrase or keeper line
  const hookLines = (draft.hook ?? []) as unknown[];
  const keeper = typeof draft.keeperLine === "string" ? draft.keeperLine.trim() : "";
  if (!keeper || keeper.length < 4) {
    issues.push("hook: missing or too-short keeperLine");
  } else {
    const anchor = keeper.toLowerCase().slice(0, Math.min(keeper.length, 12));
    const hookHasKeeper = hookLines.some((l) => typeof l === "string" && l.toLowerCase().includes(anchor));
    if (hookLines.length > 0 && !hookHasKeeper) {
      issues.push("hook: keeperLine does not appear in the chorus");
    }
  }

  // Repetition — too much line-level repetition flattens the song. Count
  // duplicates across non-hook sections only (the chorus is supposed to
  // repeat 3× in the standard arrangement).
  const nonHookLines: string[] = [];
  for (const k of ["intro", "verse1", "verse2", "bridge", "outro"] as SectionKey[]) {
    const arr = draft[k];
    if (Array.isArray(arr)) for (const v of arr) if (typeof v === "string") nonHookLines.push(v.trim().toLowerCase());
  }
  const dupCount = nonHookLines.length - new Set(nonHookLines).size;
  if (nonHookLines.length > 0 && dupCount / nonHookLines.length > 0.30) {
    issues.push("repetition: too many duplicate lines across non-hook sections");
  }

  // Artist alignment — flow_map drift. We only care about clear contradictions
  // (blueprint says "chant" but trace says "smooth", etc.).
  const trace = (draft as { lyricsIntelligenceCore?: {
    vocalFlowBySection?: Record<string, string>;
    failureChecks?: { weakHook?: boolean; chantMissing?: boolean; regenerate?: boolean };
  } }).lyricsIntelligenceCore;
  if (trace?.vocalFlowBySection && blueprint.flow_map) {
    const mismatches: string[] = [];
    for (const k of ["intro", "verse1", "verse2", "bridge", "outro"] as SectionKey[]) {
      const want = (blueprint.flow_map[k] ?? "").toLowerCase();
      const got = (trace.vocalFlowBySection[k] ?? "").toLowerCase();
      if (want && got && !got.includes(want)) mismatches.push(k);
    }
    if (mismatches.length > 2) issues.push(`artist alignment: flow drift on ${mismatches.length} sections (${mismatches.join(", ")})`);
  }

  // Honor the model's own self-audit
  if (trace?.failureChecks?.weakHook) issues.push("hook: model self-audit flagged weak hook");
  if (trace?.failureChecks?.chantMissing) issues.push("artist alignment: model self-audit flagged chant missing");

  return { pass: issues.length === 0, issues };
}

function buildLightFixPrompt(draft: SongDraft, issues: string[], blueprint: CreativeBlueprint): string {
  return [
    "STAGE 3 LIGHT FIX — minor edits only. Do NOT regenerate the whole song.",
    "Keep section lengths, structure, title, and the overall lyrical content.",
    "Only fix the issues listed below by editing the affected lines.",
    "",
    "ISSUES TO FIX:",
    ...issues.map((i) => `  - ${i}`),
    "",
    "BLUEPRINT (still applies — do not re-derive):",
    JSON.stringify({
      hook_style:  blueprint.hook_style,
      adlib_style: blueprint.adlib_style,
      flow_map:    blueprint.flow_map,
    }, null, 2),
    "",
    "CURRENT DRAFT:",
    JSON.stringify(draft, null, 2),
    "",
    "Return the SAME JSON shape with ONLY the targeted lines edited. JSON only.",
  ].join("\n");
}

// ─── Route ───────────────────────────────────────────────────────────────────

router.post("/generate-song", async (req, res) => {
  const {
    topic, genre, mood, style, notes, songLength, languageFlavor, dialectStyle, customFlavor,
    customLanguage,
    dialectDepth, clarityMode, blendBalance, voiceTexture,
    commercialMode, hitmakerMode, lyricalDepth, hookRepeat, lyricsSource, genderVoiceModel, performanceFeel,
    artistInspiration,
  } = req.body as {
    topic?: string;
    genre?: string;
    mood?: string;
    style?: string;
    notes?: string;
    songLength?: string;
    languageFlavor?: string;
    dialectStyle?: string;
    customFlavor?: string;
    customLanguage?: string;
    dialectDepth?: string;
    clarityMode?: string;
    blendBalance?: string;
    voiceTexture?: string;
    commercialMode?: boolean;
    hitmakerMode?: boolean;
    lyricalDepth?: string;
    hookRepeat?: string;
    lyricsSource?: string;
    genderVoiceModel?: string;
    performanceFeel?: string;
    artistInspiration?: string;
  };

  if (!topic || typeof topic !== "string") {
    res.status(400).json({ error: "topic is required" });
    return;
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    logger.error("NVIDIA_API_KEY not configured");
    res.status(500).json({ error: "AI service not configured" });
    return;
  }

  const selectedGenre  = genre?.trim()          || "Afrobeats";
  const selectedMood   = mood?.trim()            || "Uplifting";
  const selectedLength = ["Short", "Standard", "Full"].includes(songLength ?? "") ? songLength! : "Standard";
  const selectedFlavor = languageFlavor?.trim()  || "Global English";
  const selectedDepth  = lyricalDepth            ?? "Balanced";
  const selectedRepeat = hookRepeat              ?? "Medium";
  const selectedGender = genderVoiceModel        ?? "Random";
  const selectedFeel   = performanceFeel         ?? "Smooth";
  const diversityProfile = createDiversityProfile();

  const promptParams = {
    topic,
    genre: selectedGenre,
    mood: selectedMood,
    style,
    notes,
    songLength: selectedLength,
    languageFlavor: selectedFlavor,
    dialectStyle: dialectStyle && dialectStyle !== "Auto" ? dialectStyle : undefined,
    customFlavor,
    customLanguage: customLanguage?.trim() || undefined,
    dialectDepth: dialectDepth ?? "Balanced Native",
    clarityMode: clarityMode ?? "Artist Real",
    blendBalance: blendBalance ?? undefined,
    voiceTexture: voiceTexture ?? undefined,
    commercialMode: commercialMode === true,
    hitmakerMode: hitmakerMode === true,
    lyricalDepth: selectedDepth,
    hookRepeat: selectedRepeat,
    lyricsSource: lyricsSource ?? "Studio Lyrics",
    genderVoiceModel: selectedGender,
    performanceFeel: selectedFeel,
    diversityProfile,
    artistInspiration: artistInspiration?.trim() || undefined,
  };

  const ai = new OpenAI({
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  const parseJson = (raw: string): Record<string, unknown> | null => {
    try {
      const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  // ── Call a single lyrics model and score its draft ────────────────────────
  // Returns the parsed draft AND a quality score so the caller can pick the
  // best of N parallel attempts. A null draft scores 0.
  const callLyricsModel = async (
    model: { id: string; name: string; temperature: number },
    userPrompt: string,
  ): Promise<{ model: string; draft: SongDraft | null; validation: ValidationResult }> => {
    try {
      const response = await ai.chat.completions.create({
        model: model.id,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: model.temperature,
        top_p: 0.95,
        max_tokens: 4000,
      }, { signal: AbortSignal.timeout(200_000) });
      const raw  = response.choices[0]?.message?.content ?? "";
      const draft = parseJson(raw) as SongDraft | null;
      const validation: ValidationResult = draft
        ? scoreLyricsDraft(draft, diversityProfile)
        : { valid: false, failures: ["parse error"], softIssues: [], qualityScore: 0 };
      return { model: model.name, draft, validation };
    } catch (err) {
      const errObj = err as { name?: string; type?: string; constructor?: { name?: string } } | undefined;
      const ctorName = errObj?.constructor?.name;
      const isAbort =
        ctorName === "APIUserAbortError" ||
        ctorName === "AbortError" ||
        errObj?.name === "APIUserAbortError" ||
        errObj?.name === "AbortError" ||
        errObj?.type === "APIUserAbortError";
      const failureLabel = isAbort ? "api timeout" : "api error";
      logger.warn({ model: model.name, err, failureLabel, ctorName }, "Lyrics model call failed");
      return {
        model: model.name,
        draft: null,
        validation: { valid: false, failures: [failureLabel], softIssues: [], qualityScore: 0 },
      };
    }
  };

  /**
   * Pick the highest-quality draft from a list of attempts.
   *
   * Tie-break order:
   *   1. Highest qualityScore wins (combines structural + deep checks).
   *   2. If scores tie, prefer the one with fewer hard structural failures.
   *   3. If still tied, prefer the one with fewer soft issues.
   *
   * Drafts that failed to generate (null) are filtered out first so they
   * never get picked even if every attempt failed (caller handles that case).
   */
  const pickBestDraft = (
    attempts: { model: string; draft: SongDraft | null; validation: ValidationResult }[],
  ): { model: string; draft: SongDraft | null; validation: ValidationResult } | null => {
    const valid = attempts.filter((a) => a.draft !== null);
    if (valid.length === 0) return null;
    return [...valid].sort((a, b) => {
      const sa = a.validation.qualityScore ?? 0;
      const sb = b.validation.qualityScore ?? 0;
      if (sb !== sa) return sb - sa;
      if (a.validation.failures.length !== b.validation.failures.length) {
        return a.validation.failures.length - b.validation.failures.length;
      }
      return (a.validation.softIssues?.length ?? 0) - (b.validation.softIssues?.length ?? 0);
    })[0] ?? null;
  };

  // ── Call flow/production model (Llama-4-Maverick owns the blueprint end-to-end) ──
  const callFlowModel = async (lyricsDraft: SongDraft): Promise<Record<string, unknown> | null> => {
    const effectiveFlavor = promptParams.languageFlavor === "Custom" && promptParams.customFlavor?.trim()
      ? `Custom: ${promptParams.customFlavor.trim()}`
      : promptParams.languageFlavor;

    const flowPrompt = buildFlowPrompt({
      topic,
      genre: selectedGenre,
      mood: selectedMood,
      languageFlavor: effectiveFlavor,
      lyricalDepth: selectedDepth,
      performanceFeel: selectedFeel,
      genderVoiceModel: selectedGender,
      hookRepeat: selectedRepeat,
      title: (lyricsDraft.title as string) ?? topic,
      keeperLine: (lyricsDraft.keeperLine as string) ?? "",
      lyricsText: draftToLyricsText(lyricsDraft),
    });

    const tryFlow = async (model: { id: string; name: string; temperature: number }): Promise<Record<string, unknown> | null> => {
      try {
        const response = await ai.chat.completions.create({
          model: model.id,
          messages: [
            { role: "system", content: FLOW_SYSTEM_PROMPT },
            { role: "user", content: flowPrompt },
          ],
          temperature: model.temperature,
          top_p: 0.9,
          max_tokens: 1500,
        });
        const raw = response.choices[0]?.message?.content ?? "";
        const result = parseJson(raw);
        if (result) logger.info({ model: model.name }, "Flow model succeeded");
        return result;
      } catch (err) {
        logger.warn({ model: model.name, err }, "Flow model call failed");
        return null;
      }
    };

    // Primary: Llama-4-Maverick (owns the blueprint end-to-end)
    logger.info({ model: MAVERICK_FLOW_MODEL.name }, "Starting Maverick blueprint generation");
    const primary = await tryFlow(MAVERICK_FLOW_MODEL);
    if (primary) return primary;

    // Retry: Llama-4-Maverick at a cooler temperature for stability
    // (Qwen is intentionally NOT used for the blueprint — Maverick owns it.)
    logger.warn("Maverick blueprint failed — retrying Maverick at cooler temperature");
    return await tryFlow(MAVERICK_FLOW_RETRY);
  };

  try {
    // ─── MULTI-STAGE GENERATION PIPELINE (MSGP) ─────────────────────────────
    // STAGE 1: Maverick → creative blueprint (structure/behavior, no lyrics).
    // STAGE 2: Qwen     → lyrics, fed compressed rules + Stage 1 blueprint.
    // STAGE 3: Light    → programmatic checks + targeted Qwen fix (no full regen).
    // POST   : Maverick → production blueprint (BPM/key/stems) — unchanged.
    //
    // Goal: split THINKING (blueprint) from CREATION (lyrics). The full V8.1
    // intelligence stack is NOT resent in Stage 2 — the blueprint carries it.

    const effectiveFlavor = promptParams.languageFlavor === "Custom" && promptParams.customFlavor?.trim()
      ? `Custom: ${promptParams.customFlavor.trim()}`
      : promptParams.languageFlavor;

    // ─── STAGE 1 — Maverick creative blueprint ──────────────────────────────
    // Short, structured prompt so Maverick can be DECISIVE in 10–20s.
    const callBlueprintModel = async (): Promise<CreativeBlueprint | null> => {
      const blueprintPrompt = buildBlueprintPrompt({
        topic,
        genre: selectedGenre,
        mood: selectedMood,
        artistInspiration: promptParams.artistInspiration,
        styleReference: style,
        languageFlavor: effectiveFlavor,
        diversityProfile,
        performanceFeel: selectedFeel,
        notes,
      });

      const tryBlueprint = async (model: { id: string; name: string; temperature: number }): Promise<CreativeBlueprint | null> => {
        try {
          const response = await ai.chat.completions.create({
            model: model.id,
            messages: [
              { role: "system", content: BLUEPRINT_SYSTEM_PROMPT },
              { role: "user", content: blueprintPrompt },
            ],
            temperature: model.temperature,
            top_p: 0.9,
            max_tokens: 1200,
          }, { signal: AbortSignal.timeout(40_000) });
          const raw = response.choices[0]?.message?.content ?? "";
          const parsed = parseJson(raw);
          if (!parsed) return null;
          // Light shape coercion — accept the model's output even if a few
          // optional fields are missing, as long as the core maps exist.
          return {
            emotion_map:   (parsed.emotion_map   as CreativeBlueprint["emotion_map"]) ?? {},
            flow_map:      (parsed.flow_map      as CreativeBlueprint["flow_map"])    ?? {},
            hook_style:    (parsed.hook_style    as string) ?? "",
            adlib_style:   (parsed.adlib_style   as string) ?? "",
            artist_behavior: (parsed.artist_behavior as string) ?? "",
          };
        } catch (err) {
          logger.warn({ model: model.name, err }, "Blueprint call failed");
          return null;
        }
      };

      logger.info({ model: MAVERICK_FLOW_MODEL.name }, "MSGP Stage 1: starting Maverick blueprint");
      const primary = await tryBlueprint(MAVERICK_FLOW_MODEL);
      if (primary) return primary;
      logger.warn("MSGP Stage 1 primary failed — retrying Maverick at cooler temperature");
      return await tryBlueprint(MAVERICK_FLOW_RETRY);
    };

    const stage1Start = Date.now();
    const structureBlueprint = await callBlueprintModel();
    logger.info({ elapsedMs: Date.now() - stage1Start, ok: !!structureBlueprint }, "MSGP Stage 1 complete");

    // ─── STAGE 2 — EMOTION TAG ENGINE (LLaMA 3.2 3B) ────────────────────────
    // Strict authority on emotion direction. Tiny + cool model.
    // Falls back to a deterministic emotion map derived from mood/genre
    // if the model is unavailable (so generation never hard-blocks here).
    const callEmotionEngine = async (sb: CreativeBlueprint): Promise<EmotionTagMap | null> => {
      try {
        const userPrompt = buildEmotionTagPrompt({
          topic,
          genre: selectedGenre,
          mood: selectedMood,
          artistInspiration: promptParams.artistInspiration,
          styleReference: style,
          languageFlavor: effectiveFlavor,
          notes,
          structureBlueprint: sb,
        });
        const response = await ai.chat.completions.create({
          model: LLAMA_EMOTION_MODEL.id,
          messages: [
            { role: "system", content: EMOTION_TAG_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: LLAMA_EMOTION_MODEL.temperature,
          top_p: 0.95,
          max_tokens: 500,
          // Force valid JSON at the API level so we don't fall back to the
          // deterministic table just because LLaMA wrapped its output in
          // markdown fences. Was the #1 cause of "same tags every time".
          response_format: { type: "json_object" },
        }, { signal: AbortSignal.timeout(20_000) });
        const raw = response.choices[0]?.message?.content ?? "";
        const parsed = parseJson(raw) as EmotionTagMap | null;
        if (!parsed || typeof parsed !== "object") return null;
        // Coerce to SectionKey-only keys
        const out: EmotionTagMap = {};
        for (const k of ["intro", "verse1", "hook", "verse2", "bridge", "outro"] as SectionKey[]) {
          const v = (parsed as Record<string, unknown>)[k];
          if (typeof v === "string" && v.trim()) out[k] = v.trim();
        }
        if (!Object.keys(out).length) return null;
        // Programmatic dedup safety net — LLaMA 3.2 3B sometimes repeats tags
        // verbatim despite the rule. We append a section-flavored suffix to any
        // duplicate so the downstream lyrics writer sees evolving emotion.
        const SUFFIX_BY_SECTION: Record<SectionKey, string> = {
          intro:  "(Entry Vibe)",
          verse1: "(Story Build)",
          hook:   "(Climax Wave)",
          verse2: "(Layered Drive)",
          bridge: "(Reflective Shift)",
          outro:  "(Resolution Fade)",
        };
        const seen = new Set<string>();
        for (const k of ["intro", "verse1", "hook", "verse2", "bridge", "outro"] as SectionKey[]) {
          const tag = out[k];
          if (!tag) continue;
          const norm = tag.toLowerCase();
          if (seen.has(norm)) {
            out[k] = `${tag} ${SUFFIX_BY_SECTION[k]}`;
            logger.info({ section: k, before: tag, after: out[k] }, "MSGP Stage 2: dedup'd repeated emotion tag");
          }
          seen.add((out[k] ?? "").toLowerCase());
        }
        return out;
      } catch (err) {
        logger.warn({ model: LLAMA_EMOTION_MODEL.name, err }, "MSGP Stage 2 (emotion engine) failed");
        return null;
      }
    };

    // Mood-bucketed fallback if the emotion engine is unavailable. Each
    // bucket has 3 variants and we pick one at random so even when Stage 2
    // hard-fails, consecutive runs don't ship identical tag maps.
    const FALLBACK_VARIANTS: Record<"spiritual" | "pain" | "hype" | "default", EmotionTagMap[]> = {
      spiritual: [
        { intro:"Quiet Prayer Float", verse1:"Spiritual Survival Pulse", hook:"Prayer Chant Wave (Crowd Ready)", verse2:"Faith Build", bridge:"Reflective Pause", outro:"Triumphant Chant" },
        { intro:"Pre-Dawn Whisper",   verse1:"Soul-Searching Roll",       hook:"Choir-Lift Climax",               verse2:"Surrender Glide", bridge:"Sacred Breath Pause", outro:"Open-Sky Release" },
        { intro:"Candle-Lit Hush",    verse1:"Hymn-Hum Build",            hook:"Crowd Hallelujah Surge",          verse2:"Faith Stomp",     bridge:"Quiet Confession",     outro:"Sunrise Worship Glow" },
      ],
      pain: [
        { intro:"Quiet Pain Float",   verse1:"Pain Chant (Street Choir)", hook:"Pain Chant Climax",               verse2:"Survival Drive",  bridge:"Broken Echo Reflection", outro:"Resolution Whisper" },
        { intro:"Hollow Heart Drift", verse1:"Bruised-Knuckle Confession", hook:"Wounded Crowd Cry",              verse2:"Defiant Limp",    bridge:"Mirror-Stare Stillness", outro:"Bittersweet Exhale" },
        { intro:"Ash-Grey Entry",     verse1:"Tear-Soaked Build",          hook:"Heartbreak Anthem Surge",        verse2:"Slow-Bleed Roll", bridge:"Empty-Room Echo",        outro:"Letting-Go Fade" },
      ],
      hype: [
        { intro:"Street Spark",       verse1:"Confident Roll",            hook:"Crowd-Ready Hype Climax",         verse2:"Punchy Build",    bridge:"Reflective Shift",       outro:"Victory Chant" },
        { intro:"Engine-Rev Ignition",verse1:"Cocky Strut Roll",          hook:"Stadium-Bounce Surge",            verse2:"Champagne Drive", bridge:"Slow-Mo Boast",          outro:"Encore Crowd Roar" },
        { intro:"Neon-Glow Walk-In",  verse1:"Headlight-Bright Build",    hook:"Festival-Stomp Climax",           verse2:"Cocky Counter-Punch", bridge:"Lit-Cigar Pause",     outro:"After-Party Shimmer" },
      ],
      default: [
        { intro:"Curious Entry Vibe", verse1:"Story Build Roll",          hook:"Confident Chant Climax",          verse2:"Layered Drive",   bridge:"Reflective Pause",       outro:"Resolution Wave" },
        { intro:"Late-Night Drift",   verse1:"Memory-Lane Roll",          hook:"Anthem-Heart Surge",              verse2:"Lifted Stride",   bridge:"Quiet Reset",            outro:"Open-Window Ease" },
        { intro:"Soft-Focus Open",    verse1:"Slow-Bloom Build",          hook:"Crowd-Sing Crescendo",            verse2:"Confidence Glide",bridge:"Half-Step Pause",        outro:"Glow-Down Close" },
      ],
    };
    const fallbackEmotionMap = (): EmotionTagMap => {
      const m = (selectedMood || "").toLowerCase();
      const bucket: keyof typeof FALLBACK_VARIANTS =
        /spiritual|gospel|prayer|faith/.test(m)            ? "spiritual" :
        /pain|sad|broken|lonely|melanch/.test(m)           ? "pain"      :
        /hype|party|celebrat|confiden|power|aggress/.test(m) ? "hype"    :
        "default";
      const variants = FALLBACK_VARIANTS[bucket];
      return variants[Math.floor(Math.random() * variants.length)] as EmotionTagMap;
    };

    let emotionTags: EmotionTagMap | null = null;
    if (structureBlueprint) {
      const stage2Start = Date.now();
      logger.info({ model: LLAMA_EMOTION_MODEL.name }, "MSGP Stage 2: starting LLaMA 3.2 emotion engine");
      emotionTags = await callEmotionEngine(structureBlueprint);
      if (!emotionTags) {
        emotionTags = fallbackEmotionMap();
        logger.warn({ tags: emotionTags }, "MSGP Stage 2: emotion engine fell back to deterministic map");
      }
      logger.info({ elapsedMs: Date.now() - stage2Start, tags: emotionTags }, "MSGP Stage 2 complete");
    }

    // Merge emotion tags INTO the structure blueprint so the rest of the
    // pipeline sees one unified CreativeBlueprint contract — no signature
    // changes needed for buildCompressedLyricsPrompt or downstream consumers.
    const blueprint: CreativeBlueprint | null = structureBlueprint
      ? { ...structureBlueprint, emotion_map: emotionTags ?? structureBlueprint.emotion_map ?? {} }
      : null;

    // ─── STAGE 2.5 — DIRECTOR LAYER V2 (Qwen 3.5 397B) — MANDATORY ─────────
    // The Director is FINAL AUTHORITY. There is NO graceful fallback.
    // If the model is unavailable, times out, or returns an invalid brief,
    // the entire generation FAILS and the outer handler returns 500/429
    // to the user. This is enforced because the brief is LAW for Stage 3
    // and the EMOTION TRANSFORMATION LAW cannot be honored without it.
    //
    // The only condition under which Stage 2.5 is skipped is when Stage 1
    // produced no blueprint at all (legacy fallback path) — there is
    // nothing for the Director to interpret.
    let directorBrief: DirectorBrief | null = null;
    if (blueprint) {
      const stage2_5Start = Date.now();
      logger.info(
        { model: QWEN_DIRECTOR_MODEL.name },
        "MSGP Stage 2.5: starting Qwen 3.5 397B director layer (MANDATORY)",
      );
      const directorUserPrompt = buildDirectorPrompt({
        topic,
        genre: selectedGenre,
        mood: selectedMood,
        languageFlavor: effectiveFlavor,
        artistInspiration: promptParams.artistInspiration,
        styleReference: style,
        notes,
        blueprint,
      });
      // No try/catch here — let any error (timeout, 429, 5xx, network)
      // propagate to the outer handler so the user gets a clear failure.
      const directorResponse = await ai.chat.completions.create({
        model: QWEN_DIRECTOR_MODEL.id,
        messages: [
          { role: "system", content: DIRECTOR_SYSTEM_PROMPT },
          { role: "user",   content: directorUserPrompt    },
        ],
        temperature: QWEN_DIRECTOR_MODEL.temperature,
        top_p: 0.9,
        // V2 brief is structurally larger (emotion_arc + vocal_execution
        // are objects-per-section, plus constraints array); give the
        // Director enough headroom to emit complete JSON.
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }, { signal: AbortSignal.timeout(30_000) });
      const raw = directorResponse.choices[0]?.message?.content ?? "";
      const parsed = parseJson(raw) as Record<string, unknown> | null;
      // Defensive normalization: V2 spec uses "chorus" but our pipeline
      // uses "hook". If the model slipped and emitted "chorus", remap it
      // so downstream stays SectionKey-aligned.
      const remapChorusToHook = (obj: unknown): unknown => {
        if (!obj || typeof obj !== "object") return obj;
        const o = obj as Record<string, unknown>;
        if ("chorus" in o && !("hook" in o)) {
          o.hook = o.chorus;
          delete o.chorus;
        }
        return o;
      };
      if (parsed) {
        remapChorusToHook(parsed.emotion_arc);
        remapChorusToHook(parsed.vocal_execution);
      }
      const REQUIRED_SECTIONS: SectionKey[] = ["intro", "hook", "verse1", "verse2", "bridge", "outro"];
      const isVocalEntry = (v: unknown): v is VocalExecutionEntry => {
        if (!v || typeof v !== "object") return false;
        const e = v as Record<string, unknown>;
        return (
          typeof e.delivery_style      === "string" && e.delivery_style.trim().length      > 0 &&
          typeof e.repetition_behavior === "string" && e.repetition_behavior.trim().length > 0 &&
          typeof e.crowd_interaction   === "string" && e.crowd_interaction.trim().length   > 0
        );
      };
      // Normalize emotion_arc_type: accept loose variants like
      // "Street Survival", "STRUGGLE", "pain arc" → snake_case enum.
      const normalizeArcType = (v: unknown): EmotionArcType | undefined => {
        if (typeof v !== "string") return undefined;
        const s = v.toLowerCase().replace(/[\s-]+/g, "_").replace(/_arc$/, "");
        if (s === "struggle" || s === "pain" || s === "street_survival") return s;
        return undefined;
      };
      if (parsed && "emotion_arc_type" in parsed) {
        const norm = normalizeArcType(parsed.emotion_arc_type);
        if (norm) parsed.emotion_arc_type = norm;
        else      delete parsed.emotion_arc_type;
      }
      const isValidBrief = (b: unknown): b is DirectorBrief => {
        if (!b || typeof b !== "object") return false;
        const o = b as Record<string, unknown>;
        const arc = o.emotion_arc     as Record<string, unknown> | undefined;
        const vox = o.vocal_execution as Record<string, unknown> | undefined;
        if (!arc || typeof arc !== "object") return false;
        if (!vox || typeof vox !== "object") return false;
        // At minimum the 4 core sections must be present (bridge / outro
        // can be tolerated as optional — songs without them still ship).
        const CORE: SectionKey[] = ["intro", "hook", "verse1", "verse2"];
        for (const k of CORE) {
          if (typeof arc[k] !== "string" || (arc[k] as string).trim().length === 0) return false;
          if (!isVocalEntry(vox[k])) return false;
        }
        // EMOTION TRANSFORMATION LAW — uniqueness gate. Reject briefs
        // where two sections share the same emotional tone string
        // (case-insensitive, whitespace-normalized). This stops the
        // Director from passing flat or repeating arcs through.
        const arcStrings = Object.values(arc)
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim().toLowerCase().replace(/\s+/g, " "));
        if (new Set(arcStrings).size !== arcStrings.length) return false;
        if (!Array.isArray(o.constraints) || o.constraints.length === 0) return false;
        if (!o.constraints.every((c) => typeof c === "string" && c.trim().length > 0)) return false;
        if (typeof o.hook_plan     !== "string" || o.hook_plan.trim().length     === 0) return false;
        if (typeof o.language_lock !== "string" || o.language_lock.trim().length === 0) return false;
        return true;
      };
      // MANDATORY — invalid brief = hard failure. No fallback.
      if (!isValidBrief(parsed)) {
        logger.error(
          {
            model: QWEN_DIRECTOR_MODEL.name,
            rawChars: raw.length,
            parsedKeys: parsed ? Object.keys(parsed) : null,
          },
          "MSGP Stage 2.5 director brief INVALID — failing generation (no fallback)",
        );
        throw new Error("Director Layer (Qwen 3.5 397B) returned an invalid brief.");
      }
      directorBrief = parsed;
      const arcKeys = Object.keys(directorBrief.emotion_arc);
      const voxKeys = Object.keys(directorBrief.vocal_execution);
      logger.info(
        {
          arcType:          directorBrief.emotion_arc_type ?? "unspecified",
          arcSections:      arcKeys,
          vocalSections:    voxKeys,
          constraintsCount: directorBrief.constraints.length,
          briefChars:       JSON.stringify(directorBrief).length,
          missingSections:  REQUIRED_SECTIONS.filter((s) => !arcKeys.includes(s)),
          elapsedMs:        Date.now() - stage2_5Start,
        },
        "MSGP Stage 2.5 director brief V2 accepted (LAW)",
      );
    }

    // ─── STAGE 3 — LYRICS WRITER (Qwen 122B) — compressed prompt + blueprint ─
    // If Stage 1 produced a blueprint, Stage 3 uses the compressed system
    // prompt + the merged blueprint (structure + emotion). If Stage 1 failed,
    // we fall back to the legacy monolithic prompt so the user still gets a song.
    // When Stage 2.5 produced a director brief, it's prepended to the user
    // prompt as priority guidance.
    const stage3SystemPrompt = blueprint ? LYRICS_COMPRESSED_SYSTEM_PROMPT : SYSTEM_PROMPT;
    const stage3UserPrompt   = blueprint
      ? buildCompressedLyricsPrompt({
          topic,
          genre: selectedGenre,
          mood: selectedMood,
          languageFlavor: effectiveFlavor,
          notes,
          artistInspiration: promptParams.artistInspiration,
          styleReference: style,
          diversityProfile,
          blueprint,
          directorBrief,
        })
      : buildUserPrompt(promptParams, false);

    const callMsgpLyrics = async (
      model: { id: string; name: string; temperature: number },
      systemPrompt: string,
      userPrompt: string,
    ): Promise<{ model: string; draft: SongDraft | null; validation: ValidationResult }> => {
      try {
        const response = await ai.chat.completions.create({
          model: model.id,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: model.temperature,
          top_p: 0.95,
          max_tokens: 4000,
        }, { signal: AbortSignal.timeout(200_000) });
        const raw  = response.choices[0]?.message?.content ?? "";
        const draft = parseJson(raw) as SongDraft | null;
        const validation: ValidationResult = draft
          ? scoreLyricsDraft(draft, diversityProfile)
          : { valid: false, failures: ["parse error"], softIssues: [], qualityScore: 0 };
        return { model: model.name, draft, validation };
      } catch (err) {
        const errObj = err as { name?: string; constructor?: { name?: string } } | undefined;
        const isAbort = errObj?.constructor?.name === "APIUserAbortError" || errObj?.name === "AbortError";
        const failureLabel = isAbort ? "api timeout" : "api error";
        logger.warn({ model: model.name, err, failureLabel }, "MSGP Stage 3 call failed");
        return { model: model.name, draft: null, validation: { valid: false, failures: [failureLabel], softIssues: [], qualityScore: 0 } };
      }
    };

    // PDLCS budget — Stage 3 must stay under 8 K tokens (≈ 32 K chars).
    const stage3TotalChars = stage3SystemPrompt.length + stage3UserPrompt.length;
    const stage3EstTokens  = Math.round(stage3TotalChars / 4);
    const PDLCS_TOKEN_CAP  = 8000;
    if (blueprint && stage3EstTokens > PDLCS_TOKEN_CAP) {
      logger.warn(
        { stage3EstTokens, cap: PDLCS_TOKEN_CAP, sysChars: stage3SystemPrompt.length, userChars: stage3UserPrompt.length },
        "PDLCS budget exceeded — Stage 3 prompt over 8 K tokens; check for new duplication",
      );
    }
    logger.info(
      {
        model: QWEN_LYRICS_MODEL.name,
        mode: blueprint ? "compressed+blueprint" : "legacy-fallback",
        sysChars: stage3SystemPrompt.length,
        userChars: stage3UserPrompt.length,
        estTokens: stage3EstTokens,
      },
      "MSGP Stage 3: starting Qwen lyrics",
    );
    const stage3Start = Date.now();
    const qwenResult = await callMsgpLyrics(QWEN_LYRICS_MODEL, stage3SystemPrompt, stage3UserPrompt);
    logger.info(
      { elapsedMs: Date.now() - stage3Start, score: qwenResult.validation.qualityScore, valid: qwenResult.validation.valid },
      "MSGP Stage 3 complete",
    );

    let finalLyricsDraft: SongDraft | null = qwenResult.draft;

    const stage3Timedout = qwenResult.validation.failures?.includes("api timeout");
    if (!finalLyricsDraft && !stage3Timedout) {
      logger.warn("MSGP Stage 3 returned no draft — running cool-temperature retry");
      const cool = await callMsgpLyrics(QWEN_LYRICS_RETRY_MODEL, stage3SystemPrompt, stage3UserPrompt);
      if (cool.draft) finalLyricsDraft = cool.draft;
    }

    if (!finalLyricsDraft) {
      res.status(500).json({ error: "Failed to generate a song. Please try again." });
      return;
    }

    // ─── STAGE 4 — SOLAR POLISH (Solar 10.7B) ───────────────────────────────
    // Final flow polish. Solar has a HARD 4096-token context window, so we
    // send only the lyric arrays + tight blueprint and ask for only the
    // lyric arrays back. Acceptance gate is STRICT: keep polished only if
    // every section has the EXACT same line count AND the hit score does
    // not drop by more than 2 points. Title / keeperLine / intelligenceCore
    // are preserved on our side regardless of what Solar returns.
    if (blueprint) {
      const stage4Start = Date.now();
      logger.info({ model: SOLAR_POLISH_MODEL.name }, "MSGP Stage 4: starting Solar polish");
      try {
        const polishUserPrompt = buildSolarPolishPrompt({
          draft: finalLyricsDraft,
          blueprint,
          languageFlavor: effectiveFlavor,
        });
        const response = await ai.chat.completions.create({
          model: SOLAR_POLISH_MODEL.id,
          messages: [
            { role: "system", content: SOLAR_POLISH_SYSTEM_PROMPT },
            { role: "user", content: polishUserPrompt },
          ],
          temperature: SOLAR_POLISH_MODEL.temperature,
          top_p: 0.9,
          // Solar context = 4096. Input ~1100 tokens; reserve ~2200 for output.
          max_tokens: 2200,
        }, { signal: AbortSignal.timeout(60_000) });
        const raw = response.choices[0]?.message?.content ?? "";
        // Solar returns ONLY the section arrays (compact shape).
        const polishedSections = parseJson(raw) as Partial<Record<SectionKey, string[]>> | null;

        const sectionKeys: SectionKey[] = ["intro", "verse1", "hook", "verse2", "bridge", "outro"];
        const sectionsMatch = (orig: SongDraft, polish: Partial<Record<SectionKey, string[]>>): boolean =>
          sectionKeys.every((k) => {
            const a = orig[k];
            const b = polish[k];
            return Array.isArray(a) && Array.isArray(b) && a.length === b.length && b.every((line) => typeof line === "string" && line.trim());
          });

        if (polishedSections && sectionsMatch(finalLyricsDraft, polishedSections)) {
          // Build the candidate by overlaying ONLY the polished section arrays
          // onto the original draft — keeperLine / title / intelligenceCore stay.
          const candidate: SongDraft = {
            ...finalLyricsDraft,
            intro:  polishedSections.intro!,
            verse1: polishedSections.verse1!,
            hook:   polishedSections.hook!,
            verse2: polishedSections.verse2!,
            bridge: polishedSections.bridge!,
            outro:  polishedSections.outro!,
          };
          const beforeScore = computeHitScore(finalLyricsDraft).overall;
          const afterScore  = computeHitScore(candidate).overall;
          if (afterScore >= beforeScore - 2) {
            logger.info({ beforeScore, afterScore }, "MSGP Stage 4 polish accepted");
            finalLyricsDraft = candidate;
          } else {
            logger.info({ beforeScore, afterScore }, "MSGP Stage 4 polish rejected — score regression");
          }
        } else if (polishedSections) {
          logger.info("MSGP Stage 4 polish rejected — section line counts or content invalid");
        } else {
          logger.warn("MSGP Stage 4 polish returned no parseable JSON");
        }
      } catch (err) {
        logger.warn({ model: SOLAR_POLISH_MODEL.name, err }, "MSGP Stage 4 polish call failed");
      }
      logger.info({ elapsedMs: Date.now() - stage4Start }, "MSGP Stage 4 complete");
    }

    // ─── STAGE 5 — Light validation + targeted Qwen fix (safety net) ────────
    // Programmatic checks AFTER polish to make sure no regressions slipped
    // through. ONE targeted Qwen pass that edits only the affected lines,
    // kept only if it strictly reduces the issue count.
    if (blueprint) {
      const stage5Start = Date.now();
      const lightCheck = lightValidate(finalLyricsDraft, blueprint);
      if (!lightCheck.pass) {
        logger.info({ issues: lightCheck.issues }, "MSGP Stage 5: running targeted light fix");
        const fixPrompt = buildLightFixPrompt(finalLyricsDraft, lightCheck.issues, blueprint);
        const fixResult = await callMsgpLyrics(QWEN_LYRICS_RETRY_MODEL, LYRICS_COMPRESSED_SYSTEM_PROMPT, fixPrompt);
        if (fixResult.draft) {
          const recheck = lightValidate(fixResult.draft, blueprint);
          if (recheck.issues.length < lightCheck.issues.length) {
            logger.info(
              { before: lightCheck.issues.length, after: recheck.issues.length },
              "MSGP Stage 5 fix accepted",
            );
            finalLyricsDraft = fixResult.draft;
          } else {
            logger.info(
              { before: lightCheck.issues.length, after: recheck.issues.length },
              "MSGP Stage 5 fix rejected — keeping current draft",
            );
          }
        }
      } else {
        logger.info("MSGP Stage 5: draft passed light validation, no fix needed");
      }
      logger.info({ elapsedMs: Date.now() - stage5Start }, "MSGP Stage 5 complete");
    }

    // ─── STAGE 5.5 — STRUCTURE ENFORCEMENT LAYER (verse line counts) ────────
    // ENFORCEMENT MODE: verses MUST have EXACTLY 8, 12, or 16 lines.
    // For any verse that violates, run ONE Qwen pass with strict rules:
    //   - if too long → trim the weakest / redundant lines
    //   - if too short → expand using same tone, cadence, theme
    //   - NEVER change meaning, story, or emotional tone
    // The hook (chorus) is NOT touched here — chorus consistency across
    // repetitions is enforced at the music-engine repeat layer.
    // Acceptance gate is STRICT: each fixed verse must have EXACTLY the
    // target line count. On any failure we ship the existing draft as-is
    // (the lyrics already exist; structure deviation beats no song).
    {
      const stage55Start = Date.now();
      const VERSE_VALID_COUNTS = [8, 12, 16] as const;
      const nearestValidVerseCount = (n: number): number => {
        let best = VERSE_VALID_COUNTS[0];
        let bestDist = Math.abs(n - best);
        for (const c of VERSE_VALID_COUNTS) {
          const d = Math.abs(n - c);
          if (d < bestDist) { bestDist = d; best = c; }
        }
        return best;
      };
      const verseSections: Array<"verse1" | "verse2"> = ["verse1", "verse2"];
      type StructureViolation = {
        section: "verse1" | "verse2";
        current: number;
        target: number;
        lines: string[];
      };
      const violations: StructureViolation[] = [];
      for (const k of verseSections) {
        const arr = finalLyricsDraft[k];
        if (!Array.isArray(arr)) continue;
        const lines = arr.filter((l): l is string => typeof l === "string" && l.trim().length > 0);
        const current = lines.length;
        const target = nearestValidVerseCount(current);
        if (current !== target) {
          violations.push({ section: k, current, target, lines });
        }
      }

      if (violations.length === 0) {
        logger.info("MSGP Stage 5.5: all verses already at valid line counts (8/12/16)");
      } else {
        logger.info(
          { violations: violations.map((v) => ({ section: v.section, current: v.current, target: v.target })) },
          "MSGP Stage 5.5: structure violations detected — running enforcement pass",
        );

        const STRUCTURE_FIX_SYSTEM_PROMPT = [
          "You are the AfroMuse Structure Enforcement Layer.",
          "You DO NOT rewrite the song creatively.",
          "You ONLY fix structure violations by adjusting line counts.",
          "",
          "ABSOLUTE RULES:",
          "1. Each fixed section MUST contain EXACTLY the requested number of lines — no more, no fewer.",
          "2. If you MUST remove lines: drop the weakest, most redundant, or filler lines first. Preserve the strongest hook lines and emotional anchors.",
          "3. If you MUST add lines: write new lines in the SAME tone, style, cadence, theme, and language as the existing lines. Do not introduce new characters, settings, or ideas.",
          "4. NEVER change the meaning, story, or emotional tone of the section.",
          "5. One sentence = one line. Do NOT merge two lines into one. Do NOT split one line into two unnaturally.",
          "6. Preserve the original flow, language, and dialect.",
          "",
          "OUTPUT FORMAT: STRICT JSON ONLY. No markdown, no fences, no commentary, no <think> blocks.",
          'Shape: { "verse1"?: string[], "verse2"?: string[] } — include ONLY the sections you were asked to fix.',
          "Each array MUST have exactly the requested number of non-empty string lines.",
        ].join("\n");

        const fixSpec = violations
          .map((v) => {
            const action = v.current > v.target ? "TRIM" : "EXPAND";
            return [
              `SECTION: ${v.section}`,
              `CURRENT_LINES: ${v.current}`,
              `TARGET_LINES: ${v.target}   ← MUST EXACTLY MATCH`,
              `ACTION: ${action} to reach exactly ${v.target} lines`,
              `LINES:`,
              ...v.lines.map((l, i) => `${i + 1}. ${l}`),
            ].join("\n");
          })
          .join("\n\n");

        const hookContextLines = Array.isArray(finalLyricsDraft.hook)
          ? (finalLyricsDraft.hook as unknown[]).filter((l): l is string => typeof l === "string" && l.trim().length > 0)
          : [];
        const hookContext = hookContextLines.length > 0 ? hookContextLines.join(" / ") : "";

        const structureFixUserPrompt = [
          "Fix the line counts of the following verse(s) to EXACTLY match TARGET_LINES.",
          "Do not change meaning, story, or emotional tone.",
          hookContext ? `\nHook (for tonal context only — DO NOT modify the hook): "${hookContext}"` : "",
          "",
          fixSpec,
          "",
          "Return STRICT JSON containing ONLY the sections listed above, each as an array of strings with EXACTLY the target line count.",
        ]
          .filter(Boolean)
          .join("\n");

        try {
          const structureResp = await ai.chat.completions.create({
            model: QWEN_LYRICS_RETRY_MODEL.id,
            messages: [
              { role: "system", content: STRUCTURE_FIX_SYSTEM_PROMPT },
              { role: "user", content: structureFixUserPrompt },
            ],
            temperature: 0.4,
            top_p: 0.9,
            max_tokens: 1800,
            response_format: { type: "json_object" },
          }, { signal: AbortSignal.timeout(60_000) });

          const raw = structureResp.choices[0]?.message?.content ?? "";
          const fixed = parseJson(raw) as Partial<Record<"verse1" | "verse2", unknown>> | null;

          if (!fixed) {
            logger.warn("MSGP Stage 5.5: structure fix returned no parseable JSON — keeping original draft");
          } else {
            const accepted: Partial<Record<"verse1" | "verse2", string[]>> = {};
            let allValid = true;
            for (const v of violations) {
              const cand = fixed[v.section];
              if (!Array.isArray(cand)) {
                logger.warn(
                  { section: v.section, target: v.target },
                  "MSGP Stage 5.5: section missing or not an array in fix response",
                );
                allValid = false;
                break;
              }
              const cleanLines = cand.filter((l): l is string => typeof l === "string" && l.trim().length > 0);
              if (cleanLines.length !== v.target) {
                logger.warn(
                  { section: v.section, target: v.target, gotRaw: cand.length, gotClean: cleanLines.length },
                  "MSGP Stage 5.5: section did not meet exact target line count",
                );
                allValid = false;
                break;
              }
              accepted[v.section] = cleanLines;
            }

            if (allValid) {
              finalLyricsDraft = { ...finalLyricsDraft, ...accepted };
              logger.info(
                { fixed: violations.map((v) => ({ section: v.section, from: v.current, to: v.target })) },
                "MSGP Stage 5.5 structure fix accepted",
              );
            } else {
              logger.warn("MSGP Stage 5.5: structure fix rejected — keeping original draft");
            }
          }
        } catch (err) {
          logger.warn({ err }, "MSGP Stage 5.5: structure fix call failed — keeping original draft");
        }
      }
      logger.info({ elapsedMs: Date.now() - stage55Start }, "MSGP Stage 5.5 complete");
    }

    // ─── STAGE 6 — LANGUAGE LOCALIZATION (LLaMA 3.1 70B, Custom Language only) ─
    // Activates ONLY when the user provided a Custom Language. Rewrites the
    // finished lyrics into that language as a NATIVE SONGWRITER would —
    // preserving structure, story, emotion, chants, adlibs, and singability.
    // Acceptance gate is STRICT: identical section keys, identical line
    // counts. If the model fails, returns junk, or breaks structure, we
    // keep the Qwen+Solar+Stage-5 draft as-is.
    const localizationTarget = customLanguage?.trim() || "";
    if (localizationTarget) {
      const stage6Start = Date.now();
      logger.info(
        { model: LLAMA_LOCALIZATION_MODEL.name, targetLanguage: localizationTarget },
        "MSGP Stage 6: starting LLaMA 3.1 70B localization",
      );
      const styleContextParts = [
        `genre = ${selectedGenre}`,
        `mood = ${selectedMood}`,
        artistInspiration?.trim() ? `artist reference = ${artistInspiration.trim()}` : "",
        style?.trim() ? `style = ${style.trim()}` : "",
        `performance feel = ${selectedFeel}`,
      ].filter(Boolean);
      const localizationUserPrompt = buildLocalizationPrompt({
        draft: finalLyricsDraft,
        targetLanguage: localizationTarget,
        styleContext: styleContextParts.join(" | "),
      });
      try {
        const localizationResponse = await ai.chat.completions.create({
          model: LLAMA_LOCALIZATION_MODEL.id,
          messages: [
            { role: "system", content: LOCALIZATION_SYSTEM_PROMPT },
            { role: "user",   content: localizationUserPrompt   },
          ],
          temperature: LLAMA_LOCALIZATION_MODEL.temperature,
          response_format: { type: "json_object" },
        });
        const raw = localizationResponse.choices[0]?.message?.content ?? "";
        const localizedSections = parseJson(raw) as Partial<Record<SectionKey, string[]>> | null;
        const sectionKeys: SectionKey[] = ["intro", "hook", "verse1", "verse2", "bridge", "outro"];
        const sectionsMatch = (orig: SongDraft, loc: Partial<Record<SectionKey, string[]>>): boolean =>
          sectionKeys.every((k) => {
            const a = Array.isArray(orig[k]) ? (orig[k] as unknown[]) : [];
            const b = loc[k];
            return Array.isArray(b)
              && b.length === a.length
              && b.every((line) => typeof line === "string" && line.trim().length > 0);
          });
        if (localizedSections && sectionsMatch(finalLyricsDraft, localizedSections)) {
          finalLyricsDraft = {
            ...finalLyricsDraft,
            intro:  localizedSections.intro!,
            hook:   localizedSections.hook!,
            verse1: localizedSections.verse1!,
            verse2: localizedSections.verse2!,
            bridge: localizedSections.bridge!,
            outro:  localizedSections.outro!,
            localization: {
              targetLanguage: localizationTarget,
              model: LLAMA_LOCALIZATION_MODEL.name,
            },
          };
          logger.info(
            { targetLanguage: localizationTarget },
            "MSGP Stage 6 localization accepted",
          );
        } else if (localizedSections) {
          logger.info(
            "MSGP Stage 6 localization rejected — section line counts or content invalid",
          );
        } else {
          logger.warn("MSGP Stage 6 localization returned no parseable JSON");
        }
      } catch (err) {
        logger.warn(
          { model: LLAMA_LOCALIZATION_MODEL.name, err },
          "MSGP Stage 6 localization call failed",
        );
      }
      logger.info({ elapsedMs: Date.now() - stage6Start }, "MSGP Stage 6 complete");
    }

    // ─── POST — Production blueprint (Maverick BPM/key/stems) ───────────────
    // This is the existing post-step that supplies productionNotes,
    // instrumentalGuidance, stemsBreakdown, etc. Distinct from the Stage 1
    // creative blueprint (which is structural/behavioral, not production).
    logger.info("Starting Llama-4-Maverick production blueprint");
    const flowData = await Promise.race([
      callFlowModel(finalLyricsDraft),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 35_000)),
    ]);

    if (flowData) {
      logger.info("Production blueprint generated — merging with lyrics draft");
    } else {
      logger.warn("Production blueprint unavailable — returning lyrics-only draft");
    }

    // ── Merge lyrics + production details into final draft ────────────────
    // Recompute the hit score on the FINAL lyric so the user-facing number
    // reflects exactly what they see in the workspace.
    const finalHitScore = computeHitScore(finalLyricsDraft);
    const mergedDraft: SongDraft = {
      ...finalLyricsDraft,
      ...(flowData ?? {}),
      diversityReport: {
        dnaMode: diversityProfile.dnaMode,
        emotionalLens: diversityProfile.emotionalLens,
        arrangementOrder: diversityProfile.arrangementOrder,
        hookStructure: diversityProfile.hookStructure,
        chorusLengthPattern: diversityProfile.chorusLengthPattern,
        energyCurve: diversityProfile.energyCurve,
        urgencyLevel: diversityProfile.urgencyLevel,
        artistMindset: diversityProfile.artistMindset,
      },
      hitScore: finalHitScore,
      // MSGP — surface the merged creative blueprint (structure + emotion)
      // so the frontend can render the decisions alongside the lyrics.
      // Additive only; existing consumers that ignore these fields are unaffected.
      // creativeBlueprint = full merged contract (structure + emotion).
      // emotionTags        = standalone Stage 2 output (audit trail / UI).
      ...(blueprint     ? { creativeBlueprint: blueprint } : {}),
      ...(emotionTags   ? { emotionTags } : {}),
      ...(directorBrief ? { directorBrief } : {}),
    };

    logger.info(
      {
        overall: finalHitScore.overall,
        hook: finalHitScore.hookStrength,
        emotion: finalHitScore.emotionalImpact,
        flow: finalHitScore.flowQuality,
        originality: finalHitScore.originality,
        performance: finalHitScore.performanceFeel,
      },
      "Hit Score V7 computed",
    );

    res.json({ draft: mergedDraft });
  } catch (err) {
    logger.error({ err }, "NVIDIA API error");
    const status = (err as { status?: number }).status;
    if (status === 429) {
      res.status(429).json({ error: "The AI is busy right now. Please wait a moment and try again." });
    } else {
      res.status(500).json({ error: "AI generation failed. Please try again." });
    }
  }
});

// ─── Make It Harder Route ────────────────────────────────────────────────────

const HARDER_REWRITER_SYSTEM_PROMPT = `You are a senior session songwriter and punch-up writer with 20+ years of Afrobeats, Dancehall, and street music experience. Your only job is to take an existing AI-generated song draft and make every line HARDER, MORE EMOTIONALLY POWERFUL, MORE QUOTABLE, and more artist-performable.

You are NOT generating a new song. You are rewriting the existing one to hit harder.

══════════════════════════════════════════
LAW 1 — PROTECT THE STRUCTURE
══════════════════════════════════════════
- Keep the original song structure EXACTLY: [Intro], [Chorus], [Verse 1], [Verse 2], [Bridge], [Outro]
- Do NOT add or remove sections
- Keep the same approximate line count per section
- The song title may remain the same or be sharpened if needed

══════════════════════════════════════════
LAW 2 — KEEPER LINE — PROTECT OR SHARPEN
══════════════════════════════════════════
- Identify the main hook/keeper line
- If the keeper line is already strong and quotable, protect it verbatim
- If the keeper line is weak or generic, sharpen it into something more memorable and performance-ready
- The keeper line must still appear in the Chorus AND Outro

══════════════════════════════════════════
LAW 3 — MAKE IT HARDER — THE CORE MISSION
══════════════════════════════════════════
TARGET LINES TO REWRITE — these are soft and must be hardened:
  ✗ Lines that sound too polite, too safe, or too gentle for the genre
  ✗ Lines that feel like AI motivational poster content: "rise above the storm", "you are stronger than you know"
  ✗ Lines that over-explain instead of hitting: "I am trying my best in this life" → "Pressure heavy but I still no bend"
  ✗ Lines that are emotionally vague or broad: "You left me and I feel sad" → "You comot, leave my chest in pieces"
  ✗ Lines that describe feelings from outside instead of inside: "They didn't believe in me but I made it" → "Dem laugh first — now dem dey quote me"
  ✗ Lines that sound like a spoken essay instead of a song
  ✗ Generic rhymes that don't create vivid imagery or emotional impact
  ✗ Any line where the emotion is stated but not FELT

WHAT HARDER LINES LOOK LIKE:
  ✓ Confident, direct, emotionally raw — says the exact truth without dressing it up
  ✓ More pressure, more edge, more emotional tension in every line
  ✓ Lines that create a visual or physical feeling when heard
  ✓ Quotable — someone would screenshot this line and post it
  ✓ Performance-ready — an artist could step up to a mic and deliver this live RIGHT NOW
  ✓ Street-believable — feels lived-in, not composed from outside
  ✓ Crowd-chant energy in the hook — the chorus should feel like a rally

══════════════════════════════════════════
LAW 4 — INCREASE THESE THINGS
══════════════════════════════════════════
- Pressure and edge in every verse line
- Emotional directness — say the real thing, not the polite version
- Quotability — every section end should have at least one line worth screenshotting
- Hook energy — the chorus should feel like it was built to be shouted back at a show
- Artist energy and confidence in delivery feel
- Crowd-chant potential in the main hook lines

══════════════════════════════════════════
LAW 5 — DIALECT STAYS NATIVE
══════════════════════════════════════════
- Do NOT flatten dialect into generic English to make it sound "tougher"
- Ghana Urban Pidgin must still feel Ghanaian and harder
- Naija Pidgin must still feel Nigerian and harder
- Jamaican Patois must still feel Jamaican and harder
- The dialect carries culture — hardening the lyrics means making them MORE rooted, not less
- CONSISTENCY LAW: dialect level must be identical from the first intro line to the last outro line

══════════════════════════════════════════
LAW 6 — KEEP IT SINGABLE
══════════════════════════════════════════
- Short, punchy, emotionally loaded lines beat long poetic lines every time
- Every rewritten line must fit naturally into the melodic pocket of the genre
- Natural stress placement, good syllable density — not too cramped, not too sparse
- If a line is too long to deliver in one breath, cut it

══════════════════════════════════════════
LAW 7 — PRESERVE METADATA
══════════════════════════════════════════
- Keep all production notes, arrangement notes, and export notes intact
- Only the lyric lines get hardened — the song's metadata and structural notes are preserved

══════════════════════════════════════════
OUTPUT FORMAT — CRITICAL
══════════════════════════════════════════
Return ONLY a JSON object with this shape:
{
  "keeperLine": "the main keeper/hook line",
  "keeperLineBackups": ["backup 1", "backup 2"],
  "intro": ["line 1", "line 2"],
  "hook": ["line 1", "line 2", "line 3", "line 4"],
  "verse1": ["line 1", "line 2", ...],
  "verse2": ["line 1", "line 2", ...],
  "bridge": ["line 1", "line 2", "line 3", "line 4"],
  "outro": ["line 1", "line 2"]
}

- Output ONLY the JSON object. No explanation, no commentary, no preamble.
- Only include sections that were present in the original lyrics
- Preserve exact section array format
`;

router.post("/harden-lyrics", requireAuth, attachPlanFromDb, requireFeature("canRewriteLyrics"), async (req, res) => {
  const {
    draft, genre, mood, languageFlavor, dialectDepth, clarityMode,
    lyricalDepth, hookRepeat, genderVoiceModel, performanceFeel, style, commercialMode,
  } = req.body as {
    draft?: Record<string, unknown>;
    genre?: string;
    mood?: string;
    languageFlavor?: string;
    dialectDepth?: string;
    clarityMode?: string;
    lyricalDepth?: string;
    hookRepeat?: string;
    genderVoiceModel?: string;
    performanceFeel?: string;
    style?: string;
    commercialMode?: boolean;
  };

  if (!draft || typeof draft !== "object") {
    res.status(400).json({ error: "draft is required" });
    return;
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    logger.error("NVIDIA_API_KEY not configured");
    res.status(500).json({ error: "AI service not configured" });
    return;
  }

  const formatSection = (label: string, lines: unknown): string => {
    if (!Array.isArray(lines) || lines.length === 0) return "";
    return `[${label}]\n${(lines as string[]).join("\n")}`;
  };

  const lyricsText = [
    formatSection("Intro", draft.intro),
    formatSection("Chorus", draft.hook),
    formatSection("Verse 1", draft.verse1),
    formatSection("Verse 2", draft.verse2),
    formatSection("Bridge", draft.bridge),
    formatSection("Outro", draft.outro),
  ].filter(Boolean).join("\n\n");

  const keeperLine = typeof draft.keeperLine === "string" ? draft.keeperLine : "";

  const hardenDepthNote: Record<string, string> = {
    "Simple":   "Simple = short, punchy, raw street hits — no complex imagery, just direct impact",
    "Balanced": "Balanced = direct emotional punch — confident, clear, hard-hitting without being over-explained",
    "Deep":     "Deep = layered raw truth — dense imagery, emotional complexity, every line earns its place",
  };
  const userPrompt = [
    `MAKE IT HARDER — REWRITE TASK`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Genre: ${genre ?? "Afrobeats"}`,
    `Mood: ${mood ?? "Uplifting"}`,
    `Language: ${languageFlavor ?? "Global English"}`,
    ...((languageFlavor && languageFlavor !== "Global English" && languageFlavor !== "English") ? [
      ``,
      `────────────────────────────────────────`,
      `LANGUAGE FLAVOR INSTRUCTION`,
      `────────────────────────────────────────`,
      `Selected language flavor: ${languageFlavor}`,
      ``,
      `You must write in the exact emotional and linguistic style of this flavor.`,
      `Do NOT write "English with slang." Do NOT fake the dialect. Do NOT overuse generic filler phrases.`,
      `Write like a REAL artist from that language world. If a line feels fake, rewrite it.`,
      `────────────────────────────────────────`,
      ``,
    ] : []),
    `Dialect Depth: ${dialectDepth ?? "Balanced Native"}`,
    `Clarity Mode: ${clarityMode ?? "Artist Real"}`,
    `Lyrical Depth: ${lyricalDepth ?? "Balanced"} — ${hardenDepthNote[lyricalDepth ?? "Balanced"] ?? hardenDepthNote["Balanced"]}`,
    `Performance Feel: ${performanceFeel ?? "Smooth"} — every hardened line must still match this performance register — do NOT lose the original feel while adding edge`,
    `Gender / Voice Model: ${genderVoiceModel ?? "Random"} — vocal perspective and phrasing edge must match this voice throughout`,
    `Hook Repeat Level: ${hookRepeat ?? "Medium"} — even after hardening, maintain this hook replay intensity`,
    ...(style?.trim() ? [`Sound Reference: ${style.trim()} — preserve this artist's writing DNA and edge while pushing harder`] : []),
    ...getCommercialModeBlock(commercialMode),
    ...getHookEngineBlock(hookRepeat ?? "Medium"),
    ...getVerseVariationBlock(),
    ...getAdlibGeneratorBlock(),
    ...getMelodyFriendlyBlock(),
    keeperLine ? `Current Keeper Line: "${keeperLine}" — protect if strong, sharpen if weak` : "",
    ``,
    `LYRICS TO HARDEN:`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    lyricsText,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Rewrite every soft, safe, over-explained, or generic line to hit HARDER.`,
    `Increase pressure, edge, emotional directness, and quotability throughout.`,
    `Make every line feel more confident, more raw, more street-believable, and more artist-performable.`,
    `Keep strong lines that already hit hard. Destroy and rebuild weak ones.`,
    `Return ONLY the JSON object. No text before or after.`,
  ].filter((l) => l !== null).join("\n");

  const ai = new OpenAI({
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  const parseHardenJson = (raw: string): Record<string, unknown> | null => {
    try {
      const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  try {
    logger.info({ genre, mood, languageFlavor }, "Starting Make It Harder rewrite");

    const hardenResponse = await ai.chat.completions.create({
      model: QWEN_LYRICS_MODEL.id,
      messages: [
        { role: "system", content: HARDER_REWRITER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      top_p: 0.95,
      max_tokens: 3000,
    }, { signal: AbortSignal.timeout(35_000) });

    const raw = hardenResponse.choices[0]?.message?.content ?? "";
    const hardened = parseHardenJson(raw);

    if (!hardened) {
      logger.error({ raw }, "Failed to parse Make It Harder output");
      res.status(500).json({ error: "Rewriter returned unreadable output. Please try again." });
      return;
    }

    const mergedDraft = {
      ...draft,
      ...(hardened.keeperLine       !== undefined && { keeperLine: hardened.keeperLine }),
      ...(hardened.keeperLineBackups !== undefined && { keeperLineBackups: hardened.keeperLineBackups }),
      ...(Array.isArray(hardened.intro)  && hardened.intro.length  > 0 && { intro:  hardened.intro  }),
      ...(Array.isArray(hardened.hook)   && hardened.hook.length   > 0 && { hook:   hardened.hook   }),
      ...(Array.isArray(hardened.verse1) && hardened.verse1.length > 0 && { verse1: hardened.verse1 }),
      ...(Array.isArray(hardened.verse2) && hardened.verse2.length > 0 && { verse2: hardened.verse2 }),
      ...(Array.isArray(hardened.bridge) && hardened.bridge.length > 0 && { bridge: hardened.bridge }),
      ...(Array.isArray(hardened.outro)  && hardened.outro.length  > 0 && { outro:  hardened.outro  }),
    };

    logger.info("Make It Harder rewrite completed successfully");
    res.json({ draft: mergedDraft });
  } catch (err) {
    logger.error({ err }, "Make It Harder rewriter error");
    const status = (err as { status?: number }).status;
    if (status === 429) {
      res.status(429).json({ error: "The AI is busy right now. Please wait a moment and try again." });
    } else {
      res.status(500).json({ error: "Make It Harder failed. Please try again." });
    }
  }
});

// ─── Make It Catchier Route ──────────────────────────────────────────────────

const CATCHIER_REWRITER_SYSTEM_PROMPT = `You are a professional hit songwriter and hook doctor with 20+ years of Afrobeats, Dancehall, and Afro-inspired music experience. Your only job is to take an existing song draft and make it CATCHIER, MORE MEMORABLE, MORE REPLAYABLE, and more hook-driven.

You are NOT generating a new song. You are rewriting the existing one to make it stick in people's heads.

══════════════════════════════════════════
LAW 1 — PROTECT THE STRUCTURE
══════════════════════════════════════════
- Keep the original song structure EXACTLY: [Intro], [Chorus], [Verse 1], [Verse 2], [Bridge], [Outro]
- Do NOT add or remove sections
- Keep the same approximate line count per section

══════════════════════════════════════════
LAW 2 — KEEPER LINE — STRENGTHEN OR SHARPEN
══════════════════════════════════════════
- Identify the main hook/keeper line
- If it is already catchy, memorable, and chant-ready — protect it verbatim
- If it is forgettable, too long, too complex, or too wordy — sharpen it into something shorter, simpler, and more immediately memorable
- The keeper line must still appear in the Chorus AND Outro

══════════════════════════════════════════
LAW 3 — MAKE IT CATCHIER — THE CORE MISSION
══════════════════════════════════════════
PRIORITY TARGET — focus here first:
  → The chorus / hook — this is the most important section. It must be the catchiest thing in the song.
  → Repeated lines — any line that repeats must earn its repetition by being genuinely memorable
  → The opener of each section — first impressions matter
  → The closing line of each section — last lines land hardest

TARGET LINES TO REWRITE — these are killing the catchiness:
  ✗ Lines that are too wordy — "You are always in my mind every single day" → too many words, loses melodic flow
  ✗ Lines that over-explain — the listener should feel before they think
  ✗ Lines that feel "written" not "sung" — if it reads like a sentence instead of a melody, rewrite it
  ✗ Lines that are forgettable — no one would sing this back after one listen
  ✗ Lines that are melodically clunky — too many stressed syllables, unnatural phrasing
  ✗ Hooks that try to say too much — the best hooks say ONE thing, clearly, memorably

WHAT CATCHIER LINES LOOK LIKE:
  ✓ Short, singable, melodically natural — fewer words, more impact
  ✓ Emotionally immediate — you feel the point before you process the words
  ✓ Crowd sing-back ready — someone hears it once and hums it on the way home
  ✓ Bounce-friendly — good syllable density for the groove, natural stress placement
  ✓ Quotable — people would use this as a caption or text it to someone
  ✓ Sticky opener — the first line of the chorus must hook instantly
  ✓ Repetition where it works — if a phrase is strong, let it land twice

EXAMPLE REWRITES:
  "You are always in my mind every day" → "Na you dey my mind, all night"
  "God has been helping me through every struggle" → "God carry me, no lie"
  "They didn't believe in me before success" → "Dem laugh then — now dem sing am"

══════════════════════════════════════════
LAW 4 — INCREASE THESE THINGS
══════════════════════════════════════════
- Melodic simplicity — less is more
- Chantability — can a crowd sing this back after one listen?
- Emotional stickiness — the feeling should land fast and stay
- Bounce and flow — lines should move naturally with the groove
- Quotable phrase density — aim for at least one screenshot-worthy line per section
- Replay magnetism — the song should pull people back for another listen

══════════════════════════════════════════
LAW 5 — CATCHY ≠ CORNY
══════════════════════════════════════════
- Catchy does NOT mean childish or oversimplified
- Catchy does NOT mean repetitive nonsense
- Catchy does NOT mean sacrificing authenticity for pop appeal
- The goal is something a real artist would keep after a real studio session
- Think: Wizkid's hooks, Burna Boy's refrains, Sean Paul's one-liners — effortless and unforgettable

══════════════════════════════════════════
LAW 6 — DIALECT STAYS NATIVE
══════════════════════════════════════════
- Do NOT flatten dialect into generic English to make it sound "catchier"
- Ghana Urban Pidgin must still feel Ghanaian and catchier
- Naija Pidgin must still feel Nigerian and catchier
- Jamaican Patois must still feel Jamaican and catchier
- Native dialect IS the catchiness — it carries the bounce, the color, the identity
- CONSISTENCY LAW: dialect level must be identical from first line to last line

══════════════════════════════════════════
LAW 7 — PRESERVE METADATA
══════════════════════════════════════════
- Keep all production notes, arrangement notes, and export notes intact
- Only the lyric lines get the catchiness pass

══════════════════════════════════════════
OUTPUT FORMAT — CRITICAL
══════════════════════════════════════════
Return ONLY a JSON object with this shape:
{
  "keeperLine": "the main keeper/hook line",
  "keeperLineBackups": ["backup 1", "backup 2"],
  "intro": ["line 1", "line 2"],
  "hook": ["line 1", "line 2", "line 3", "line 4"],
  "verse1": ["line 1", "line 2", ...],
  "verse2": ["line 1", "line 2", ...],
  "bridge": ["line 1", "line 2", "line 3", "line 4"],
  "outro": ["line 1", "line 2"]
}

- Output ONLY the JSON object. No explanation, no commentary, no preamble.
- Only include sections that were present in the original lyrics
- Preserve exact section array format
`;

router.post("/catchier-lyrics", requireAuth, attachPlanFromDb, requireFeature("canRewriteLyrics"), async (req, res) => {
  const {
    draft, genre, mood, languageFlavor, dialectDepth, clarityMode,
    lyricalDepth, hookRepeat, genderVoiceModel, performanceFeel, style, commercialMode,
  } = req.body as {
    draft?: Record<string, unknown>;
    genre?: string;
    mood?: string;
    languageFlavor?: string;
    dialectDepth?: string;
    clarityMode?: string;
    lyricalDepth?: string;
    hookRepeat?: string;
    genderVoiceModel?: string;
    performanceFeel?: string;
    style?: string;
    commercialMode?: boolean;
  };

  if (!draft || typeof draft !== "object") {
    res.status(400).json({ error: "draft is required" });
    return;
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    logger.error("NVIDIA_API_KEY not configured");
    res.status(500).json({ error: "AI service not configured" });
    return;
  }

  const formatSection = (label: string, lines: unknown): string => {
    if (!Array.isArray(lines) || lines.length === 0) return "";
    return `[${label}]\n${(lines as string[]).join("\n")}`;
  };

  const lyricsText = [
    formatSection("Intro", draft.intro),
    formatSection("Chorus", draft.hook),
    formatSection("Verse 1", draft.verse1),
    formatSection("Verse 2", draft.verse2),
    formatSection("Bridge", draft.bridge),
    formatSection("Outro", draft.outro),
  ].filter(Boolean).join("\n\n");

  const keeperLine = typeof draft.keeperLine === "string" ? draft.keeperLine : "";

  const catchierDepthNote: Record<string, string> = {
    "Simple":   "Simple = trim aggressively — pure syllabic punch, minimal words, maximum memorability",
    "Balanced": "Balanced = simplify without losing authentic feel — every word should earn its place",
    "Deep":     "Deep = preserve poetic layers but boost melodic memorability — the hook can be complex AND sticky",
  };
  const hookRepeatNote: Record<string, string> = {
    "Low":    "Low = one clean pass — don't over-repeat the hook phrase, let verses breathe",
    "Medium": "Medium = standard chorus feel — hook phrase repeats 2-3 times per section naturally",
    "High":   "High = maximum chant-loop potential — the hook phrase should feel like a crowd anthem, highly repeatable",
  };
  const userPrompt = [
    `MAKE IT CATCHIER — REWRITE TASK`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Genre: ${genre ?? "Afrobeats"}`,
    `Mood: ${mood ?? "Uplifting"}`,
    `Language: ${languageFlavor ?? "Global English"}`,
    ...((languageFlavor && languageFlavor !== "Global English" && languageFlavor !== "English") ? [
      ``,
      `────────────────────────────────────────`,
      `LANGUAGE FLAVOR INSTRUCTION`,
      `────────────────────────────────────────`,
      `Selected language flavor: ${languageFlavor}`,
      ``,
      `You must write in the exact emotional and linguistic style of this flavor.`,
      `Do NOT write "English with slang." Do NOT fake the dialect. Do NOT overuse generic filler phrases.`,
      `Write like a REAL artist from that language world. If a line feels fake, rewrite it.`,
      `────────────────────────────────────────`,
      ``,
    ] : []),
    `Dialect Depth: ${dialectDepth ?? "Balanced Native"}`,
    `Clarity Mode: ${clarityMode ?? "Artist Real"}`,
    `Lyrical Depth: ${lyricalDepth ?? "Balanced"} — ${catchierDepthNote[lyricalDepth ?? "Balanced"] ?? catchierDepthNote["Balanced"]}`,
    `Hook Repeat Level: ${hookRepeat ?? "Medium"} — ${hookRepeatNote[hookRepeat ?? "Medium"] ?? hookRepeatNote["Medium"]} — this is the primary driver of how the hook is restructured`,
    `Performance Feel: ${performanceFeel ?? "Smooth"} — what "catchy" means depends on this register: Airy = floaty melodic hooks; Street = short quotable bars; Soulful = emotional resonance; Confident = bold declarative phrases`,
    `Gender / Voice Model: ${genderVoiceModel ?? "Random"} — singability and phrasing feel must naturally match this vocal perspective`,
    ...(style?.trim() ? [`Sound Reference: ${style.trim()} — the catchier version must still sound like it belongs in this artist's world`] : []),
    ...getCommercialModeBlock(commercialMode),
    ...getHookEngineBlock(hookRepeat ?? "Medium"),
    ...getVerseVariationBlock(),
    ...getAdlibGeneratorBlock(),
    ...getMelodyFriendlyBlock(),
    keeperLine ? `Current Keeper Line: "${keeperLine}" — protect if already catchy, sharpen if weak` : "",
    ``,
    `LYRICS TO MAKE CATCHIER:`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    lyricsText,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Focus on the chorus first — it must be the catchiest, most singable, most chant-ready part of the song.`,
    `Rewrite every line that is too wordy, too complex, too forgettable, or melodically clunky.`,
    `Make the hook shorter, simpler, and more immediately memorable without losing the dialect or the feeling.`,
    `Keep lines that already stick. Rebuild the ones that don't.`,
    `Return ONLY the JSON object. No text before or after.`,
  ].filter((l) => l !== null).join("\n");

  const ai = new OpenAI({
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  const parseCatchierjson = (raw: string): Record<string, unknown> | null => {
    try {
      const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  try {
    logger.info({ genre, mood, languageFlavor }, "Starting Make It Catchier rewrite");

    const catchierResponse = await ai.chat.completions.create({
      model: QWEN_LYRICS_MODEL.id,
      messages: [
        { role: "system", content: CATCHIER_REWRITER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.88,
      top_p: 0.95,
      max_tokens: 3000,
    }, { signal: AbortSignal.timeout(35_000) });

    const raw = catchierResponse.choices[0]?.message?.content ?? "";
    const catchier = parseCatchierjson(raw);

    if (!catchier) {
      logger.error({ raw }, "Failed to parse Make It Catchier output");
      res.status(500).json({ error: "Rewriter returned unreadable output. Please try again." });
      return;
    }

    const mergedDraft = {
      ...draft,
      ...(catchier.keeperLine       !== undefined && { keeperLine: catchier.keeperLine }),
      ...(catchier.keeperLineBackups !== undefined && { keeperLineBackups: catchier.keeperLineBackups }),
      ...(Array.isArray(catchier.intro)  && catchier.intro.length  > 0 && { intro:  catchier.intro  }),
      ...(Array.isArray(catchier.hook)   && catchier.hook.length   > 0 && { hook:   catchier.hook   }),
      ...(Array.isArray(catchier.verse1) && catchier.verse1.length > 0 && { verse1: catchier.verse1 }),
      ...(Array.isArray(catchier.verse2) && catchier.verse2.length > 0 && { verse2: catchier.verse2 }),
      ...(Array.isArray(catchier.bridge) && catchier.bridge.length > 0 && { bridge: catchier.bridge }),
      ...(Array.isArray(catchier.outro)  && catchier.outro.length  > 0 && { outro:  catchier.outro  }),
    };

    logger.info("Make It Catchier rewrite completed successfully");
    res.json({ draft: mergedDraft });
  } catch (err) {
    logger.error({ err }, "Make It Catchier rewriter error");
    const status = (err as { status?: number }).status;
    if (status === 429) {
      res.status(429).json({ error: "The AI is busy right now. Please wait a moment and try again." });
    } else {
      res.status(500).json({ error: "Make It Catchier failed. Please try again." });
    }
  }
});

// ─── Rewrite Lyrics Route ────────────────────────────────────────────────────

const REWRITER_SYSTEM_PROMPT = `You are a professional Afrobeats, Dancehall, and Afro-inspired songwriter with 20+ years of session experience. Your only job is to REWRITE AI-generated lyrics and make them 100% authentic, human, and singable.

You are not a lyric generator. You are a lyric editor and humanizer. You take what the AI wrote and make it sound like a real artist wrote it.

══════════════════════════════════════════
LAW 1 — PROTECT THE STRUCTURE
══════════════════════════════════════════
- Keep the original song structure EXACTLY: [Intro], [Chorus], [Verse 1], [Verse 2], [Bridge], [Outro]
- Do NOT add or remove sections
- Keep the same approximate line count per section

══════════════════════════════════════════
LAW 2 — KEEP THE KEEPER LINE
══════════════════════════════════════════
- Identify the main hook/keeper line and protect it
- The keeper line must survive the rewrite intact or only slightly polished
- It must still appear in the Chorus AND Outro

══════════════════════════════════════════
LAW 3 — KILL AI LANGUAGE — NO EXCEPTIONS
══════════════════════════════════════════
LINES YOU MUST REWRITE OR DELETE:
  ✗ Literal English translation into Pidgin or Patois — if it sounds like a sentence was written in English then the dialect words were swapped in, rewrite it from scratch in the dialect
  ✗ Over-explained emotions — "I feel a deep and powerful connection every time you look at me" → should just be "every time you look at me, e don do"
  ✗ Generic AI emotional essay phrasing: "in this moment I find myself", "searching for something real", "time is fleeting but our love stands strong", "together we can face anything"
  ✗ Greeting card / motivational poster lines: "rise above the storm", "you are stronger than you know", "believe in yourself"
  ✗ Unanchored floating metaphors: "like rivers flowing to the sea" as filler
  ✗ Vague spiritual abstraction: "the universe whispers my name", "I am light finding its way through darkness"
  ✗ Lines that are awkward, forced, or unnatural when sung aloud
  ✗ Lines with too many syllables that break the natural flow

WHAT REAL LINES LOOK LIKE:
  ✓ Short, natural, spoken-language phrasing
  ✓ Culturally grounded details — real places, real situations, real feelings
  ✓ Lines a crowd could shout back at a show
  ✓ Lines that feel lived-in, not observed from outside
  ✓ Conversational rhythm — how people actually talk and feel

══════════════════════════════════════════
LAW 4 — DIALECT MUST BE NATIVE-BORN
══════════════════════════════════════════
- Write FROM INSIDE the dialect, not English-first-then-translated
- For Naija Pidgin: use natural Pidgin construction — "e go beta", "I no go leave", "na she be that", "omo", "wahala", "sabi"
- For Jamaican Patois: use real Patois builds — "mi nuh", "dem cyaan", "inna di", "real suh", "yuh nuh see it", "nuff love"
- CONSISTENCY LAW: the dialect level must be identical from the first intro line to the last outro line
  → If 4 lines feel native and then 2 lines drift back to clean English — those 2 lines fail — rewrite them

══════════════════════════════════════════
LAW 5 — RHYTHM & SINGABILITY
══════════════════════════════════════════
- Every rewritten line must fit naturally into the melodic pocket of Afrobeats or Dancehall
- Natural stress placement, good syllable density — not too cramped, not too sparse
- Lines should end on strong syllables or natural cadences
- If a line is too long to sing naturally in one breath, shorten it

══════════════════════════════════════════
LAW 6 — SIMPLIFY AGGRESSIVELY
══════════════════════════════════════════
- Short is better. "No wahala" beats "I have no problems with this situation at all"
- 6 words that hit hard > 14 words that explain themselves
- If you can cut a word and the line still works — cut it
- The listener should FEEL the line before they process it

══════════════════════════════════════════
OUTPUT FORMAT — CRITICAL
══════════════════════════════════════════
Return ONLY a JSON object with this shape:
{
  "keeperLine": "the main keeper/hook line",
  "keeperLineBackups": ["backup 1", "backup 2"],
  "intro": ["line 1", "line 2"],
  "hook": ["line 1", "line 2", "line 3", "line 4"],
  "verse1": ["line 1", "line 2", ...],
  "verse2": ["line 1", "line 2", ...],
  "bridge": ["line 1", "line 2", "line 3", "line 4"],
  "outro": ["line 1", "line 2"]
}

- Output ONLY the JSON object. No explanation, no commentary, no preamble.
- Only include sections that were present in the original lyrics
- Preserve exact section array format
`;

router.post("/rewrite-lyrics", requireAuth, attachPlanFromDb, requireFeature("canRewriteLyrics"), async (req, res) => {
  const {
    draft, genre, mood, languageFlavor, dialectDepth, clarityMode,
    lyricalDepth, hookRepeat, genderVoiceModel, performanceFeel, style, commercialMode,
  } = req.body as {
    draft?: Record<string, unknown>;
    genre?: string;
    mood?: string;
    languageFlavor?: string;
    dialectDepth?: string;
    clarityMode?: string;
    lyricalDepth?: string;
    hookRepeat?: string;
    genderVoiceModel?: string;
    performanceFeel?: string;
    style?: string;
    commercialMode?: boolean;
  };

  if (!draft || typeof draft !== "object") {
    res.status(400).json({ error: "draft is required" });
    return;
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    logger.error("NVIDIA_API_KEY not configured");
    res.status(500).json({ error: "AI service not configured" });
    return;
  }

  const formatSection = (label: string, lines: unknown): string => {
    if (!Array.isArray(lines) || lines.length === 0) return "";
    return `[${label}]\n${(lines as string[]).join("\n")}`;
  };

  const lyricsText = [
    formatSection("Intro", draft.intro),
    formatSection("Chorus", draft.hook),
    formatSection("Verse 1", draft.verse1),
    formatSection("Verse 2", draft.verse2),
    formatSection("Bridge", draft.bridge),
    formatSection("Outro", draft.outro),
  ].filter(Boolean).join("\n\n");

  const keeperLine = typeof draft.keeperLine === "string" ? draft.keeperLine : "";

  const humanizeDepthNote: Record<string, string> = {
    "Simple":   "Simple = clear, conversational, streetwise — no complex imagery, direct and singable",
    "Balanced": "Balanced = natural mix of depth and directness — human phrasing without losing meaning",
    "Deep":     "Deep = preserve rich metaphor and emotional complexity — the humanized version should feel like a storytelling artist wrote it",
  };
  const userPrompt = [
    `HUMANIZE LYRICS — REWRITE TASK`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Genre: ${genre ?? "Afrobeats"}`,
    `Mood: ${mood ?? "Uplifting"}`,
    `Language: ${languageFlavor ?? "Global English"}`,
    ...((languageFlavor && languageFlavor !== "Global English" && languageFlavor !== "English") ? [
      ``,
      `────────────────────────────────────────`,
      `LANGUAGE FLAVOR INSTRUCTION`,
      `────────────────────────────────────────`,
      `Selected language flavor: ${languageFlavor}`,
      ``,
      `You must write in the exact emotional and linguistic style of this flavor.`,
      `Do NOT write "English with slang." Do NOT fake the dialect. Do NOT overuse generic filler phrases.`,
      `Write like a REAL artist from that language world. If a line feels fake, rewrite it.`,
      `────────────────────────────────────────`,
      ``,
    ] : []),
    `Dialect Depth: ${dialectDepth ?? "Balanced Native"}`,
    `Clarity Mode: ${clarityMode ?? "Artist Real"}`,
    `Lyrical Depth: ${lyricalDepth ?? "Balanced"} — ${humanizeDepthNote[lyricalDepth ?? "Balanced"] ?? humanizeDepthNote["Balanced"]}`,
    `Performance Feel: ${performanceFeel ?? "Smooth"} — the humanized version must feel natural for an artist with this exact performance register — phrasing, breath pockets, and line endings should match`,
    `Gender / Voice Model: ${genderVoiceModel ?? "Random"} — rewrite phrasing to naturally match this vocal perspective — word choices, contractions, and delivery cues should fit this voice`,
    `Hook Repeat Level: ${hookRepeat ?? "Medium"} — preserve the hook's sing-along potential at this intensity level during humanization`,
    ...(style?.trim() ? [`Sound Reference: ${style.trim()} — the humanized version must still sound like it belongs authentically in this artist's world`] : []),
    ...getCommercialModeBlock(commercialMode),
    ...getHookEngineBlock(hookRepeat ?? "Medium"),
    ...getVerseVariationBlock(),
    ...getAdlibGeneratorBlock(),
    ...getMelodyFriendlyBlock(),
    keeperLine ? `Main Keeper Line to preserve: "${keeperLine}"` : "",
    ``,
    `ORIGINAL AI LYRICS TO REWRITE:`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    lyricsText,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Now rewrite every line that sounds AI-generated, over-translated, generic, or unnatural.`,
    `Keep every line that already sounds authentic, human, and singable.`,
    `The output must feel like it was written by a real artist in this genre — not generated.`,
    `Return ONLY the JSON object. No text before or after.`,
  ].filter((l) => l !== null).join("\n");

  const ai = new OpenAI({
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  const parseRewriteJson = (raw: string): Record<string, unknown> | null => {
    try {
      const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  try {
    logger.info({ genre, mood, languageFlavor }, "Starting lyrics humanization (rewrite)");

    const rewriteResponse = await ai.chat.completions.create({
      model: QWEN_LYRICS_MODEL.id,
      messages: [
        { role: "system", content: REWRITER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.85,
      top_p: 0.95,
      max_tokens: 3000,
    }, { signal: AbortSignal.timeout(35_000) });

    const raw = rewriteResponse.choices[0]?.message?.content ?? "";
    const rewritten = parseRewriteJson(raw);

    if (!rewritten) {
      logger.error({ raw }, "Failed to parse rewriter output");
      res.status(500).json({ error: "Rewriter returned unreadable output. Please try again." });
      return;
    }

    const mergedDraft = {
      ...draft,
      ...(rewritten.keeperLine       !== undefined && { keeperLine: rewritten.keeperLine }),
      ...(rewritten.keeperLineBackups !== undefined && { keeperLineBackups: rewritten.keeperLineBackups }),
      ...(Array.isArray(rewritten.intro)  && rewritten.intro.length  > 0 && { intro:  rewritten.intro  }),
      ...(Array.isArray(rewritten.hook)   && rewritten.hook.length   > 0 && { hook:   rewritten.hook   }),
      ...(Array.isArray(rewritten.verse1) && rewritten.verse1.length > 0 && { verse1: rewritten.verse1 }),
      ...(Array.isArray(rewritten.verse2) && rewritten.verse2.length > 0 && { verse2: rewritten.verse2 }),
      ...(Array.isArray(rewritten.bridge) && rewritten.bridge.length > 0 && { bridge: rewritten.bridge }),
      ...(Array.isArray(rewritten.outro)  && rewritten.outro.length  > 0 && { outro:  rewritten.outro  }),
    };

    logger.info("Lyrics humanization completed successfully");
    res.json({ draft: mergedDraft });
  } catch (err) {
    logger.error({ err }, "Lyrics rewriter error");
    const status = (err as { status?: number }).status;
    if (status === 429) {
      res.status(429).json({ error: "The AI is busy right now. Please wait a moment and try again." });
    } else {
      res.status(500).json({ error: "Lyrics rewriting failed. Please try again." });
    }
  }
});

// ─── Smart Rewrite ───────────────────────────────────────────────────────────
// Free-text targeted edit: only touches what the instruction explicitly names.
// Preserves all other sections, line counts, and the keeper line verbatim.

const SMART_REWRITER_SYSTEM_PROMPT = `You are a precision surgical lyric editor for Afrobeats, Afropop, and African music.

The artist gives you an INSTRUCTION describing exactly which part of the song to change and how.
Your job is to apply ONLY that targeted change — nothing else.

SURGICAL EDITING RULES:
1. Read the instruction carefully and identify which section(s) it targets.
2. Only rewrite lines in the targeted section(s). Leave all other sections UNTOUCHED — copy them verbatim.
3. Preserve every line count exactly. If a section has 4 lines, return exactly 4 lines.
4. Preserve the keeper line exactly as given unless the instruction explicitly says to change it.
5. Honor the dialect, language flavor, and song context throughout the targeted edit.
6. Do not improve, polish, or "help" sections that were not mentioned in the instruction.
7. Apply the instruction literally and precisely — no creative liberties outside the target.

OUTPUT FORMAT — return ONLY this JSON object, no text before or after:
{
  "intro":   [...] or null if section was not changed,
  "hook":    [...] or null if section was not changed,
  "verse1":  [...] or null if section was not changed,
  "verse2":  [...] or null if section was not changed,
  "bridge":  [...] or null if section was not changed,
  "outro":   [...] or null if section was not changed,
  "keeperLine": "..." or null if not changed
}

Return null for any section you did NOT modify. Only return arrays for sections you actually changed.`;

router.post("/smart-rewrite-lyrics", requireAuth, attachPlanFromDb, requireFeature("canRewriteLyrics"), async (req, res) => {
  const {
    draft, instruction, genre, mood, languageFlavor, dialectDepth, clarityMode,
    lyricalDepth, genderVoiceModel, performanceFeel, style,
  } = req.body as {
    draft?: Record<string, unknown>;
    instruction?: string;
    genre?: string;
    mood?: string;
    languageFlavor?: string;
    dialectDepth?: string;
    clarityMode?: string;
    lyricalDepth?: string;
    genderVoiceModel?: string;
    performanceFeel?: string;
    style?: string;
  };

  if (!draft || typeof draft !== "object") {
    res.status(400).json({ error: "draft is required" });
    return;
  }
  if (!instruction || typeof instruction !== "string" || instruction.trim().length < 5) {
    res.status(400).json({ error: "instruction is required (at least 5 characters)" });
    return;
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    logger.error("NVIDIA_API_KEY not configured");
    res.status(500).json({ error: "AI service not configured" });
    return;
  }

  const formatSection = (label: string, lines: unknown): string => {
    if (!Array.isArray(lines) || lines.length === 0) return "";
    return `[${label}]\n${(lines as string[]).join("\n")}`;
  };

  const lyricsText = [
    formatSection("Intro",   draft.intro),
    formatSection("Chorus",  draft.hook),
    formatSection("Verse 1", draft.verse1),
    formatSection("Verse 2", draft.verse2),
    formatSection("Bridge",  draft.bridge),
    formatSection("Outro",   draft.outro),
  ].filter(Boolean).join("\n\n");

  const keeperLine = typeof draft.keeperLine === "string" ? draft.keeperLine : "";

  const userPrompt = [
    `SMART REWRITE — TARGETED EDIT`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Genre: ${genre ?? "Afrobeats"}`,
    `Mood: ${mood ?? "Uplifting"}`,
    `Language: ${languageFlavor ?? "Global English"}`,
    dialectDepth ? `Dialect Depth: ${dialectDepth}` : "",
    clarityMode  ? `Clarity Mode: ${clarityMode}`   : "",
    lyricalDepth ? `Lyrical Depth: ${lyricalDepth}` : "",
    performanceFeel ? `Performance Feel: ${performanceFeel}` : "",
    genderVoiceModel ? `Voice Model: ${genderVoiceModel}` : "",
    style?.trim() ? `Sound Reference: ${style.trim()}` : "",
    keeperLine ? `Keeper Line (protect unless instructed to change): "${keeperLine}"` : "",
    ``,
    `ARTIST'S INSTRUCTION:`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    instruction.trim(),
    ``,
    `CURRENT LYRICS:`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    lyricsText,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `Apply ONLY the artist's instruction above. Return null for every section you did not change.`,
    `Return ONLY the JSON object. No text before or after.`,
  ].filter((l) => l !== null).join("\n");

  const ai = new OpenAI({
    apiKey,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });

  const parseSmartJson = (raw: string): Record<string, unknown> | null => {
    try {
      const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : cleaned) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  try {
    logger.info({ genre, mood, instruction: instruction.trim().slice(0, 80) }, "Starting smart rewrite");

    const smartResponse = await ai.chat.completions.create({
      model: QWEN_LYRICS_MODEL.id,
      messages: [
        { role: "system", content: SMART_REWRITER_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.82,
      top_p: 0.95,
      max_tokens: 3000,
    }, { signal: AbortSignal.timeout(35_000) });

    const raw = smartResponse.choices[0]?.message?.content ?? "";
    const edited = parseSmartJson(raw);

    if (!edited) {
      logger.error({ raw: raw.slice(0, 200) }, "Smart rewrite returned unreadable output");
      res.status(500).json({ error: "Smart rewrite returned unreadable output. Please try again." });
      return;
    }

    // Merge only the sections Qwen actually changed (non-null arrays)
    const mergedDraft = {
      ...draft,
      ...(typeof edited.keeperLine === "string" && edited.keeperLine.trim()
        ? { keeperLine: edited.keeperLine }
        : {}),
      ...(Array.isArray(edited.intro)  && edited.intro.length  > 0 ? { intro:  edited.intro  } : {}),
      ...(Array.isArray(edited.hook)   && edited.hook.length   > 0 ? { hook:   edited.hook   } : {}),
      ...(Array.isArray(edited.verse1) && edited.verse1.length > 0 ? { verse1: edited.verse1 } : {}),
      ...(Array.isArray(edited.verse2) && edited.verse2.length > 0 ? { verse2: edited.verse2 } : {}),
      ...(Array.isArray(edited.bridge) && edited.bridge.length > 0 ? { bridge: edited.bridge } : {}),
      ...(Array.isArray(edited.outro)  && edited.outro.length  > 0 ? { outro:  edited.outro  } : {}),
    };

    logger.info("Smart rewrite completed successfully");
    res.json({ draft: mergedDraft });
  } catch (err) {
    logger.error({ err }, "Smart rewrite error");
    const status = (err as { status?: number }).status;
    if (status === 429) {
      res.status(429).json({ error: "The AI is busy right now. Please wait a moment and try again." });
    } else {
      res.status(500).json({ error: "Smart rewrite failed. Please try again." });
    }
  }
});

export default router;

function getSongwritingCompressionBlock(): string[] {
  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🎵 SONGWRITING COMPRESSION LAW",
    "╚══════════════════════════════════════════════╝",
    "",
    "Do NOT over-explain emotions.",
    "Do NOT turn verses into essays.",
    "Shorter lines are usually stronger.",
    "If a line can be said in 5 words instead of 11, choose 5.",
    "",
    "Prioritize:",
    "  - singable phrases",
    "  - emotional clarity",
    "  - repeatable melodic lines",
    "  - memorable bar endings",
    "  - natural pause points",
    "",
    "A strong line should feel performable immediately.",
    "If it sounds like a paragraph, rewrite it.",
    "",
    "Hooks should feel:",
    "  - simple",
    "  - chantable",
    "  - emotionally obvious",
    "  - easy to remember after one listen",
    "",
    "If the listener cannot sing it back quickly, simplify it.",
  ];
}

function getCommercialModeBlock(commercialMode?: boolean): string[] {
  if (!commercialMode) return [];

  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  💿 COMMERCIAL MODE — HIT-FRIENDLY WRITING",
    "╚══════════════════════════════════════════════╝",
    "",
    "This song must feel commercially strong and replayable.",
    "Write with mainstream music appeal while keeping emotional authenticity.",
    "",
    "PRIORITIZE:",
    "  - catchy hooks",
    "  - short memorable phrases",
    "  - repeatable chorus lines",
    "  - melodic simplicity",
    "  - emotionally direct writing",
    "  - easy sing-back moments",
    "",
    "AVOID:",
    "  - over-writing",
    "  - too many complicated metaphors",
    "  - dense bars that block melody",
    "  - long explanations",
    "  - abstract poetry that weakens replay value",
    "",
    "COMMERCIAL HOOK LAW:",
    "The chorus must sound like something listeners can remember after one listen.",
    "If the hook is smart but not sticky, simplify it.",
    "",
    "STREAMING TEST:",
    "Would this song still hit after 10 replays?",
    "Would people want to quote the hook in captions or sing it out loud?",
    "If not, rewrite for stronger replay value.",
  ];
}

function getHookEngineBlock(hookRepeat: string = "Medium"): string[] {
  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🎯 HOOK ENGINE — CHORUS PRIORITY MODE",
    "╚══════════════════════════════════════════════╝",
    "",
    "The hook is the MOST IMPORTANT part of the song.",
    "It must feel natural, memorable, emotionally obvious, and instantly singable.",
    "",
    "HOOK REQUIREMENTS:",
    "  - easy to remember",
    "  - emotionally clear",
    "  - native to the chosen language style",
    "  - performable live",
    "  - strong enough to carry the whole song",
    "",
    "A weak verse can survive.",
    "A weak hook kills the song.",
    "",
    "GOOD HOOKS FEEL LIKE:",
    "  - something a real artist would repeat naturally",
    "  - something fans can shout back",
    "  - something simple enough to stick fast",
    "",
    "AVOID:",
    "  - over-explaining in the chorus",
    "  - too many changing ideas in one hook",
    "  - long poetic sentences",
    "  - fake-deep lines that are not chantable",
  ].concat(
    hookRepeat === "Low"
      ? [
          "",
          "HOOK REPETITION MODE: LOW",
          "Use lighter repetition. Keep the chorus memorable without repeating too aggressively.",
        ]
      : hookRepeat === "High"
      ? [
          "",
          "HOOK REPETITION MODE: HIGH",
          "Use stronger repetition for maximum catchiness and chantability.",
          "Lean into key emotional phrases repeating naturally.",
        ]
      : [
          "",
          "HOOK REPETITION MODE: MEDIUM",
          "Balance repetition and variation for strong replay value.",
        ]
  );
}

function getVerseVariationBlock(): string[] {
  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🧠 VERSE VARIATION ENGINE",
    "╚══════════════════════════════════════════════╝",
    "",
    "Each verse must feel like it has a DIFFERENT job.",
    "Do NOT let every verse repeat the same emotional angle.",
    "",
    "VERSE DESIGN RULES:",
    "  - Verse 1 should introduce the world, emotion, or problem.",
    "  - Verse 2 should deepen the story, pressure, desire, or conflict.",
    "  - If there is Verse 3 or a bridge, it should reveal truth, reflection, or climax.",
    "",
    "Each section must add NEW emotional value.",
    "Do NOT keep saying the same thing in slightly different words.",
    "",
    "AVOID:",
    "  - repeated emotional summaries",
    "  - multiple verses with identical message",
    "  - saying the hook idea again without new detail",
    "",
    "Every verse must earn its place.",
    "If a section adds nothing new, rewrite it.",
  ];
}

function getAdlibGeneratorBlock(): string[] {
  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🎤 ADLIB GENERATOR MODE",
    "╚══════════════════════════════════════════════╝",
    "",
    "Where appropriate, lightly include natural adlib moments.",
    "Adlibs must feel artist-real, not excessive or cartoonish.",
    "",
    "ADLIB FORMAT — MANDATORY:",
    "  All adlibs MUST be written inside parentheses within the lyric line.",
    "  Examples:",
    "    'Na you my mind dey run to (you know)'",
    "    'I no fit leave (no no no)'",
    "    'Dem never rate me (never) but I still rise'",
    "    'Hold me close (hold me) never let go'",
    "  NEVER write adlibs as standalone lines. Always inline inside parentheses.",
    "",
    "ADLIB STYLE RULES:",
    "  - keep them short",
    "  - place them where emotion or rhythm naturally opens space",
    "  - use them more in hooks, intros, outros, and transitions",
    "  - do NOT overload every line",
    "",
    "GOOD ADLIB TYPES:",
    "  - emotional echoes",
    "  - quiet emphasis",
    "  - melodic call-backs",
    "  - reaction sounds",
    "  - spiritual exclamations (if theme fits)",
    "  - street emphasis (if theme fits)",
    "",
    "BAD ADLIB BEHAVIOR:",
    "  - too many after every line",
    "  - random generic 'yeah yeah' spam",
    "  - adlibs that break emotional tone",
    "",
    "Adlibs should support performance feel — not distract from the writing.",
  ];
}

function getMelodyFriendlyBlock(): string[] {
  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🎶 MELODY-FIRST WRITING MODE",
    "╚══════════════════════════════════════════════╝",
    "",
    "Write every section so it sits naturally on melody.",
    "The lyrics must feel SINGABLE before they feel clever.",
    "",
    "MELODY RULES:",
    "  - prefer shorter lines over overloaded lines",
    "  - allow breathing space",
    "  - leave room for rhythm and vocal bounce",
    "  - avoid too many hard-to-sing word clusters",
    "  - keep vowel flow smooth where possible",
    "",
    "TEST EVERY LINE:",
    "Can a real artist sing this without rewriting it in studio?",
    "If not, simplify or reshape the line.",
    "",
    "A strong line should:",
    "  - bounce naturally",
    "  - land emotionally fast",
    "  - leave room for delivery style",
    "",
    "Do NOT write like an essay.",
    "Do NOT write like spoken explanation.",
    "Write like music.",
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// USER CREATIVE DIRECTION
// ─────────────────────────────────────────────────────────────────────────────
//
// Replaces the previous behavior where the user's "Prompt / Direction" textarea
// was emitted as a weak `extra notes = ...` line buried inside the INPUT block.
// That label has near-zero attention weight on a tightly-instructed model and
// was being routinely ignored — exactly the bug the user reported.
//
// Instead we emit a high-priority directive block at the top of the prompt,
// and a short reinforcement reminder at the very bottom (last-context anchor).
// The double-anchor is the most reliable way to make a small/mid-sized LLM
// actually honor user-supplied steering text without us having to fine-tune.
//
// Both functions are no-ops when the user did not provide any direction,
// so prompts stay clean for users who leave the field blank.
// ─────────────────────────────────────────────────────────────────────────────

export function buildUserCreativeDirectionBlock(notes?: string): string[] {
  const trimmed = notes?.trim();
  if (!trimmed) return [];

  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  ⚡ USER CREATIVE DIRECTION — PRIORITY DIRECTIVE",
    "╚══════════════════════════════════════════════╝",
    "",
    "The user has provided EXPLICIT creative direction for this song.",
    "This is the PRIMARY creative driver — it overrides any conflicting default.",
    "",
    "USER DIRECTION:",
    `> ${trimmed.split("\n").join("\n> ")}`,
    "",
    "YOU MUST APPLY THIS DIRECTION TO:",
    "  - the thematic content of every section",
    "  - the imagery, metaphors, and concrete details",
    "  - the narrative direction and emotional arc",
    "  - the hook idea and keeperLine",
    "  - any specific elements, names, or scenes the user requested",
    "",
    "RULES:",
    "  - If the user names a person, place, or feeling, it MUST appear in the lyrics.",
    "  - If the user describes a scene, the song MUST take place in or evoke that scene.",
    "  - If the user requests a specific angle, every section must serve that angle.",
    "  - Do NOT default to generic theme variations — write to THIS direction.",
    "",
    "Treat this block as the brief from the artist themselves.",
    "Failure to honor it is a failed generation.",
  ];
}

export function buildUserCreativeDirectionReminder(notes?: string): string[] {
  const trimmed = notes?.trim();
  if (!trimmed) return [];
  // Keep the reminder small but unmistakable — last context wins.
  return [
    "",
    "──────────────────────────────────────────────────",
    "FINAL REMINDER — USER CREATIVE DIRECTION:",
    `"${trimmed.replace(/\s+/g, " ").slice(0, 400)}"`,
    "Honor this in every section before submitting.",
    "──────────────────────────────────────────────────",
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AFROMUSE LYRICS INTELLIGENCE V7 — LAYER 1: MELODY DIRECTION ENGINE
// ─────────────────────────────────────────────────────────────────────────────
//
// Tells the model what melodic SHAPE each section should support so the lyric
// writer thinks like a topliner, not a poet. Different genres reward different
// melodic contours (Afrobeats = chantable repetition + vowel extensions;
// Amapiano = sparse phrasing on top of log-drum gaps; R&B = long held vowels;
// Hip-Hop = dense rhythmic syllables). We map genre → contour profile, then
// give per-section guidance: where to soar, where to whisper, where to pause.
// ─────────────────────────────────────────────────────────────────────────────

interface MelodyContourProfile {
  hookContour: string;
  verseRhythm: string;
  bridgeShape: string;
  syllableDensity: string;
  vowelStrategy: string;
  signature: string;
}

function resolveMelodyContour(genre: string, mood: string): MelodyContourProfile {
  const g = genre.toLowerCase();
  const m = mood.toLowerCase();

  if (g.includes("amapiano")) {
    return {
      hookContour: "low-mid call answered by a soaring repeated phrase — leave breathing space for log-drum hits",
      verseRhythm: "sparse, conversational, half-time feel; let groove carry between phrases",
      bridgeShape: "drop tempo perception, then release into the final hook",
      syllableDensity: "low-to-medium — fewer words per bar than Afrobeats, more pocket",
      vowelStrategy: "extend last vowel of each phrase to ride the shaker pattern",
      signature: "Amapiano",
    };
  }
  if (g.includes("afrobeat") || g.includes("afro-fusion") || g.includes("afro fusion")) {
    return {
      hookContour: "anthemic, chantable, vowel-rich repetition — fans should be able to sing it the second time it hits",
      verseRhythm: "syncopated medium density; bounce on the off-beat, breathe on the down-beat",
      bridgeShape: "lift in melody (raise the keynote a step or two) then fall back into the hook",
      syllableDensity: "medium — favor short punchy lines that land on the 1 and 3",
      vowelStrategy: "open vowels (a, o, e) on hook tail words for chantability",
      signature: "Afrobeats",
    };
  }
  if (g.includes("trap") || g.includes("drill")) {
    return {
      hookContour: "rhythmic monotone with one melodic lift — repetition is the hook",
      verseRhythm: "dense triplet flows; deliberate pocket between bars",
      bridgeShape: "stripped-down half-bar phrases, then explode back into the hook",
      syllableDensity: "high — multi-syllable internal rhymes and triplet patterns",
      vowelStrategy: "consonant-heavy; let percussive consonants (k, t, p) drive rhythm",
      signature: "Trap/Drill",
    };
  }
  if (g.includes("r&b") || g.includes("rnb") || g.includes("soul")) {
    return {
      hookContour: "long-held melodic phrases with melismatic runs — singer's playground",
      verseRhythm: "smooth and conversational; favor space over filler",
      bridgeShape: "high emotional climb, often a key change or dynamic swell",
      syllableDensity: "low-to-medium — singer needs room to embellish",
      vowelStrategy: "extended open vowels for runs; minimize hard consonants on long notes",
      signature: "R&B/Soul",
    };
  }
  if (g.includes("hip") || g.includes("rap")) {
    return {
      hookContour: "punchy 4-bar hook with one big melodic line and a rhythmic counter",
      verseRhythm: "dense, internal rhymes, multi-syllable wordplay; drive bar-by-bar",
      bridgeShape: "tempo shift or beat switch; either strip back or double-time",
      syllableDensity: "high — bars should feel full but never crowded",
      vowelStrategy: "rhyme on the last and second-to-last syllable; chain assonance",
      signature: "Hip-Hop",
    };
  }
  if (g.includes("dancehall") || g.includes("reggae")) {
    return {
      hookContour: "chant-style call-and-response with a punchy repeated tag",
      verseRhythm: "off-beat skank; ride the riddim, don't fight it",
      bridgeShape: "drop to a dub-style breakdown, then return to full hook",
      syllableDensity: "medium; favor short emphatic phrases over essays",
      vowelStrategy: "elongate the final word of each line for skank emphasis",
      signature: "Dancehall/Reggae",
    };
  }
  if (g.includes("highlife") || g.includes("juju")) {
    return {
      hookContour: "melodic call-and-response, often layered with backing harmony",
      verseRhythm: "flowing, narrative-driven, follows the guitar line",
      bridgeShape: "instrumental-style melodic hook restated with new lyrics",
      syllableDensity: "medium-low — singer should converse over the groove",
      vowelStrategy: "round, sung vowels; let consonants stay soft",
      signature: "Highlife",
    };
  }
  if (g.includes("gospel") || g.includes("worship")) {
    return {
      hookContour: "ascending phrase that climaxes on a held note — congregational lift",
      verseRhythm: "narrative testimony rhythm; declarative not boastful",
      bridgeShape: "modulation upward, build into worship climax",
      syllableDensity: "low-to-medium; clarity beats density",
      vowelStrategy: "open vowels on the climactic note for vocal projection",
      signature: "Gospel",
    };
  }
  if (g.includes("pop")) {
    return {
      hookContour: "instantly memorable 4-bar hook with vowel-rich payoff line",
      verseRhythm: "tight, conversational, sets up the hook at all costs",
      bridgeShape: "harmonic shift then return to a doubled, bigger hook",
      syllableDensity: "medium — every syllable should earn its place",
      vowelStrategy: "front-load consonants, end phrases on open vowels",
      signature: "Pop",
    };
  }
  // Default — neutral but still actionable.
  return {
    hookContour: "memorable repeated melodic phrase that anchors the song",
    verseRhythm: "conversational, musical, leaves room for delivery",
    bridgeShape: "emotional or harmonic lift before returning to the hook",
    syllableDensity: "medium — favor singability over density",
    vowelStrategy: "open vowels on payoff syllables",
    signature: genre || "Default",
  };
}

export function getMelodyDirectionBlock(genre: string, mood: string, performanceFeel: string): string[] {
  const profile = resolveMelodyContour(genre, mood);
  const moodLine =
    /aggressive|gritty|raw|hard/i.test(mood) ? "Push consonants and clipped phrasing — the melody should feel pressurized."
    : /romantic|seductive|smooth|tender/i.test(mood) ? "Long phrases, soft entries, melismatic tail-ends — melody should feel like a caress."
    : /uplifting|joyful|celebrat|anthemic/i.test(mood) ? "Soaring tail-notes on the hook, vowel-rich payoff lines — lift the room."
    : /melancholic|sad|heartbreak|reflective/i.test(mood) ? "Descending melodic lines on emotional pivots, half-step bends, breath in the gaps."
    : "Match the melodic shape to the emotional arc of each line.";

  const feelLine =
    /smooth/i.test(performanceFeel) ? "Smooth feel — favor legato phrasing, fewer hard syllabic stops."
    : /aggressive|hard|raw/i.test(performanceFeel) ? "Aggressive feel — front-load punchy consonants, shorter melodic phrases."
    : /melodic/i.test(performanceFeel) ? "Melodic feel — extended vowel runs, melismatic ornament lines."
    : /spoken|talky/i.test(performanceFeel) ? "Spoken/talky feel — rhythm-first phrasing, melody is implied not sung."
    : "Match phrasing to the chosen performance feel.";

  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🎼 MELODY DIRECTION ENGINE — V7",
    "╚══════════════════════════════════════════════╝",
    "",
    `Genre signature: ${profile.signature}`,
    "",
    "Write each section so it supports a real melodic shape — not just words.",
    "A topliner / vocalist must be able to sing this without rewriting in the booth.",
    "",
    "PER-SECTION MELODIC GUIDANCE:",
    `  - INTRO:   atmospheric setup — sparse phrasing, sets the emotional key`,
    `  - VERSE:   ${profile.verseRhythm}`,
    `  - HOOK:    ${profile.hookContour}`,
    `  - BRIDGE:  ${profile.bridgeShape}`,
    `  - OUTRO:   release and resolution — fade emotional weight, leave the listener with the hook`,
    "",
    "GLOBAL CONTOUR RULES:",
    `  - Syllable density target: ${profile.syllableDensity}`,
    `  - Vowel strategy: ${profile.vowelStrategy}`,
    `  - Mood shape: ${moodLine}`,
    `  - Performance feel: ${feelLine}`,
    "",
    "MELODIC TESTS BEFORE SUBMITTING:",
    "  1. Does the hook have at least one open-vowel payoff word a singer can extend?",
    "  2. Does each verse leave breathing space, or is it wall-to-wall syllables?",
    "  3. Does the bridge actually shift the melodic energy, not just the words?",
    "  4. Are line lengths varied enough to imply a melodic contour, not flat prose?",
    "",
    "If any answer is no, reshape the line until it sings.",
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AFROMUSE LYRICS INTELLIGENCE V7 — LAYER 2: VOICE STYLE SIMULATION
// ─────────────────────────────────────────────────────────────────────────────
//
// Derives a vocal PERSONA from mood + performance feel + gender model + genre.
// The persona drives: word choice, rhythm cadence, attitude, and personality
// consistency across sections. Without this layer the LLM tends to drift —
// verse 1 sounds like a different artist than verse 2. With it the lyrics
// feel like ONE singer, with ONE point of view, the whole way through.
// ─────────────────────────────────────────────────────────────────────────────

interface VoicePersona {
  name: string;
  attitude: string;
  vocabulary: string;
  cadence: string;
  bannedTropes: string;
  pronoun: string;
}

function resolveVoicePersona(
  mood: string,
  performanceFeel: string,
  genderVoiceModel: string,
  genre: string,
): VoicePersona {
  const m = mood.toLowerCase();
  const g = genre.toLowerCase();
  const f = performanceFeel.toLowerCase();
  const gender = genderVoiceModel.toLowerCase();
  const pronoun =
    gender.includes("female") || gender.includes("woman") ? "she/her (female-leading vocal)"
    : gender.includes("male") || gender.includes("man") ? "he/him (male-leading vocal)"
    : "neutral — write so either a male or female lead can deliver it";

  // Match the strongest signal first. Order matters — gospel beats romantic
  // when both are present, etc.
  if (g.includes("gospel") || g.includes("worship") || /spiritual|prayer|testim/i.test(mood)) {
    return {
      name: "Spiritual-Reflective",
      attitude: "humble authority, testimony-driven, reverent but personal",
      vocabulary: "scripture-adjacent imagery (light, water, rising, fire), no profanity, no boast vocabulary",
      cadence: "declarative, breath-supported, builds to climactic confession",
      bannedTropes: "no street swagger, no romantic seduction language, no flex talk",
      pronoun,
    };
  }
  if (/aggressive|gritty|raw|hard|trench/i.test(mood) || g.includes("trap") || g.includes("drill")) {
    return {
      name: "Street-Raw",
      attitude: "lived-in, unbothered, hard-earned confidence — not cartoon villain",
      vocabulary: "concrete street imagery, specific not generic; minimal cliche flexes",
      cadence: "clipped, percussive, leaves space for the beat to hit",
      bannedTropes: "no fairy-tale romance, no spiritual softness, no over-poetic metaphor",
      pronoun,
    };
  }
  if (/romantic|seductive|tender|love|passion/i.test(mood) || g.includes("r&b") || g.includes("rnb")) {
    return {
      name: "Smooth-Seductive",
      attitude: "intimate, magnetic, vulnerable but in control",
      vocabulary: "sensory detail (touch, scent, gaze), emotional specificity over cliche",
      cadence: "long phrases, breathy entries, melismatic tail-ends",
      bannedTropes: "no boast bars, no street threat language, no detached cool",
      pronoun,
    };
  }
  if (/melancholic|sad|heartbreak|loss|reflective/i.test(mood)) {
    return {
      name: "Heartbroken-Vulnerable",
      attitude: "wounded but honest, no self-pity spiral, processing in real time",
      vocabulary: "specific personal detail, sense memory, no generic sad-song cliche",
      cadence: "slower phrasing, descending melodic implication, breath in the gaps",
      bannedTropes: "no triumphant flex, no party energy, no over-stylized poetry",
      pronoun,
    };
  }
  if (/uplifting|joyful|celebrat|anthemic|hope/i.test(mood) || g.includes("afrobeat") || g.includes("highlife")) {
    return {
      name: "Joyful-Anthemic",
      attitude: "communal, generous, celebrating without ego",
      vocabulary: "open imagery (sun, sky, dance, gather), inclusive language, gratitude beats",
      cadence: "syncopated bounce, chantable hooks, breathing on the down-beat",
      bannedTropes: "no doom imagery, no isolation language, no detached cool",
      pronoun,
    };
  }
  if (/confident|bold|empower|win/i.test(mood) || g.includes("hip") || g.includes("rap")) {
    return {
      name: "Confident-Bold",
      attitude: "earned authority, not bragging — telling truth about what they've done",
      vocabulary: "specific accomplishments and references over generic flex words",
      cadence: "internal rhymes, multi-syllable wordplay, punchy bar endings",
      bannedTropes: "no self-pity, no fairy-tale romance, no spiritual surrender",
      pronoun,
    };
  }
  // Default — coherent neutral persona instead of nothing.
  return {
    name: "Authentic-Storyteller",
    attitude: "honest narrator with a clear point of view, emotionally present",
    vocabulary: "specific concrete detail; avoid abstract platitudes and stock phrases",
    cadence: f.includes("smooth") ? "smooth, conversational, breath-supported" : "rhythmic, varied, performance-aware",
    bannedTropes: "no clichéd genre filler that any artist would say",
    pronoun,
  };
}

export function getVoiceStyleSimulationBlock(
  mood: string,
  performanceFeel: string,
  genderVoiceModel: string,
  genre: string,
): string[] {
  const persona = resolveVoicePersona(mood, performanceFeel, genderVoiceModel, genre);
  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🎙️ VOICE STYLE SIMULATION — V7",
    "╚══════════════════════════════════════════════╝",
    "",
    `VOCAL PERSONA: ${persona.name}`,
    "",
    "Write the entire song as ONE consistent vocalist. Every section must feel",
    "like the same human is singing — same point of view, same vocabulary world,",
    "same emotional posture. No section should feel like a different artist.",
    "",
    "PERSONA CONTRACT:",
    `  - Attitude:    ${persona.attitude}`,
    `  - Vocabulary:  ${persona.vocabulary}`,
    `  - Cadence:     ${persona.cadence}`,
    `  - Pronoun:     ${persona.pronoun}`,
    `  - Banned:      ${persona.bannedTropes}`,
    "",
    "CONSISTENCY RULES:",
    "  - The narrator's worldview and stakes must be the same in verse 1, verse 2, and bridge.",
    "  - Pronoun and gender perspective must be stable across the whole song.",
    "  - The vocabulary world must not switch genres mid-song (no street swagger in a worship verse, no scripture imagery in a flex verse, etc.).",
    "  - Emotional posture can DEEPEN section to section — it must not RESET.",
    "",
    "Before submitting, re-read each section and ask:",
    "  \"Does this sound like the same person who sang the previous section?\"",
    "If not, rewrite until the voice locks in.",
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AFROMUSE LYRICS INTELLIGENCE V8 — ARTIST STYLE TRANSLATION ENGINE (ASTE)
// ─────────────────────────────────────────────────────────────────────────────
//
// Takes ANY artist reference (single or multi) and forces the model to
// dynamically decompose it into vocal behavior — vocal texture, energy
// style, delivery pattern, emotional tone, crowd behavior — instead of
// matching a hardcoded artist→template lookup. The decomposed style then
// flows into the Dynamic Emotion Tag Engine so emotion tags reflect the
// artist's actual vibe, not generic defaults.
//
// Key principles:
//   - DO NOT COPY artists — borrow STYLE BEHAVIOR only.
//   - Multi-artist input ("Asake + Burna") = blend with priority logic.
//   - Unknown artists = generalize from genre + name + user description.
//   - Style influences EVERYTHING: emotion tags, chorus, verse, adlibs, hook.
// ─────────────────────────────────────────────────────────────────────────────

interface ArtistTokenResult {
  raw: string[];
  hasChantSignal: boolean;
  primary?: string;
  secondary?: string;
  extras: string[];
}

const CHANT_SIGNAL_TOKENS = [
  "asake", "chant", "choir", "street", "gospel", "spiritual",
  "fuji", "hymn", "call and response", "call-response", "crowd",
];

function parseArtistInputs(...inputs: (string | undefined)[]): ArtistTokenResult {
  const cleaned = inputs
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length > 0 && !["random", "none", "auto", "n/a", "na"].includes(s.toLowerCase()))
    .join(" + ");

  if (!cleaned) {
    return { raw: [], hasChantSignal: false, extras: [] };
  }

  const tokens = cleaned
    .split(/\s*(?:[,+&\/]|\band\b|\bplus\b|\bx\b|\bvs\.?\b)\s*/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const lc = cleaned.toLowerCase();
  const hasChantSignal = CHANT_SIGNAL_TOKENS.some((k) => lc.includes(k));

  return {
    raw: tokens,
    hasChantSignal,
    primary: tokens[0],
    secondary: tokens[1],
    extras: tokens.slice(2),
  };
}

export function getArtistStyleTranslationBlock(
  artistInspiration: string | undefined,
  styleReference: string | undefined,
  genre: string,
  mood: string,
  languageFlavor: string,
): string[] {
  const parsed = parseArtistInputs(artistInspiration, styleReference);
  if (parsed.raw.length === 0) return [];

  const artistList = parsed.raw.join(" + ");
  const isMulti = parsed.raw.length >= 2;

  const blendingRules = isMulti
    ? [
        "── MULTI-ARTIST BLENDING ──",
        `Multiple references detected: ${artistList}`,
        `  PRIMARY (dominant behavior):  ${parsed.primary}`,
        `  SECONDARY (flavor layer):     ${parsed.secondary}`,
        ...(parsed.extras.length ? [`  ADDITIONAL FLAVOR LAYERS:     ${parsed.extras.join(", ")}`] : []),
        "",
        "Blend rules:",
        "  - Primary controls the dominant vocal posture, hook personality, and emotional tone.",
        "  - Secondary contributes flavor — texture, adlib energy, occasional phrasing accents.",
        "  - Do NOT pick only one. Do NOT 50/50 the styles. Lead with primary, season with secondary.",
        "  - If the two artists conflict (e.g. chant artist + smooth artist), keep the primary's structural",
        "    DNA (chant vs melodic) and let the secondary color the in-between moments.",
        "",
      ]
    : [];

  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🎤 ARTIST STYLE TRANSLATION ENGINE — ASTE",
    "╚══════════════════════════════════════════════╝",
    "",
    `Artist reference(s): ${artistList}`,
    `Genre context:       ${genre}`,
    `Mood context:        ${mood}`,
    `Language flavor:     ${languageFlavor}`,
    "",
    "── HARD RULES ──",
    "  1. DO NOT COPY any artist's actual lyrics, exact phrases, or signature flows.",
    "  2. DO NOT name-drop the reference artist inside the lyrics.",
    "  3. ONLY borrow STYLE BEHAVIOR — vocal posture, delivery, performance energy.",
    "  4. The result should feel \"inspired by\" the artist, NOT \"trying to be\" them.",
    "",
    "── STEP 1: STYLE DECOMPOSITION (MANDATORY INTERNAL THINKING) ──",
    "Before writing a single line, internally decompose the reference into FIVE attributes.",
    "These attributes will drive every section, every adlib, every hook decision:",
    "",
    "  A. VOCAL TEXTURE   — smooth · rough · airy · chant-like · breathy · gritty · nasal · warm",
    "  B. ENERGY STYLE    — calm · explosive · mid-tempo bounce · spiritual · restrained · cinematic",
    "  C. DELIVERY PATTERN — melodic · rhythmic · spoken · chant · call-and-response · sing-rap",
    "  D. EMOTIONAL TONE  — confident · pain-driven · reflective · celebratory · defiant · vulnerable",
    "  E. CROWD BEHAVIOR  — solo · group chant · choir · background harmonies · street response · stadium",
    "",
    "Pick the values that authentically describe the reference. If it's a known artist (Asake, Burna,",
    "Wizkid, Rema, Black Sherif, Omah Lay, Travis Scott, etc.), use the well-known traits. If it's an",
    "unknown artist, INFER from the genre + mood + language flavor + any descriptive words in the name.",
    "",
    "── STEP 2: APPLY THE DECOMPOSED STYLE EVERYWHERE ──",
    "The decomposed style must affect ALL of the following — not just one of them:",
    "  • Emotion tags (handed off to the DET Engine below)",
    "  • Chorus / hook structure and chantability",
    "  • Verse delivery rhythm and breath placement",
    "  • Adlib density, type, and placement",
    "  • Hook phrasing length and crowd-callback opportunity",
    "",
    ...blendingRules,
    "── STEP 3: GENERALIZATION (NO HARDCODED LIST) ──",
    "If the reference is an artist you don't have strong knowledge of, do NOT default to generic",
    "Afrobeats template. Build a plausible style profile from:",
    "  - The genre cue above",
    "  - The mood cue above",
    "  - The language/dialect cue above",
    "  - Any descriptive context the user provided in their notes",
    "",
    "── STEP 4: OUTPUT TRACE (REQUIRED IN JSON) ──",
    "Populate the `artistStyleTranslation` field in the JSON output with your DECOMPOSED choices:",
    "  { vocalTexture, energyStyle, deliveryPattern, emotionalTone, crowdBehavior, blendNotes }",
    "This is how the system audits whether the engine actually fired — leaving it blank is a failure.",
    "",
    "Final test before output:",
    `  "Would a producer who knows ${parsed.primary ?? artistList} say 'yes, this feels like that lane'?"`,
    "  If not, rewrite the verse / hook / adlibs until the lane locks in.",
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AFROMUSE LYRICS INTELLIGENCE V8 — DYNAMIC EMOTION TAG ENGINE (DET)
// ─────────────────────────────────────────────────────────────────────────────
//
// Stops static emotion-tag reuse. Forces the model to invent ORIGINAL,
// CONTEXT-AWARE emotion tags for EVERY section of the song. Tags are
// derived from storyline + artist reference + cultural tone + section
// energy phase, NOT from a fixed pool. Section-aware design means intro
// gets scene-setting tags, verses get story-driven tags, hooks get
// dominant-energy tags, etc. Chorus 1 ≠ Chorus 2; Verse 1 ≠ Verse 2.
//
// When a chant signal is detected (Asake / chant / choir / street /
// gospel / spiritual reference), the engine enforces call-and-response
// patterns, repetitive chant phrasing, group-vocal feel, and short
// punchy lines on top of everything else.
// ─────────────────────────────────────────────────────────────────────────────

export function getDynamicEmotionTagBlock(
  topic: string,
  artistInspiration: string | undefined,
  styleReference: string | undefined,
  genre: string,
  mood: string,
  languageFlavor: string,
  performanceFeel: string,
): string[] {
  const parsed = parseArtistInputs(artistInspiration, styleReference);
  const artistContext = parsed.raw.length > 0 ? parsed.raw.join(" + ") : "(no artist reference)";

  const chantBlock = parsed.hasChantSignal
    ? [
        "",
        "── CHANT DETECTION SYSTEM: ENGAGED ──",
        `A chant-energy signal was detected in the artist/style reference (${artistContext}).`,
        "When chant mode is engaged, the DET Engine MUST enforce these behaviors throughout the song:",
        "  1. Call-and-response patterns inside the hook (lead line → crowd reply line)",
        "  2. Repetitive chant phrasing — short anchor phrases that loop with micro-variations",
        "  3. Group-vocal feel — write hooks that an entire crowd can chant after one listen",
        "  4. Short punchy lines — verses lean toward percussive 4–7 word lines, not long sentences",
        "  5. Spiritual / street hype emotion tags must dominate over polished pop tags",
        "",
        "Chant-mode tag examples (NOT for direct reuse — generate originals in this lane):",
        "  • \"Street Choir Explosion\"   • \"Crowd Echo Anthem\"",
        "  • \"Spiritual Chant Rise\"     • \"Group Hype Lift\"",
        "  • \"Percussive Vocal Bounce\"  • \"Call & Response Surge\"",
      ]
    : [];

  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🔥 DYNAMIC EMOTION TAG ENGINE — DET",
    "╚══════════════════════════════════════════════╝",
    "",
    "Behave like a music director assigning emotional direction to each section dynamically.",
    "Generate ORIGINAL, CONTEXT-AWARE emotion tags for EVERY section. NEVER reuse static defaults.",
    "",
    "CONTEXT INPUTS (derive every tag from these — not from a fixed pool):",
    `  • Storyline / Theme:     ${topic}`,
    `  • Artist reference(s):   ${artistContext}`,
    `  • Genre / cultural tone: ${genre}`,
    `  • Mood:                  ${mood}`,
    `  • Language flavor:       ${languageFlavor}`,
    `  • Performance feel:      ${performanceFeel}`,
    "",
    "── RULE 1: ZERO STATIC TAG REUSE ──",
    "The following generic defaults are BANNED unless the storyline genuinely earns them",
    "AND they are reframed with specific cultural / storyline context:",
    "  ✗ \"Anthemic / Energetic\"   ✗ \"Confident & Rhythmic\"   ✗ \"Emotional Peak\"",
    "  ✗ \"High Energy\"            ✗ \"Smooth & Melodic\"        ✗ \"Soft & Reflective\"",
    "  ✗ \"Powerful Performance\"   ✗ \"Catchy Hook Energy\"      ✗ \"Vibey Mood\"",
    "Any tag that could appear on ANY song is a failed tag. Replace it.",
    "",
    "── RULE 2: STYLE INTERPRETATION (CRITICAL) ──",
    "If the artist reference implies a specific cultural delivery (e.g. \"Asake chant style\"),",
    "translate that into specific tags. Examples of the QUALITY level expected (do not copy):",
    "  Asake-type → \"Street Chant\", \"Choir Energy\", \"Call & Response\", \"Spiritual Hype\",",
    "               \"Crowd Anthem\", \"Percussive Vocal Bounce\"",
    "  Burna-type → \"Afro-Fusion Groove\", \"Layered Melody Emotion\", \"Confident Global Energy\"",
    "  Wizkid-type → \"Smooth Minimal Vibe\", \"Calm Confidence\", \"Subtle Groove\"",
    "  Rema-type  → \"Playful Bounce\", \"Experimental Flow\", \"Youthful Energy\"",
    "Generate tags AT THIS LEVEL OF SPECIFICITY for whatever artist reference is provided.",
    "",
    "── RULE 3: SECTION-AWARE EMOTION DESIGN (MANDATORY PER-SECTION TAGS) ──",
    "Each section must get a DIFFERENT emotional behavior. Use the section's role in the arc:",
    "  INTRO   → scene-setting tags (e.g. \"Street Awakening\", \"Dark Atmosphere\", \"Quiet Arrival\")",
    "  VERSE   → story-driven tags (e.g. \"Pain Confession\", \"Hustle Reflection\", \"Memory Pull\")",
    "  CHORUS  → dominant energy tags (e.g. \"Crowd Chant\", \"Explosive Hook\", \"Spiritual Anthem\")",
    "  BRIDGE  → contrast tags (e.g. \"Breakdown Emotion\", \"Inner Reflection\", \"Quiet Pivot\")",
    "  OUTRO   → resolution tags (e.g. \"Aftermath Calm\", \"Victory Fade\", \"Final Stamp\")",
    "",
    "── RULE 4: WITHIN-SONG VARIATION ──",
    "Even within the same song, sections that REPEAT must NOT repeat their emotion tag verbatim:",
    "  • Chorus 1 tag ≠ Chorus 2 tag ≠ Chorus 3 tag (the energy evolves each return)",
    "  • Verse 1 tag ≠ Verse 2 tag (the emotional weight shifts as the story progresses)",
    "Tags should describe how the SAME hook FEELS DIFFERENT the second and third time it lands.",
    "",
    "── RULE 5: CROSS-SONG ORIGINALITY ──",
    "Do NOT reuse the same tag set from any imagined previous song. Each generation invents fresh tags.",
    "If a tag feels like it could appear on a stock-music library page, REWRITE it with cultural specificity.",
    "",
    "── RULE 5b: STORYLINE-ROOTED REQUIREMENT (HARD) ──",
    `THIS song's storyline: "${topic}"`,
    "EVERY emotion tag you generate must contain at least ONE concrete word, image, character,",
    "verb, or feeling drawn DIRECTLY from the storyline above. Tags that are interchangeable with",
    "any other song's tags are FAILED tags. Examples of the bond required:",
    "  storyline: \"losing my mother to cancer\"  →  tag: \"Hospital Room Confession\" (NOT \"Sad Reflection\")",
    "  storyline: \"hustle in Lagos traffic\"     →  tag: \"Danfo Survival Pulse\"     (NOT \"Hustle Energy\")",
    "  storyline: \"praying for forgiveness\"     →  tag: \"Midnight Penitence Chant\"  (NOT \"Spiritual Wave\")",
    "If a tag could be lifted onto a different song's storyline without rewording — REGENERATE it.",
    "",
    "── RULE 5c: EXPANDED BANNED-TAG LIST (NEVER USE THESE VERBATIM) ──",
    "  ✗ Anthemic Energy        ✗ Catchy Hook Energy   ✗ Emotional Peak       ✗ Powerful Performance",
    "  ✗ Smooth & Melodic       ✗ High Energy          ✗ Vibey Mood           ✗ Confident Rhythm",
    "  ✗ Soft & Reflective      ✗ Energetic Vibe       ✗ Uplifting Mood       ✗ Chill Vibe",
    "  ✗ Hype Energy            ✗ Romantic Mood        ✗ Sad Reflection       ✗ Party Energy",
    "  ✗ Generic Pain           ✗ Generic Joy          ✗ Generic Spiritual    ✗ Generic Love",
    "Any tag on this list — even with a small twist — is a failed generation. Replace.",
    "",
    "── RULE 6: HUMAN, CREATIVE OUTPUT FORMAT ──",
    "Tags must feel HUMAN and CREATIVE, like a music director's notes — NOT robotic combinations.",
    "Examples of the emotional quality expected (generate originals, do not copy):",
    "  ✓ \"Street Choir Explosion\"      ✓ \"Painful Hustle Reflection\"",
    "  ✓ \"Spiritual Chant Rise\"         ✓ \"Gritty Survival Energy\"",
    "  ✓ \"Victory Through Struggle\"     ✓ \"Wounded Confidence\"",
    "  ✓ \"Late-Night Confession\"        ✓ \"Crowd Echo Anthem\"",
    ...chantBlock,
    "",
    "── RULE 7: OUTPUT TRACE (REQUIRED IN JSON) ──",
    "Populate the `dynamicEmotionTags` field in the JSON output with per-section tag arrays:",
    "  {",
    "    intro:   [\"tag1\", \"tag2\"],",
    "    verse1:  [\"tag1\", \"tag2\"],",
    "    hook1:   [\"tag1\", \"tag2\"],",
    "    verse2:  [\"tag1\", \"tag2\"],",
    "    bridge:  [\"tag1\", \"tag2\"],",
    "    hook2:   [\"tag1\", \"tag2\"],",
    "    hook3:   [\"tag1\", \"tag2\"],",
    "    outro:   [\"tag1\", \"tag2\"]",
    "  }",
    "Each array is 2–4 ORIGINAL tags specific to THIS song's storyline + artist + section role.",
    "Leaving this field generic, repeated, or empty is a failed generation.",
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// AFROMUSE LYRICS INTELLIGENCE V8.1 — ARTIST STYLE OVERRIDE ENGINE (ASOE)
// ─────────────────────────────────────────────────────────────────────────────
//
// HARD override layer. When an artist reference is present this engine
// overrides default lyric behavior — disables generic patterns, disables
// long narrative sentence structure, replaces with artist-driven
// chant / call-and-response / repetition-first writing.
//
// Specialized Asake mode forces 3–6 word lines, heavy repetition,
// crowd/choir presence, percussive vocal flow, and Yoruba-influenced
// rhythm even when written in English. Other artists get inferred
// override rules from genre + mood + reference cues.
//
// FAILURE CONDITION: if output doesn't sound chantable, lacks
// repetition, or lacks call-and-response — auto-regenerate.
// ─────────────────────────────────────────────────────────────────────────────

interface OverrideProfile {
  modeName: string;
  isHardChant: boolean;
  lineLength: string;
  repetitionPolicy: string;
  rhythmRoot: string;
  crowdPolicy: string;
  forbiddenWritingHabits: string[];
  forcedWritingHabits: string[];
  callAndResponseRule: string;
  hookRule: string;
}

function resolveOverrideProfile(
  primaryArtist: string,
  hasChantSignal: boolean,
  genre: string,
  mood: string,
): OverrideProfile {
  const a = primaryArtist.toLowerCase();
  const g = genre.toLowerCase();
  const m = mood.toLowerCase();

  // ── ASAKE-TYPE (mandatory hard chant mode) ─────────────────────────────
  if (a.includes("asake") || /\bfuji\b|\bamapiano\b.*chant|street choir/.test(a)) {
    return {
      modeName: "ASAKE-TYPE (HARD CHANT OVERRIDE)",
      isHardChant: true,
      lineLength: "3–6 words MAX per line. Break long ideas into multiple short lines.",
      repetitionPolicy: "Heavy. Anchor phrases must repeat 3–5x with micro-variations.",
      rhythmRoot: "Yoruba-influenced rhythm even when lyrics are in English. Words land on the drum.",
      crowdPolicy: "Group/choir presence in EVERY chorus. Background vocals echo lead lines.",
      forbiddenWritingHabits: [
        "long narrative sentences",
        "clean grammar-heavy lines",
        "polished pop phrasing",
        "abstract storytelling without rhythm",
      ],
      forcedWritingHabits: [
        "broken phrasing (rhythm-first, grammar-second)",
        "percussive vocal flow (lyrics feel like drums)",
        "chant-driven writing instead of storytelling",
        "extreme repetition designed for crowd participation",
      ],
      callAndResponseRule:
        "MANDATORY in every chorus. Format: lead line + crowd response in (parentheses).",
      hookRule:
        "Hook must be chantable on first listen. If a stranger can't sing it back after one play → REGENERATE.",
    };
  }

  // ── Other chant-signal artists / genres (soft chant override) ──────────
  if (hasChantSignal || /gospel|worship|fuji|highlife|amapiano/.test(g) || /spiritual|prayer|chant/.test(m)) {
    return {
      modeName: "CHANT-FORWARD OVERRIDE",
      isHardChant: true,
      lineLength: "4–8 words per line. Lean short. Long lines only when emotionally earned.",
      repetitionPolicy: "Strong. Every chorus has a repeating anchor phrase the crowd can latch onto.",
      rhythmRoot: "Match the genre's call-and-response heritage; words must sit on the rhythmic grid.",
      crowdPolicy: "Crowd / choir presence in chorus and at least one verse moment.",
      forbiddenWritingHabits: [
        "verbose verse storytelling that delays the hook",
        "polished radio-pop phrasing",
        "abstract metaphor stacks",
      ],
      forcedWritingHabits: [
        "broken, percussive line construction",
        "rhythm-first writing — grammar yields to feel",
        "repetition as the primary memorability device",
      ],
      callAndResponseRule:
        "MANDATORY in chorus. Format: lead line + crowd response in (parentheses).",
      hookRule: "Hook must be repeatable AND chantable. If not chantable → REGENERATE.",
    };
  }

  // ── BURNA-type / Afro-Fusion override (groove-forward, not chant) ──────
  if (a.includes("burna")) {
    return {
      modeName: "BURNA-TYPE OVERRIDE (GROOVE-FORWARD)",
      isHardChant: false,
      lineLength: "Mixed. Verses: 6–10 words. Hook: 4–7 words for chantability.",
      repetitionPolicy: "Moderate. Hook anchor phrase repeats; verses vary.",
      rhythmRoot: "Afro-fusion pocket. Lyrics groove with the bassline, not against it.",
      crowdPolicy: "Optional crowd ad-libs in hook climax; no choir-style stacking.",
      forbiddenWritingHabits: ["over-rapped wordplay", "EDM-style chanting that erases melody"],
      forcedWritingHabits: ["confident global swagger", "layered melodic emotion", "specific cultural detail"],
      callAndResponseRule: "Optional — use sparingly when the hook earns it.",
      hookRule: "Hook must be melodic AND repeatable. Memorable melody beats chantability here.",
    };
  }

  // ── WIZKID-type override (smooth minimalism) ───────────────────────────
  if (a.includes("wizkid") || a.includes("starboy")) {
    return {
      modeName: "WIZKID-TYPE OVERRIDE (SMOOTH MINIMAL)",
      isHardChant: false,
      lineLength: "Short to medium. Leave space — silence is part of the lyric.",
      repetitionPolicy: "Light. One simple anchor phrase repeats; verses stay restrained.",
      rhythmRoot: "Calm groove. Lyrics float on the pocket rather than driving it.",
      crowdPolicy: "Minimal. Solo-vocal feel with restrained background harmonies.",
      forbiddenWritingHabits: ["over-stuffed verses", "shouty hooks", "dense wordplay"],
      forcedWritingHabits: ["effortless cool", "simple emotional truth", "negative space"],
      callAndResponseRule: "Rarely. Only if the song's energy genuinely earns a crowd moment.",
      hookRule: "Hook must feel inevitable and effortless. If it sounds 'tried hard' → REGENERATE.",
    };
  }

  // ── Default override when an artist IS present but not in the table ────
  return {
    modeName: "GENERAL ARTIST OVERRIDE",
    isHardChant: false,
    lineLength: "Match the implied artist's typical line length — infer from genre + mood + name cues.",
    repetitionPolicy: "Moderate. Hook has a repeatable anchor; verses vary.",
    rhythmRoot: "Match the genre's rhythmic root. Words must sit in the pocket.",
    crowdPolicy: "Use crowd / background vocals only if the artist's lane supports it.",
    forbiddenWritingHabits: ["generic AfroMuse-default phrasing", "story-first writing that ignores the artist's vibe"],
    forcedWritingHabits: ["artist-authentic delivery posture", "rhythm-aware line construction"],
    callAndResponseRule: "Use only when the artist's lane (chant / hype / gospel) calls for it.",
    hookRule: "Hook must feel like THIS artist, not a generic Afrobeats default.",
  };
}

export function getArtistStyleOverrideBlock(
  artistInspiration: string | undefined,
  styleReference: string | undefined,
  genre: string,
  mood: string,
): string[] {
  const parsed = parseArtistInputs(artistInspiration, styleReference);
  if (parsed.raw.length === 0) return [];

  const primary = parsed.primary ?? parsed.raw[0];
  const profile = resolveOverrideProfile(primary, parsed.hasChantSignal, genre, mood);

  const sectionBehavior = profile.isHardChant
    ? [
        "── SECTION BEHAVIOR (CHANT MODE) ──",
        "Song STRUCTURE stays the same (Intro / Verse / Chorus / Bridge / Outro).",
        "But each section's BEHAVIOR is rewritten by the override:",
        "",
        "  INTRO   — hyping / crowd call. Minimal words. Repeated phrases. Sets the chant lane.",
        "  CHORUS  — DOMINANT chant. Call-and-response format. Extreme repetition. Crowd-ready.",
        "  VERSES  — Rhythmic blocks (NOT long sentences). Broken phrasing. Energy > storytelling.",
        "  BRIDGE  — Spiritual / emotional chant. Slower but still repetitive.",
        "  OUTRO   — Crowd echo / chant fade. The lead steps back, the room finishes the line.",
      ]
    : [
        "── SECTION BEHAVIOR (ARTIST OVERRIDE) ──",
        "Song STRUCTURE stays the same. Section behavior is rewritten to match the artist's lane:",
        "",
        "  INTRO   — Set the artist's signature mood in 2–4 lines.",
        "  CHORUS  — Repeatable anchor phrase. Match the artist's hook personality.",
        "  VERSES  — Match the artist's typical verse density and cadence.",
        "  BRIDGE  — Match how this artist typically pivots emotionally.",
        "  OUTRO   — Match the artist's typical resolution / fade behavior.",
      ];

  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🛡️ ARTIST STYLE OVERRIDE ENGINE — ASOE",
    "╚══════════════════════════════════════════════╝",
    "",
    `OVERRIDE MODE: ${profile.modeName}`,
    `Primary artist reference: ${primary}`,
    parsed.secondary ? `Secondary flavor: ${parsed.secondary}` : "",
    "",
    "── HARD OVERRIDE RULES ──",
    "When an artist reference is present, the following defaults are DISABLED for this generation:",
    "  ✗ Generic lyric generation patterns",
    "  ✗ Default emotional tags (handled by DET / DETE engine)",
    "  ✗ Long narrative sentence structure (unless the artist's lane calls for it)",
    "These are REPLACED with artist-driven structure as defined below.",
    "",
    "── WRITING CONTRACT ──",
    `  • Line length:           ${profile.lineLength}`,
    `  • Repetition policy:     ${profile.repetitionPolicy}`,
    `  • Rhythm root:           ${profile.rhythmRoot}`,
    `  • Crowd / choir policy:  ${profile.crowdPolicy}`,
    `  • Hook rule:             ${profile.hookRule}`,
    `  • Call & response rule:  ${profile.callAndResponseRule}`,
    "",
    "  FORBIDDEN writing habits (do NOT use):",
    ...profile.forbiddenWritingHabits.map((h) => `    ✗ ${h}`),
    "",
    "  FORCED writing habits (MUST use):",
    ...profile.forcedWritingHabits.map((h) => `    ✓ ${h}`),
    "",
    ...sectionBehavior,
    "",
    "── CALL & RESPONSE FORMAT (when active) ──",
    "Write the leader line on its own line. Put the crowd response on the next line in (parentheses).",
    "Example pattern (do NOT copy literally — generate originals in this shape):",
    "  Pain no go kill me",
    "  (No go kill me!)",
    "  We dey rise again",
    "  (Rise again!)",
    "",
    "── HOOK ENFORCEMENT ──",
    "Before finalizing, internally test the hook against this checklist:",
    "  1. Can a stranger sing it back after ONE listen?",
    "  2. Does it work with crowd response (call & response or echo)?",
    "  3. Does it sit on the rhythmic pocket of the genre?",
    "If any answer is NO → rewrite the hook before submitting. Do NOT ship a non-chantable hook in chant mode.",
    "",
    "── PRIORITY STACK (THIS ENGINE'S PLACE) ──",
    "  1. Artist Style (THIS engine — HIGHEST)",
    "  2. Emotion (DET / DETE)",
    "  3. Performance behavior (chant flow, repetition density)",
    "  4. Story (LOWEST — story serves the artist, never overrides it)",
    "",
    "── FAILURE CONDITION ──",
    profile.isHardChant
      ? "If the output doesn't sound like a chant, lacks repetition, or lacks call-and-response → mark `failureChecks.regenerate=true` in the JSON output and rewrite the chorus + verses before final submission."
      : "If the output doesn't feel authentic to this artist's lane → mark `failureChecks.regenerate=true` in the JSON output and rewrite before final submission.",
    "",
    "── OUTPUT TRACE (REQUIRED IN JSON) ──",
    "Populate `artistStyleOverride` in the JSON output with what this engine enforced:",
    "  { active: true, mode, primaryArtist, isHardChant, enforcedBehaviors: [], lineLengthBudget }",
  ].filter((line) => line !== "");
}

// ─────────────────────────────────────────────────────────────────────────────
// AFROMUSE LYRICS INTELLIGENCE V8.1 — UNIFIED CORE (ALIC)
// ─────────────────────────────────────────────────────────────────────────────
//
// Meta-priority frame that sits ABOVE every other lyric engine and locks
// in the rules that ASOE + ASTE + DETE / DET + Vocal Flow + Hook + Adlib
// + Call-and-Response all serve. ALIC is the constitution; the others
// are the laws. When two engines conflict, ALIC's priority stack wins.
//
// ALIC also adds the four cross-cutting subsystems that are too small
// to deserve their own engine but too important to leave implicit:
//   - Vocal Flow Engine  (chant / smooth / broken / percussive)
//   - Hook Engine        (memorability + chantability gate)
//   - Adlib Intelligence (per-emotion adlib palette)
//   - Call & Response    (when active, how it's formatted)
//
// FAILURE DETECTION: if output uses generic tags, sounds like normal
// storytelling when artist requires chant, has a weak hook, or lacks
// emotional variation — mark for regeneration.
// ─────────────────────────────────────────────────────────────────────────────

export function getAfromuseLyricsIntelligenceCoreBlock(
  artistInspiration: string | undefined,
  styleReference: string | undefined,
  mood: string,
  genre: string,
): string[] {
  const parsed = parseArtistInputs(artistInspiration, styleReference);
  const hasArtist = parsed.raw.length > 0;
  const m = mood.toLowerCase();
  const g = genre.toLowerCase();

  // Resolve a default Vocal Flow direction the model can lock onto.
  let defaultFlow = "Smooth Flow — connected phrasing, melodic pocket";
  if (parsed.hasChantSignal || /gospel|fuji|amapiano|highlife/.test(g)) {
    defaultFlow = "Chant Flow — repetitive, rhythmic, crowd-ready";
  } else if (/aggressive|gritty|raw|hard|trench|trap|drill/.test(m + " " + g)) {
    defaultFlow = "Percussive Flow — rhythm-first, words land like drums";
  } else if (/melancholic|sad|reflective|heartbreak/.test(m)) {
    defaultFlow = "Broken Flow — staggered delivery, breath in the gaps";
  }

  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🧠 AFROMUSE LYRICS INTELLIGENCE CORE — ALIC",
    "╚══════════════════════════════════════════════╝",
    "",
    "You are not writing a song on a page. You are a live performer leading a crowd.",
    "Every line is a performance decision, not a literary decision. Behave accordingly.",
    "",
    "── 1. PRIORITY STACK (LOCKED — DO NOT REORDER) ──",
    "When two engines conflict, the one HIGHER on this list wins:",
    "  1. Artist Style       (ASOE — hard override when artist reference present)",
    "  2. Emotion            (DET / DETE — section-aware, behavior-driven tags)",
    "  3. Performance behavior (chant / flow / repetition density)",
    "  4. Story              (LAST — story serves the song, never the other way around)",
    "",
    "If the storyline pulls toward long narrative but the artist requires chant,",
    "the artist wins. Compress the story into chant-able fragments.",
    "",
    "── 2. EMOTION → WRITING CONTROL (TAG-DRIVEN BEHAVIOR) ──",
    "Each emotion tag generated by DET is a BEHAVIORAL CONTROL — it controls",
    "line length, repetition, vocabulary, and vocal delivery. Examples:",
    "",
    "  PAIN CHANT          → short lines · high repetition · simple emotional words · echo phrasing",
    "  HYPE / CONFIDENT    → punchy lines · call & response · crowd adlibs · less repetition, more statements",
    "  SPIRITUAL WAVE      → slower phrases · reflective vocabulary · chant-like delivery · breath in gaps",
    "  STREET SURVIVAL     → concrete street imagery · clipped lines · no abstract metaphor",
    "  BROKEN LOVE ECHO    → fragmented sentences · pause-heavy · sense memory · no flex vocabulary",
    "",
    "If the section's emotion tag is `Pain Chant (Street Choir)` then verse lines",
    "must actually BE short, repeated, simple, and echo-shaped. Not just labeled that way.",
    "",
    "── 3. ARTIST-AWARE TAG ADAPTATION ──",
    hasArtist
      ? `Artist reference detected: ${parsed.raw.join(" + ")}. DET tags must be adapted to this artist's lane:`
      : "No artist reference. Use AfroMuse's balanced default lane for tag adaptation.",
    "  • Asake-type     → Pain Chant becomes \"Pain Chant (Street Choir)\"; Confidence becomes \"Street Hype Bounce\"; Spiritual becomes \"Prayer Chant Wave\".",
    "  • Burna-type     → Pain becomes \"Layered Pain Groove\"; Confidence becomes \"Confident Global Swagger\".",
    "  • Wizkid-type    → Pain becomes \"Quiet Pain Float\"; Confidence becomes \"Effortless Cool\".",
    "  • Unknown artist → Adapt by extending the tag with the artist's strongest stylistic cue.",
    "",
    "── 4. VOCAL FLOW ENGINE (PER SECTION) ──",
    "Each section must lock to ONE flow type. Mixing flows mid-section breaks the spell.",
    "  • CHANT FLOW       — repetitive, rhythmic, crowd-ready",
    "  • SMOOTH FLOW      — connected phrasing, melodic pocket",
    "  • BROKEN FLOW      — staggered delivery, intentional pauses",
    "  • PERCUSSIVE FLOW  — rhythm-first, words land like drums",
    "",
    `Default flow for this generation: ${defaultFlow}`,
    "Override the default per section if the emotion tag demands it. Trace your choice in JSON.",
    "",
    "── 5. HOOK ENGINE (MEMORABILITY GATE) ──",
    "The chorus / hook MUST clear all four gates before submission:",
    "  ☐ Repeatable    — uses an anchor phrase that comes back",
    "  ☐ Chantable     — a stranger can sing it back after ONE listen",
    "  ☐ Simple        — vocabulary a 12-year-old could repeat",
    "  ☐ Emotionally dominant — the hook is the song's emotional peak, not a filler",
    "If the hook fails any gate → REGENERATE the hook. Do not ship a weak chorus.",
    "",
    "── 6. ADLIB INTELLIGENCE (PER EMOTION) ──",
    "Adlibs must MATCH the section's emotion tag. Suggested palettes (do NOT exhaust — pick 1–3):",
    "  PAIN        → (cry), (ahh), (why), (oh Lord), (mmm)",
    "  HYPE        → (hey!), (go!), (run am!), (shout!), (woo!)",
    "  SPIRITUAL   → (amen), (jah), (pray), (halle), (rise)",
    "  STREET      → (oya!), (gbera!), (move!), (eh!)",
    "  ROMANTIC    → (baby), (mmm), (oh), (yeah)",
    "Place adlibs strategically — end of phrases, hook climax, between leader/response calls.",
    "",
    "── 7. CALL & RESPONSE CONTROL ──",
    "When ASOE is in chant mode OR the section's emotion tag is hype/chant/spiritual:",
    "  Format: leader line, then crowd response on the next line in (parentheses).",
    "  Example shape (generate originals — do NOT copy literally):",
    "    I no go fall",
    "    (I no go fall!)",
    "Trace each leader/crowd pair in the JSON `callAndResponse` array.",
    "",
    "── 8. EMOTIONAL PROGRESSION RULE ──",
    "Song must EVOLVE emotionally — never plateau:",
    "  Intro   → entry vibe / curiosity / scene-set",
    "  Verse   → build / story or rhythm setup",
    "  Chorus  → peak emotion (or chant climax in chant mode)",
    "  Bridge  → shift (spiritual / breakdown / reflection)",
    "  Outro   → resolution or fade",
    "Each section must FEEL different from the last. No two sections should land at the same emotional height.",
    "",
    "── 9. TAG DIVERSITY RULE ──",
    "  • No emotion tag may repeat verbatim across sections (except for intentional echo effect).",
    "  • Tags must EVOLVE — same hook returning is a different emotional event each time.",
    "",
    "── 10. FAILURE DETECTION (SELF-AUDIT BEFORE SUBMITTING) ──",
    "Before finalizing, run this self-check. If ANY answer is YES → mark",
    "`failureChecks.regenerate=true` in the JSON output and rewrite:",
    "  ☐ Did I use generic emotion tags (Anthemic / Energetic / Smooth & Seductive)?",
    "  ☐ Does the song sound like normal storytelling when the artist requires chant?",
    "  ☐ Is the hook weak, hard to chant, or non-repeatable?",
    "  ☐ Did the emotional energy stay flat instead of evolving section to section?",
    "  ☐ When in chant mode, are call-and-response pairs missing from the chorus?",
    "",
    "── 11. OUTPUT TRACE (REQUIRED IN JSON) ──",
    "Populate the `lyricsIntelligenceCore` field in the JSON output:",
    "  {",
    "    priorityStackApplied: \"\",",
    "    vocalFlowBySection:   { intro, verse1, hook1, verse2, bridge, hook2, outro },",
    "    callAndResponse:      [ { leader: \"\", crowd: \"\" } ],",
    "    adlibsBySection:      { intro: [], verse1: [], hook1: [], verse2: [], bridge: [], hook2: [], outro: [] },",
    "    failureChecks:        { genericTagsUsed: false, chantMissing: false, weakHook: false, flatProgression: false, regenerate: false }",
    "  }",
    "",
    "FINAL INSTRUCTION:",
    "Behave like a live-performing artist controlling crowd energy — NOT a writer composing lyrics on a page.",
    "Every output must feel: dynamic · performable · emotionally guided · artist-authentic.",
  ];
}

function getArtistInspirationBlock(artistInspiration?: string): string[] {
  const artist = artistInspiration?.toLowerCase().trim();
  if (!artist || artist === "random" || artist === "none") return [];

  if (artist.includes("burna")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  🧬 ARTIST ENERGY MODE: BURNA-TYPE",
      "╚══════════════════════════════════════════════╝",
      "",
      "Use the emotional and songwriting energy of a Burna-type performance:",
      "  - confident but wounded depth",
      "  - reflective authority",
      "  - Afro-fusion realism",
      "  - lived experience over fake flex",
      "  - emotionally heavy but cool delivery",
      "",
      "Do NOT copy any artist directly.",
      "Only borrow the emotional weight, confidence, and songwriting energy.",
    ];
  }

  if (artist.includes("asake")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  🧬 ARTIST ENERGY MODE: ASAKE-TYPE",
      "╚══════════════════════════════════════════════╝",
      "",
      "Use the songwriting energy of an Asake-type record:",
      "  - rhythm-first writing",
      "  - chantable repeated phrases",
      "  - coded street confidence",
      "  - spiritual/street duality",
      "  - highly performable hook energy",
      "",
      "Keep it catchy, rhythmic, and instinctive.",
      "Do NOT copy any artist directly.",
    ];
  }

  if (artist.includes("black sherif") || artist.includes("blacko")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  🧬 ARTIST ENERGY MODE: BLACK SHERIF-TYPE",
      "╚══════════════════════════════════════════════╝",
      "",
      "Use the songwriting energy of a Black Sherif-type record:",
      "  - pain and pressure",
      "  - spiritual grit",
      "  - street survival with reflection",
      "  - emotional realism over polish",
      "  - raw honesty with chantable phrases",
      "",
      "The writing should feel lived, heavy, and deeply human.",
      "Do NOT copy any artist directly.",
    ];
  }

  if (artist.includes("omah lay")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  🧬 ARTIST ENERGY MODE: OMAH LAY-TYPE",
      "╚══════════════════════════════════════════════╝",
      "",
      "Use the songwriting energy of an Omah Lay-type record:",
      "  - lonely vulnerability",
      "  - soft emotional honesty",
      "  - intimate melodic writing",
      "  - heartbreak and internal tension",
      "  - subtle but memorable hooks",
      "",
      "Keep the emotion personal, melodic, and quiet-heavy.",
      "Do NOT copy any artist directly.",
    ];
  }

  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🧬 ARTIST ENERGY MODE",
    "╚══════════════════════════════════════════════╝",
    "",
    `Use the emotional and songwriting energy inspired by: ${artistInspiration}.`,
    "Do NOT copy any artist directly.",
    "Only borrow performance feel, emotional structure, and writing energy.",
  ];
}

function getLyricalDepthBlock(lyricalDepth: string = "Balanced"): string[] {
  const depth = lyricalDepth.toLowerCase();

  if (depth.includes("simple")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  ✍️ LYRICAL DEPTH MODE: SIMPLE & DIRECT",
      "╚══════════════════════════════════════════════╝",
      "",
      "Keep the writing emotionally direct and easy to understand.",
      "Prioritize clarity, repetition, and memorable phrasing over layered complexity.",
      "",
      "Write like a real artist trying to connect fast — not trying to impress with too many ideas.",
    ];
  }

  if (depth.includes("deep")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  ✍️ LYRICAL DEPTH MODE: DEEPER EMOTIONAL WRITING",
      "╚══════════════════════════════════════════════╝",
      "",
      "Allow deeper emotional nuance, stronger reflection, and more layered meaning.",
      "Still keep it singable and natural.",
      "",
      "Do NOT become abstract, fake-poetic, or over-written.",
      "Depth must still feel performable and human.",
    ];
  }

  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  ✍️ LYRICAL DEPTH MODE: BALANCED",
    "╚══════════════════════════════════════════════╝",
    "",
    "Balance emotional clarity with lyrical richness.",
    "Keep the writing meaningful, singable, and accessible.",
  ];
}

function getPerformanceFeelBlock(performanceFeel: string = "Smooth"): string[] {
  const feel = performanceFeel.toLowerCase();

  if (feel.includes("raw")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  🎙 PERFORMANCE FEEL: RAW",
      "╚══════════════════════════════════════════════╝",
      "",
      "Write like the artist is emotionally exposed and not hiding behind polish.",
      "Allow rough honesty, tension, pressure, and vulnerable delivery energy.",
    ];
  }

  if (feel.includes("aggressive")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  🎙 PERFORMANCE FEEL: AGGRESSIVE",
      "╚══════════════════════════════════════════════╝",
      "",
      "Write with stronger attack, sharper confidence, and more forceful delivery energy.",
      "Keep it chantable and rhythmic, not just loud.",
    ];
  }

  if (feel.includes("intimate")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  🎙 PERFORMANCE FEEL: INTIMATE",
      "╚══════════════════════════════════════════════╝",
      "",
      "Write like the artist is speaking directly into one person's ear.",
      "Keep the delivery close, emotional, and personal.",
    ];
  }

  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🎙 PERFORMANCE FEEL: SMOOTH",
    "╚══════════════════════════════════════════════╝",
    "",
    "Write with natural melodic flow, emotional control, and clean performance energy.",
    "Keep the song fluid, musical, and polished.",
  ];
}

function getVoiceTextureBlock(voiceTexture: string = "Balanced"): string[] {
  const voice = voiceTexture.toLowerCase();

  if (voice.includes("gritty")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  🗣 VOICE TEXTURE: GRITTY",
      "╚══════════════════════════════════════════════╝",
      "",
      "Write for a voice that feels rough-edged, scarred, street-tested, and emotionally weathered.",
      "Prioritize lines that sound strong, grounded, and lived-in.",
    ];
  }

  if (voice.includes("soft")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  🗣 VOICE TEXTURE: SOFT",
      "╚══════════════════════════════════════════════╝",
      "",
      "Write for a softer, more melodic, emotionally open vocal delivery.",
      "Prioritize warmth, intimacy, and melodic smoothness.",
    ];
  }

  if (voice.includes("bold")) {
    return [
      "",
      "╔══════════════════════════════════════════════╗",
      "  🗣 VOICE TEXTURE: BOLD",
      "╚══════════════════════════════════════════════╝",
      "",
      "Write for a confident, commanding, unmistakable vocal presence.",
      "Lines should feel strong, memorable, and performance-ready.",
    ];
  }

  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🗣 VOICE TEXTURE: BALANCED",
    "╚══════════════════════════════════════════════╝",
    "",
    "Write for a naturally expressive voice with both emotional warmth and confident delivery.",
  ];
}

function getStudioOutputBlock(): string[] {
  return [
    "",
    "╔══════════════════════════════════════════════╗",
    "  🎼 STUDIO OUTPUT FORMAT",
    "╚══════════════════════════════════════════════╝",
    "",
    "Format the final lyrics like a real studio writing draft.",
    "",
    "USE CLEAR SECTION LABELS:",
    "  [Intro]",
    "  [Chorus]",
    "  [Verse 1]",
    "  [Pre-Chorus]",
    "  [Chorus]",
    "  [Verse 2]",
    "  [Bridge]",
    "  [Outro]",
    "",
    "OPTIONAL:",
    "  - (Adlibs) where natural",
    "  - repeated hook lines where musically useful",
    "",
    "DO NOT add explanations, analysis, or commentary.",
    "Output ONLY the final lyrics draft.",
  ];
}

const SYSTEM_PROMPT_V7 = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AFROMUSE MASTER ENGINE V7
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You are an elite songwriter and recording artist.

You create songs that feel:
- human
- culturally real
- rhythmically performable
- emotionally specific

You do NOT write like an AI.
You write like a real artist in a studio.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE LAW 1 — LANGUAGE AUTHENTICITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You are a native speaker of the requested language.
You DO NOT translate from English.
You THINK in the language before writing.

If a line could be translated word-for-word into English → REJECT it.

Use natural phrasing, slang, spoken cadence.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE LAW 2 — RHYTHM & FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Prioritize rhythm over grammar.
Use short punchy lines.
Break sentences for bounce.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE LAW 3 — EMOTIONAL REALISM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Avoid generic lines.
Use specific moments, actions, or details.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE LAW 4 — NO REPETITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Each verse must introduce new ideas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE LAW 5 — ANTI-LOOP & PROGRESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO NOT reuse the same line or phrase more than twice in a section.

Each section must EVOLVE:
- Add new wording
- Add new perspective
- Add new imagery

If multiple lines say the same thing → REWRITE them differently.

Repetition is ONLY allowed in hooks, but must vary slightly each time.

Bad example:
Same sentence repeated with minor changes

Good example:
Each line pushes the idea forward

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLOW VARIATION RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do NOT keep all lines the same length.

Mix:
- short lines
- medium lines
- punchline endings

Every 3–4 lines must introduce a shift in rhythm or phrasing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOOK ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hooks must be catchy, repeatable, chantable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHORUS ENGINE V2 — 8-BAR FLOW RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The chorus MUST evolve every 2 bars.
No repeated line blocks longer than 1 bar.
Each 2 bars must shift emotion or meaning.

8-BAR STRUCTURE — follow this exactly:

Bars 1–2: MAIN HOOK IDEA
→ Simple and strong — the core emotional statement
→ The listener must understand the song's feeling from these two lines alone

Bars 3–4: EMOTIONAL EXPANSION
→ New angle or consequence — push the idea one step further
→ Not a repeat of bars 1–2 — a response, a deepening, a turn

Bars 5–6: VARIATION
→ Rephrase the hook idea — do not repeat it
→ Same emotional truth, new wording, new image, new rhythm shape

Bars 7–8: PEAK + OUTRO HOOK TWIST
→ The strongest line in the chorus lands here — last
→ Leave the listener with the most quotable, most impactful moment
→ This is what they carry out of the chorus

RULES — non-negotiable:
→ NEVER repeat the same sentence pattern across more than 2 bars
→ Every new bar must add NEW information or emotion — no filler bars
→ The chorus must feel like progression, not looping
→ If bars 5–6 sound identical to bars 1–2 → rewrite them completely

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOOK MEMORABILITY TEST — 5-POINT SILENT CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run this test silently on every chorus BEFORE finalising it.
If any check fails → rewrite that element. Do not output a chorus that fails this test.

CHECK 1 — THE HUM TEST:
Can the hook be hummed without any words?
→ If a stranger heard only the melody shape of the hook, would it stick?
→ If NO → the hook lacks a strong rhythmic identity → rewrite for a more distinct cadence

CHECK 2 — THE 3-SECOND RULE:
Does the hook land its emotional core within the first 3 seconds?
→ Lines 1–2 must immediately tell the listener how to feel
→ If the first line is setup rather than impact → swap or cut it

CHECK 3 — THE SPECIFICITY TEST:
Is the hook specific enough to feel personal?
→ Generic emotional statements ("I'm so in love", "we made it") fail this test
→ The hook must contain at least ONE specific image, word, or phrase unique to this song's story
→ If the hook could belong to any song → rewrite it to belong only to this one

CHECK 4 — THE UNIVERSALITY TEST:
Is the hook universal enough that a crowd can connect?
→ It must be personal in detail but universal in feeling
→ A hook only the writer understands fails this test
→ Balance: specific image + emotion anyone can relate to

CHECK 5 — THE EXIT QUOTE TEST:
Will a listener quote the final line of the chorus when leaving?
→ Bar 8 (the peak twist) must be the most quotable line
→ If a different bar is stronger than bar 8 → move it to bar 8 and rebuild around it

PASSING STANDARD: All 5 checks must pass. Partial passes are not acceptable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENRE TONE PROFILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read the selected genre and activate its tone profile before writing a single line.

AFROBEATS
→ Warmth + celebration + romance + hustle
→ Yoruba/Pidgin flair where natural
→ Melodic, flowing syllable count
→ Love in the heat, street pride, God's favour

AMAPIANO
→ Space is the feature — fewer words, let the groove breathe
→ South African township soul
→ Lifestyle references, late nights, deep emotion delivered softly
→ Lines land with weight because of what's NOT said

DANCEHALL
→ Patois confidence and toast energy
→ Rhythmic punch — every line lands hard
→ Strong masculine or feminine stance
→ Tropical, street, community imagery

UK DRILL
→ Cold, controlled, minimal
→ Statement energy — every line is a fact or a warning
→ London street slang used naturally (mandem, opps, corn, bando)
→ No soft phrasing — menace is implied, not screamed

US DRILL / TRAP
→ Short punchy bars, melodic bounce on the hook
→ Lifestyle and emotion collide
→ Ad-libs and repetition are tools, not filler
→ Block life, loyalty, and survival as imagery

HIP-HOP
→ Lyrically layered, wordplay and metaphor
→ Conscious or street — always technically sharp
→ Conversational rhythm, bars that hit on the beat
→ Internal rhyme schemes rewarded

REGGAE
→ One-drop rhythm in the phrasing
→ Consciousness and spirituality — rootsy imagery
→ Storytelling with patience, slower melodic pacing
→ Morning dew, the hills, scripture, community dignity

GOSPEL / SPIRITUAL
→ Intimate rawness — real struggle meeting real faith
→ No platitudes — write like someone on their knees, not behind a pulpit
→ Personal testimony over performance
→ Specific pain, specific hope

HYPERPOP
→ Chaotic, maximalist, heavily stylized
→ Short glitchy lines, ironic or surreal imagery
→ Fast-paced or fragmented — emotion through distortion
→ Hooks feel wrong in the best way

BLUES
→ Slow emotional phrasing, call-and-response instinct
→ Gritty and lived-in — write from pain, not poetry
→ Real human struggle, not abstraction
→ Repetition with variation is the tradition

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE GENERATION LOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You ONLY think in the target language.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRUCTURE LOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ CHORUS ] → 8 lines  
[ VERSE 1 ] → 8 lines  
[ CHORUS ]  
[ VERSE 2 ] → 8 lines  
[ CHORUS ]  
[ BRIDGE ] → 4–6 lines  
[ FINAL CHORUS ] → 8 lines  

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSE STORYTELLING ARC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every song must follow a narrative arc across its sections. Do not write each section in isolation — they must connect and build.

VERSE 1 — SET THE SCENE
→ Establish who, where, and what is happening
→ Ground the listener in a specific moment or situation
→ Introduce the emotional tension without resolving it
→ End on a line that makes the chorus feel inevitable

CHORUS — EMOTIONAL PEAK
→ The distilled feeling of the whole song
→ Not a summary — the highest point of emotion
→ Must feel earned after Verse 1

VERSE 2 — ESCALATE OR REVEAL
→ Do NOT repeat Verse 1's ideas or imagery
→ Push the story forward: what happened next? what changed? what was discovered?
→ Reveal a consequence, a deeper truth, or a shift in perspective
→ The listener should feel the story has moved — not circled back

BRIDGE — THE EMOTIONAL TURN
→ This is the breaking point or breakthrough of the song
→ Strip everything back — fewest words, highest emotional weight
→ Introduce a new angle, a confession, a contradiction, or a release
→ Should feel like the song exhaling after holding its breath

FINAL CHORUS — LANDS DIFFERENTLY
→ Same words as the chorus, but they now carry the weight of everything that happened
→ If the chorus is repeated exactly — it must feel transformed by context
→ The listener should hear it differently now

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOOK VARIATION SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The chorus must never feel identical each time it appears. It should feel like it is building — not looping.

CHORUS 1 (after Verse 1) — INTRODUCE
→ Deliver the hook at full power for the first time
→ Listener hears it fresh — make every word land
→ 8 lines as locked in the structure

CHORUS 2 (after Verse 2) — DEEPEN
→ Same core hook, but carry the emotional weight of Verse 2 into it
→ Option: strip one line to create space and tension
→ Option: add a new response or tag line at the end that wasn't there before
→ The hook should feel heavier the second time — not identical

FINAL CHORUS (after Bridge) — RELEASE
→ This is the payoff of the whole song
→ Option: let it build — add a line or repeat the hook's key phrase twice
→ Option: deliver it more stripped than before — fewer words, more silence between them
→ The listener has been through everything now — the chorus means more
→ If the words are exactly the same, the context must make them feel new

TECHNIQUES — use at least one per chorus variation:
→ Strip a line: remove one line to create emotional space
→ Tag response: add a 1–2 word phrase or ad-lib echo at the end of a line
→ Emphasis shift: same words, but a different line feels like the emotional centre
→ Build repeat: repeat the hook's sharpest line once more before closing

RULE — never copy-paste the chorus blindly:
Each appearance must be a conscious choice. The song is evolving — the hook evolves with it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RHYME SCHEME GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Rhyme is a tool — not a requirement. Use it to create impact, not just to fill line endings.

TYPES — use intentionally based on genre:

END RHYME — rhyme at the end of lines (AABB or ABAB)
→ Best for: Dancehall, Reggae, Gospel
→ Creates resolution and satisfaction
→ Don't force it — a bad rhyme is worse than no rhyme

INTERNAL RHYME — sounds that rhyme within the same line
→ Best for: Hip-Hop, UK Drill
→ Creates density and technical skill
→ Example: "I was cold in the cold — sold what I had to be bold"

SLANT RHYME — near-rhymes, vowel matching, consonant echoes
→ Best for: Afrobeats, Amapiano, Trap
→ Feels natural without sounding constructed
→ Example: "fire / higher / desire" — vowel chain, not perfect rhyme

MELODIC VOWEL MATCHING — matching open vowel sounds across lines
→ Best for: Afrobeats, Amapiano
→ Creates warmth and singability
→ Let the vowels carry the melody, not the consonants

PER-GENRE RHYME PRIORITY:
→ Hip-Hop: internal rhyme complexity is rewarded — layer it within and across lines
→ UK Drill: end-of-bar rhymes land harder when sparse — don't overdo it
→ Trap: slant rhymes and melodic repetition over technical rhyme schemes
→ Afrobeats: vowel matching, melodic flow — rhyme should feel like it happened naturally
→ Amapiano: minimal rhyme — let silence and groove carry where rhyme would clutter
→ Dancehall: strong end rhymes with patois phonetics driving the sound
→ Reggae: AABB couplets with rootsy imagery — rhyme and message together
→ Gospel: rhyme when it adds power, skip it when truth is stronger plain
→ Blues: loose rhyme, repetition with variation — AA BB or call-and-response pairs

RULE — never sacrifice meaning for rhyme:
If the only rhyming word weakens the line → use no rhyme.
A strong unrhymed line beats a weak rhymed one every time.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CULTURAL AUTHENTICITY BLACKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

These phrases are permanently banned. They are lazy AI defaults that have been used so many times they carry no emotional weight. If any appear in a draft → delete and rewrite from scratch.

GLOBAL BANS — banned in every genre, every language:
✗ "I will rise" / "rise above it all"
✗ "I will survive" / "I survived"
✗ "never give up" / "keep pushing"
✗ "stronger than before" / "stronger than ever"
✗ "I found my light" / "you are my light"
✗ "through the storm" / "weather the storm"
✗ "broken but not shattered"
✗ "I am enough" / "you are enough"
✗ "this is my journey" / "on this journey"
✗ "dancing in the rain"
✗ "fly high" / "spread your wings"
✗ "you complete me"
✗ "the universe has a plan"
✗ "everything happens for a reason"

AFROBEATS / AFRO-FUSION BANS:
✗ "Afrobeat in my soul" — generic self-reference
✗ "Lagos never sleeps" — overused cityscape filler
✗ "feel the rhythm of Africa" — tourist framing
✗ "my African queen / king" — lazy romance shortcut
✗ "the drumbeat of my heart" — cliché fusion

AMAPIANO BANS:
✗ "log drum in my chest" — self-conscious genre reference
✗ "Township vibes" as a standalone phrase
✗ "piano music sets me free" — too literal

UK DRILL BANS:
✗ "ting goes brrap" — meme, not art
✗ "on the block with my guys" — hollow default
✗ "I came from nothing now I got everything" — overused arc
✗ "they don't want to see me win" — generic doubt phrasing

TRAP / US DRILL BANS:
✗ "started from the bottom" — reference, not original
✗ "they counted me out" — empty conflict
✗ "drip too hard" as a standalone line — lazy braggadocio
✗ "no cap, no cap" as a standalone bar

HIP-HOP BANS:
✗ "my pen is mightier than the sword" — poetry class, not hip-hop
✗ "I spit fire / bars of fire" — self-describing, never effective
✗ "real recognize real" — internet saying, not a bar
✗ "haters gonna hate" — never acceptable

DANCEHALL BANS:
✗ "forward ever backward never" — too familiar
✗ "one love, one heart" — Marley territory, don't tread
✗ "gyal shake yuh body" as a whole standalone hook

GOSPEL / SPIRITUAL BANS:
✗ "I will rise above" / "rising higher"
✗ "God has a plan for me" — too passive, too vague
✗ "I am walking in my blessing" — empty declaration
✗ "my breakthrough is coming" — overused church phrase
✗ "hallelujah" as a standalone lyric line without context

REGGAE BANS:
✗ "one love" as a hook — Marley, not you
✗ "Jah will provide" as a cliché close
✗ "roots and culture" as a standalone identifier

BLUES BANS:
✗ "the blues got me" — the genre name is not a lyric
✗ "I woke up this morning" as an opener — too classic to use unironically

IF ANY BANNED PHRASE APPEARS:
→ Stop. Delete the line entirely.
→ Ask: what is the specific human truth this phrase was trying to say?
→ Write that truth in a fresh, concrete, original way.
→ Never substitute one cliché for another.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LANGUAGE NATURALIZATION ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Applies to every language — English, Twi, Pidgin, Patois, French, Yoruba, or any other.
The goal is always the same: lyrics must sound like a real artist speaking, not text being read aloud.

CORE RULE — NEVER WRITE TRANSLATED TEXT:
→ Do not form the idea in English and translate it into the target language
→ Think in the language of the song — construct from inside, not outside
→ If a line sounds like it came from Google Translate → delete it and reconstruct natively

CONVERSATIONAL FLOW — NOT FORMAL OR TEXTBOOK:
→ Use the spoken register of the language — how people actually talk on the street, in the studio, at home
→ Avoid grammatically "correct" but emotionally stiff phrasing
→ Prioritize how the language feels in the mouth over how it looks on paper

STRUCTURAL VARIATION — PER EVERY 2 LINES:
→ No two consecutive lines should share the same sentence structure
→ Vary: subject placement, verb position, clause length, emotional weight
→ If lines 1 and 2 feel grammatically identical in shape → rewrite one of them

RHYTHM BOUNCE — MIX LINE LENGTHS:
→ Short lines and long lines must alternate or contrast within every verse
→ A run of same-length lines flattens the rhythm — break it deliberately
→ Phrasing should feel like breathing: inhale (short) → exhale (long) → punch (short)

NATURAL IMPERFECTION — HUMAN SPEECH PATTERNS:
→ Allow emotional pauses, street slang, culturally natural interjections
→ Incomplete thoughts that land as punchlines are valid
→ Real speech is not always grammatically complete — lyrics don't have to be either

PROGRESSION OVER REPETITION:
→ BAD: same phrase repeated with small word changes
→ GOOD: each line advances the idea — new angle, new image, new emotional layer
→ Even if the emotional theme stays the same, the expression must evolve line by line

CHORUS NATURALIZATION:
→ The chorus must feel musical and chantable — not looped text on a page
→ Read it aloud mentally: does it feel good to say? Does it bounce?
→ If it reads like a written statement → rewrite it as something sung

VERSE NATURALIZATION:
→ Verses must feel like storytelling in motion — not a list of statements
→ Each line should feel like it was just thought of in that moment
→ The voice should feel present, alive, and specific — not narrated from a distance

STIFFNESS TEST — APPLY BEFORE FINALIZING EVERY LINE:
→ "Does this sound like a real person singing this naturally?" — If NO → rewrite
→ "Does this sound like translated text?" — If YES → reconstruct from the idea, not the English version
→ "Would a street artist from this culture deliver this line without hesitation?" — If NO → rewrite
→ "Does this line have the natural rhythm of this language's spoken cadence?" — If NO → rewrite

IF LANGUAGE FEELS STIFF → REWRITE AUTOMATICALLY:
Do not output stiff lyrics. Rewrite until the line flows like spoken music. Stiffness is a failure state, not an acceptable compromise.

TWI FLOW NATURALIZATION (activates when language is Twi or Ghanaian):
→ Avoid repetitive spiritual filler phrases — do not loop the same phrase with minor changes
→ Use conversational Twi structure, not formal or ceremonial repetition
→ Prioritize meaning over word recycling — each line must say something new
→ Allow emotional storytelling instead of mantra-style looping

BANNED PATTERN IN TWI — never repeat the same phrase block across consecutive lines:
✗ "Yɛn nsa ahyɛ ase" repeated more than once in any section

REQUIRED VARIATION — when returning to a similar idea, rephrase it completely:
→ Instead of repeating: use variations like:
   "yɛn gyidi na ɛkɔ so" (our faith keeps moving)
   "yɛn nsa mu dɔm no kɔ anim" (the work of our hands advances)
   "yɛn akwantu no nni awieɛ" (our journey has no end)
→ Each return to a theme must come from a new angle — new image, new verb, new emotional position

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMOTIONAL INTENSITY CURVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every song must have a dynamic shape. Do not write every section at the same emotional volume.
Map the intensity across sections like this:

CHORUS (opening) — HIGH
→ Immediate emotional impact — listener is pulled in on first contact
→ Energy is present and full from the first word

VERSE 1 — LOW TO MID
→ Pull back from the chorus — create contrast
→ Establish tension quietly — let it build slowly
→ The listener leans in because the energy dropped

CHORUS (second) — HIGH
→ The release after Verse 1 built the tension
→ Feels earned now — hits harder than the first time

VERSE 2 — MID TO HIGH
→ Energy rises relative to Verse 1 — story is deepening
→ More urgency, more detail, more emotional pressure
→ The listener can feel the song moving toward something

CHORUS (third) — HIGH +
→ Carries all of Verse 2's weight — the fullest emotional moment so far

BRIDGE — DROP
→ Strip everything back — this is the emotional valley before the peak
→ Fewest words, longest pauses, most vulnerable moment
→ The quiet before the final release

FINAL CHORUS — PEAK
→ The highest emotional point of the entire song
→ Every line lands with the full weight of everything that came before
→ This is the moment the song was always building toward

INTENSITY RULES:
→ Never let two consecutive sections sit at the same emotional level
→ Contrast is what creates feeling — if everything is loud, nothing is loud
→ The bridge MUST drop before the final chorus — no exceptions
→ Verses should always feel lower energy than the chorus they precede

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LINE QUALITY SCORING SYSTEM (SILENT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before keeping any line, silently score it across four dimensions.
If it fails any one of them → rewrite before moving on.

1. SHARPNESS — does the line cut?
→ PASS: the line makes an impact on its own — it could be quoted
→ FAIL: the line is vague, filler, or could appear in any song on any topic
→ If FAIL: make it more specific, more direct, more precise

2. SPECIFICITY — does it contain a real detail?
→ PASS: names a moment, place, action, time, sensory detail, or feeling with precision
→ FAIL: states an emotion or situation in abstract or general terms
→ If FAIL: ground it — add the time, the place, the thing that was seen or heard

3. SINGABILITY — does it flow on beat?
→ PASS: can be performed naturally in one breath without rushing or stumbling
→ FAIL: too long, grammatically stiff, or awkward to say aloud at speed
→ If FAIL: cut words, restructure, or break across two lines

4. ORIGINALITY — could this line be in 100 other songs?
→ PASS: the phrasing is fresh — it belongs to THIS song and THIS moment
→ FAIL: it is a stock phrase, a familiar construction, or a generic observation
→ If FAIL: find the specific angle that makes this thought unique to this song

SCORING THRESHOLD:
→ A line must PASS all four dimensions to be kept
→ One FAIL = mandatory rewrite — not optional, not a suggestion
→ Do not move to the next line until the current line passes all four

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANTI-REPETITION RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No line should feel like a duplicate of the previous line.

Maximum 2 similar phrases per section.

Each bar must add new meaning, emotion, or imagery.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLOSING LINE LAW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The last line of every section is the most important line of that section.

It must be the sharpest, most quotable, most emotionally complete line in the block.
Sections must not trail off — they must land.

VERSE CLOSE:
→ The final line of every verse must create momentum toward the chorus
→ It should feel like a door opening — not a sentence ending
→ If the last line could be removed without loss → it is not sharp enough — rewrite it

CHORUS CLOSE:
→ The final line of the chorus is the one the listener carries out of the song
→ It must be the most emotionally concentrated line in the hook
→ Short, clear, and impossible to forget

BRIDGE CLOSE:
→ The last line of the bridge is the hinge of the whole song
→ It must feel like the moment everything shifts — a revelation, a release, a turn
→ One line. Maximum weight. No filler after it.

SELF-CHECK — apply to every closing line:
→ "Is this the best line in the section?" — If NO → rewrite it until it is
→ "Would a listener remember this line after one play?" — If NO → sharpen it
→ "Does this line make what comes next feel inevitable?" — If NO → restructure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Must feel real, rhythmic, native.

OUTPUT ONLY SONG.
`;