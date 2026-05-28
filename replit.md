# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Replit Migration Notes

- The project is configured to run on Replit with separate workflows for the Vite frontend on port 5000 and the Express API on port 8080.
- The frontend uses relative `/api` requests proxied to the API server in development, preserving client/server separation.
- The development PostgreSQL database is provisioned through Replit and the Drizzle schema has been pushed for local startup.
- Vite is configured with `allowedHosts: true` and a strict configured port for predictable Replit preview behavior.
- On April 15, 2026, the frontend workflow command was simplified to run from the workspace root without an absolute `cd`, and port 5000 was mapped to the web preview.
- On April 15, 2026, the AI Music API instrumental polling loop was repaired after an import produced invalid `continue`/`break` placement outside the polling loop.
- On April 30, 2026, the AfroMuse Lyrics Intelligence stack (V8.1) was added to `artifacts/api-server/src/routes/generate-song.ts`. Layers run in this order inside `buildUserPrompt` and follow the locked priority stack `Artist > Emotion > Performance > Story`:
  - **ALIC — AfroMuse Lyrics Intelligence Core** (`getAfromuseLyricsIntelligenceCoreBlock`): meta-priority frame. Owns the priority stack, Vocal Flow Engine (chant / smooth / broken / percussive), Hook Engine memorability gate, Adlib Intelligence palette, Call-and-Response control, Emotional Progression rule, Tag Diversity rule, and pre-submit Failure Detection self-audit. Output traced into JSON `lyricsIntelligenceCore` with `priorityStackApplied`, `vocalFlowBySection`, `callAndResponse`, `adlibsBySection`, and `failureChecks`.
  - **ASTE — Artist Style Translation Engine** (`getArtistStyleTranslationBlock`): soft 5-attribute decomposition of any artist reference (vocal texture, energy style, delivery pattern, emotional tone, crowd behavior). Multi-artist parsing via `parseArtistInputs` (splits on `, + & / and plus x vs`) with primary-dominant + secondary-flavor blending. Output traced into JSON `artistStyleTranslation`.
  - **ASOE — Artist Style Override Engine** (`getArtistStyleOverrideBlock`): HARD override when an artist reference is present. Disables generic patterns, default emotion tags, and long narrative sentence structure. Specialized hard-chant mode for Asake-type (3–6 word lines, heavy repetition, crowd/choir, percussive vocal flow, Yoruba-influenced rhythm); chant-forward mode for gospel / fuji / amapiano / spiritual; groove-forward mode for Burna-type; smooth-minimal mode for Wizkid-type; inferred general override for unknown artists. Enforces section-behavior rewrites and the leader/`(crowd)` call-and-response format. Output traced into JSON `artistStyleOverride`.
  - **DET / DETE — Dynamic Emotion Tag Engine** (`getDynamicEmotionTagBlock`): forces ORIGINAL, context-aware, section-aware emotion tags for every section (intro / verse1 / hook1 / verse2 / bridge / hook2 / hook3 / outro). Bans static defaults (Anthemic / Energetic / Smooth & Seductive / etc.), varies repeated sections, auto-engages chant mode when reference contains `asake / chant / choir / street / gospel / spiritual / fuji / hymn / call-response / crowd`. **Storyline-rooted requirement (RULE 5b)**: every tag must contain at least one concrete word/image/verb from the song's topic — interchangeable tags are failed tags. **Expanded banned-tag list (RULE 5c)** explicitly forbids `Anthemic Energy / Catchy Hook Energy / Smooth & Melodic / High Energy / Generic Pain / etc.` verbatim. Output traced into JSON `dynamicEmotionTags`.
  - **Engine Compliance Audit** (`auditEngineCompliance` ~line 2119) — programmatic gate that converts the prompt rules from "please" into "must". Runs on every draft inside `scoreLyricsDraft`. Hard fails (-200 each) include: all three trace fields missing, chant mode active with empty `callAndResponse`, banned static tag used verbatim in `dynamicEmotionTags`, hook lines exceeding the artist's `lineLengthBudget` by >2 words. Soft issues (-25 each) include: same emotion tag in 2+ sections, model self-flagged regenerate, missing `vocalFlowBySection` / `adlibsBySection`, single-word generic tags. The Qwen primary-then-strict-retry path uses these scores to pick the better of the two Qwen drafts. **No C-minor default / no 100 BPM default**: the JSON schema (~line 932) demands a genre/mood-specific key and digits-only BPM (no "BPM" suffix in the value).
  - **Locked model role split (April 30, 2026 — user directive)**: **Qwen3.5-122B owns the lyrics end-to-end** (primary → strict retry → cool-temperature retry, all Qwen). **Llama-4-Maverick owns the blueprint / production-flow end-to-end** (primary → cool-temperature retry, all Maverick). Maverick is intentionally NOT in the lyrics path, and Qwen is intentionally NOT in the blueprint path — Qwen is stronger at dense lyric instruction-following, Maverick is faster and well-suited to the structured production brief. See `QWEN_LYRICS_MODEL` / `QWEN_LYRICS_RETRY_MODEL` / `MAVERICK_FLOW_MODEL` / `MAVERICK_FLOW_RETRY` constants near line 2487 in `generate-song.ts`.
  - **Qwen latency hardening (April 30, 2026)**: the V8.1 user prompt is intentionally large (~16,400 estimated tokens) because every layer above is fully described inline. Empirically Qwen3.5-122B needs ~120–180 s on this prompt, so all five lyrics-call sites in `generate-song.ts` use `AbortSignal.timeout(200_000)` and the Maverick blueprint race is at 35 s. Three additional safeguards prevent wasted retries: (1) `validateStructure` (~line 1957) treats line-count drift of ±2 as a softIssue instead of a hard failure, so a Qwen draft 1 line over schema is accepted instead of triggering a 100 s+ strict retry; (2) `callLyricsModel` (~line 2654) detects `APIUserAbortError` via `err.constructor.name` and tags the failure as `"api timeout"` so the cool-temperature retry is skipped (it would just timeout again); (3) the Qwen primary site logs `promptChars` / `estPromptTokens` / `elapsedMs` for every call so future regressions in prompt size are visible at a glance. Verified live: end-to-end song generation completed in ~177 s (HTTP 200) with a hit score of 94/100 on a Pidgin Spiritual Afrobeats Asake-style chant.
  - **MSGP — Multi-Stage Generation Pipeline (April 30, 2026, locked)**: the `/generate-song` route was refactored from a monolithic Qwen-with-everything prompt into a three-stage pipeline that separates THINKING from CREATION. The full V8.1 stack still EXISTS in the file (and in `buildUserPrompt`) so other routes and the legacy fallback are unaffected, but it is no longer resent on every Qwen call. New helpers live just above the route at `~line 2533`:
    - **`CreativeBlueprint`** — typed shape for the Stage 1 output (`emotion_map`, `flow_map`, `hook_style`, `adlib_style`, `artist_behavior`).
    - **`BLUEPRINT_SYSTEM_PROMPT` + `buildBlueprintPrompt`** — short Maverick prompt that produces the blueprint JSON in 4–10 s. NO lyrics in this stage.
    - **`LYRICS_COMPRESSED_SYSTEM_PROMPT` + `buildCompressedLyricsPrompt`** — short Qwen prompt (~1.6 K chars vs ~15 K legacy) that ships only compressed rules + the Stage 1 blueprint. The blueprint carries the intelligence so the V8.1 layers are not duplicated.
    - **`lightValidate` + `buildLightFixPrompt`** — Stage 3 programmatic checks (hook anchored to keeperLine, cross-section duplication ratio, blueprint flow_map drift, model self-audit). On failure runs ONE targeted Qwen edit at `QWEN_LYRICS_RETRY_MODEL`; the fix is kept ONLY if the recheck strictly reduces the issue count.
    - **Route flow** (inside the `try` block at `~line 3042`): Stage 1 Maverick blueprint → Stage 2 Qwen lyrics with compressed prompt + blueprint → Stage 3 light fix (skipped when the draft already passes) → existing post-step Maverick **production** blueprint (BPM / key / stems — distinct from the Stage 1 creative blueprint) → merge. The Stage 1 blueprint is surfaced on the response as the additive `creativeBlueprint` field; all pre-existing SongDraft fields the frontend consumes are preserved.
    - **Graceful degradation**: if Stage 1 fails entirely the route falls back to the legacy `SYSTEM_PROMPT` + `buildUserPrompt` flow for Stage 2 so users still get a song. Cool-temperature retry only fires when the primary Qwen call returned no draft AND did not time out.
    - **Verified live**: end-to-end completed in **87 s** (Stage 1: 4.2 s · Stage 2: 66.5 s · Stage 3: 0 ms · production blueprint: 17 s) with a hit score of 91/100 and a Burna-style Naija Melodic Pidgin call-and-response hook anchored to the keeper line — meeting the 60–90 s target.
    - **Untouched**: `rewrite-lyrics.ts`, `harden-lyrics`, `catchier-lyrics`, `smart-rewrite-lyrics` and every V8.1 helper (`getAfromuseLyricsIntelligenceCoreBlock`, ASTE/ASOE/DET/DETE blocks, `auditEngineCompliance`, `scoreLyricsDraft`) all continue to work as before — MSGP only changes how the lyrics route consumes them.
  - **PDLCS — Prompt Distribution + Light Compression System (April 30, 2026, locked)**: a refinement on top of MSGP that redistributes intelligence across stages instead of shrinking it. **Principle: full intelligence lives ONLY in Stage 1 (the THINKING brain); Stage 2 (the WRITING brain) gets blueprint + bullet commands only.** Anything stated in the blueprint is NEVER restated in the Stage 2 prompt. Implementation:
    - **`BLUEPRINT_SYSTEM_PROMPT` doubled** from ~2.6 K → 5.0 K chars (~1,260 tokens) and now carries the FULL ALIC-grade rule set inline: priority stack (locked), emotion → writing-control behaviors (PAIN CHANT / HYPE / SPIRITUAL WAVE / STREET SURVIVAL / BROKEN LOVE ECHO with explicit behavioral consequences), vocal flow engine (4 types described), hook engine memorability gate (4 gates), adlib intelligence palettes (5 emotions), artist-aware tag adaptation (Asake / Burna / Wizkid / Davido / unknown / none), emotional progression rule, tag diversity rule, banned-generic-tags fail-on-sight list, and auto-chant-mode trigger conditions.
    - **`LYRICS_COMPRESSED_SYSTEM_PROMPT` halved** from ~2.9 K → 1.5 K chars (~370 tokens). Reformatted from paragraph rules into 10 bullet commands. Removed every explanation, every restated intelligence rule, every retry/scoring/validation prose. Kept only the writing-time constraints (honor blueprint, hook anchor, dialect realism, no meta artifacts, no empty lines, line-target match) plus the JSON output schema.
    - **`buildCompressedLyricsPrompt` deduped**: removed `DNA MODE / EMOTIONAL LENS / ENERGY / HOOK STRUCTURE / ARTIST MINDSET` summary lines (all already encoded in the blueprint). Inlined the blueprint as compact JSON (no pretty-print). Kept INPUT, USER DIRECTION, BLUEPRINT, SECTION LINE TARGETS only.
    - **PDLCS budget guard**: route now logs `sysChars / userChars / estTokens` for every Stage 2 call and emits a `warn` if `estTokens > 8 000`, so any future regression that re-introduces duplication is visible immediately.
    - **Verified live**: end-to-end completed in **36.4 s** (Stage 1: 3.9 s · Stage 2: 18.8 s · Stage 3: 0 ms · production blueprint: 13.7 s) with a hit score of 89/100 and a complete Asake-style Naija Street Pidgin chant — keeper "From the trench we rise!" repeated in the chorus, ASOE-grade emotion tags ("Pain Chant (Street Choir)", "Prayer Chant Wave", "Street Hype (Crowd Ready)"), and a `lyricsIntelligenceCore.vocalFlowBySection` trace that mirrors the blueprint `flow_map` exactly (proving the blueprint is the source of truth and rules are not duplicated). Stage 2 prompt was 651 tokens — well under the 8 K cap. **Speedup: 4.9× vs legacy (177 s → 36 s), 2.4× vs the pre-PDLCS MSGP (87 s → 36 s).**
  - **AFROMUSE 4-MODEL EMOTION CONTROL SYSTEM (April 30, 2026, locked — supersedes the 3-stage MSGP/PDLCS flow)**: `/generate-song` now orchestrates four specialized NVIDIA NIM models with one model per cognitive role. PDLCS is **kept as the underlying compression discipline** — the Stage 3 lyrics prompt is still the PDLCS-compressed bullet list, and the blueprint still carries the intelligence so V8.1 layers are not duplicated. Pipeline:
    - **Stage 1 — Structure Brain (`meta/llama-4-maverick-17b-128e-instruct`, temp 0.6)**: produces the structural blueprint only (`flow_map`, `hook_style`, `adlib_style`, `artist_behavior`). The `BLUEPRINT_SYSTEM_PROMPT` was retitled "STRUCTURE BLUEPRINT — STAGE 1 (4-MODEL PIPELINE)" and `emotion_map` was removed from its output contract; emotion context is still *read* by Maverick to make smart flow/adlib choices, but Maverick no longer *produces* tags.
    - **Stage 2 — Emotion Authority (`openai/gpt-oss-120b`, temp 0.85; was `meta/llama-3.2-3b-instruct` @ 0.45 — see Stage 4 role-swap note below)**: heavyweight, high-temperature model that assigns ONE behavioral emotion tag per section. Helpers are `EMOTION_TAG_SYSTEM_PROMPT` + `buildEmotionTagPrompt`. Output is an `EmotionTagMap` keyed by `intro / verse1 / hook / verse2 / bridge / outro`. Three safety nets in priority order: (a) the prompt forbids verbatim repeats and flat words like "happy"/"sad"; (b) a programmatic dedup pass on our side appends a section-flavored suffix to any duplicate the 3B model lets through (logged as `MSGP Stage 2: dedup'd repeated emotion tag`); (c) if the model is unavailable, a deterministic `fallbackEmotionMap` derives an evolving 6-tag map from mood/genre (spiritual / pain / hype / default lanes). Tags are then merged into `blueprint.emotion_map` so the rest of the pipeline sees one unified `CreativeBlueprint` contract — no signature changes downstream.
    - **Stage 3 — Lyrics Writer (`qwen/qwen3-next-80b-a3b-thinking`, temp 0.85)**: existing PDLCS-compressed Qwen call, unchanged signature. Sees the merged blueprint (structure + emotion). Cool-temperature retry only fires when the primary call returned no draft AND did not time out. PDLCS budget guard still warns if the prompt exceeds 8 K tokens.
    - **Stage 4 — Polish Layer (`upstage/solar-10.7b-instruct`, temp 0.55)**: tightens word choice, rhymes, and chant cadence. **Critical constraint: Solar has a HARD 4096-token context window**, so `buildSolarPolishPrompt` sends only the lyric arrays + a tight blueprint dump (flow + emotion only — no adlib palettes, no intelligenceCore), and `SOLAR_POLISH_SYSTEM_PROMPT` instructs Solar to return ONLY the section arrays. `max_tokens: 2200` (input ~1100 + output ~2200 ≤ 4096). Strict acceptance gate: keep the polished draft only if (1) every section has the EXACT same line count as the input AND every line is a non-empty string, AND (2) the recomputed hit score does not drop by more than 2 points. The original `title`, `keeperLine`, `keeperLineBackups`, and `lyricsIntelligenceCore` are preserved on our side regardless of what Solar returns — only the section line arrays are overlaid.
    - **Stage 5 — Light Validation (safety net, was Stage 3 in PDLCS)**: programmatic checks AFTER polish via `lightValidate` + ONE targeted Qwen fix that edits only the affected lines. Kept only if it strictly reduces the issue count.
    - **Production blueprint post-step (Maverick BPM/key/stems)**: unchanged. Distinct from the Stage 1 creative blueprint.
    - **Response shape (additive)**: surfaces both `creativeBlueprint` (full merged contract — structure + emotion) AND a standalone `emotionTags` field for clarity and audit trail. All pre-existing SongDraft fields the frontend consumes are preserved.
    - **Graceful degradation**: every external stage has its own `try/catch` and timeout — Stage 2 (20 s) falls back to the deterministic emotion map; Stage 4 (60 s) is silently skipped if it fails or its acceptance gate rejects the polish; Stage 5 fix is rejected if it makes things worse. Generation never hard-blocks on Stage 2 or 4.
    - **Verified live (4-model end-to-end)**: HTTP 200 in **81 s** (Stage 1: 2.7 s · Stage 2: 1.0 s · Stage 3: 41.0 s · **Stage 4 polish ACCEPTED: 11.4 s** · Stage 5: 11.0 s · production blueprint: 14 s) with hit score **84/100** (hook 80 · emotion 90 · flow 70 · originality 100 · performance 80), 6 unique evolving emotion tags ("Quiet Pain Float" → "Prayer Chant Wave" → "Crowd-Ready Confident Roll" → "Pain Chant (Street Choir)" → "Broken Hope Cry" → "Triumphant Pain Chant"), keeper "Trenches no go kill us, we go rise" preserved through polish. Speed sits in the predicted 70–90 s window — slower than pure PDLCS (36 s), faster than legacy (177 s), and now produces real polished output.
    - **Deferred**: Language Localization Engine (LLaMA 3.1 70B, `meta/llama-3.1-70b-instruct`) for Custom Language flavors — the model is verified available on NVIDIA NIM but is intentionally not wired in this round; spec lives in `attached_assets/Pasted--AFROMUSE-LANGUAGE-LOCALIZATION-ENGINE-LLaMA-3-1-70B-RO_1779930769486.txt`.
  - **AUTHORITATIVE-MODE HARDENING (April 30, 2026)**: turned the lyrics pipeline from "suggestive" into "authoritative" via 7 targeted fixes — prompt-side and code-side together so the system fails closed instead of drifting to safe defaults. All edits are in `artifacts/api-server/src/routes/generate-song.ts`:
    - **FIX 1 — Hard line-count enforcer**: `LYRICS_COMPRESSED_SYSTEM_PROMPT` now opens with a NON-NEGOTIABLE block declaring verses MUST be 8 / 12 / 16 lines and intro/hook/bridge/outro MUST match SECTION LINE TARGETS exactly. Backed by the existing Stage 5.5 structure enforcer that runs a targeted Qwen trim/expand pass.
    - **FIX 2 — Emotion-tag binding**: prompt now states tags are BEHAVIOR controllers (word choice + rhythm + delivery), not decoration, with concrete behavioral mappings for Pain Chant / Street Hype / Prayer Wave / Broken Echo / Confident Roll. Mismatch = REWRITE the section.
    - **FIX 3 — Banned generic emotion tags**: `EMOTION_TAG_SYSTEM_PROMPT` now carries an explicit FAIL-ON-SIGHT list (Anthemic / Energetic / Calm Resolution / Emotional Peak / Confident & Rhythmic / Smooth & Seductive / Smooth & Melodic / Catchy Hook Energy / Generic Pain / Reflective / Uplifting). Programmatic safety net inside `callEmotionEngine` detects any banned tag verbatim post-generation and rewrites it with a section-flavored, storyline-rooted replacement (logged as `MSGP Stage 2: banned generic emotion tag replaced`) — Qwen never sees a banned tag downstream.
    - **FIX 4 — Tag variation logic**: the Emotion Engine prompt now contains an explicit GLOBAL VARIATION RULE (no two sections may share the same tag verbatim, every tag must be unique across all six sections) plus an EMOTIONAL ARC block that locks the Start → Struggle → Pressure → Release → Reflection → Resolution progression for intro / verse1 / hook / verse2 / bridge / outro. Pairs with the existing programmatic dedup safety net.
    - **FIX 5 — Blueprint authority rule**: `LYRICS_COMPRESSED_SYSTEM_PROMPT` now opens with "BLUEPRINT AUTHORITY RULE (LAW — NOT A SUGGESTION)" — Qwen MUST follow emotion_map / flow_map / hook_style / adlib_style / artist_behavior EXACTLY, with explicit "do NOT reinterpret / override / simplify / improve" language.
    - **FIX 6 — Filler control**: prompt-side hard cap of "at most 1 filler line per 4 lines" (eh / mmm / oh Lord / yeah / woah / ahh). Programmatic safety net inside `lightValidate` (~line 3424) computes filler ratio per section using a regex against single-token filler lines and adds a `filler: <section> has X filler lines (cap Y)` issue when the cap is exceeded — Stage 5 light fix then targets those sections.
    - **FIX 7 — Post-generation validator**: leverages the existing `lightValidate` + Stage 5.5 structure enforcer pipeline, now extended with the FIX 3 banned-tag check (in the emotion engine) and the FIX 6 filler-ratio check (in lightValidate). Together these auto-rewrite only the broken section instead of forcing a full regeneration.
    - **PDLCS budget impact**: `LYRICS_COMPRESSED_SYSTEM_PROMPT` grew from ~1.5 K to ~2.7 K chars (~680 tokens). Still ~3 K chars under the 8 K-token Stage 3 cap; the budget guard at `~line 4010` will warn if a future regression pushes past it.
  - **V9 STRICT EXECUTION MODE (April 30, 2026)**: built on top of the authoritative-mode hardening, V9 reframes Qwen's identity from "creative writer" to "Structure Execution Engine" and extends the all-section line-count enforcer. All edits in `artifacts/api-server/src/routes/generate-song.ts`:
    - **Identity flip**: `LYRICS_COMPRESSED_SYSTEM_PROMPT` retitled "AFROMUSE LYRICS EXECUTION ENGINE — STAGE 3 (V9 STRICT EXECUTION MODE)" with a new opening "🧠 CORE IDENTITY (LOCKED — DO NOT DRIFT)" block: Qwen is told it is NOT a creative writer / NOT a songwriter — it is an EXECUTION ENGINE that converts blueprint → structured lyrics with ZERO deviation. Forbidden behaviors (improvise structure / merge emotions / add extra lines / reinterpret tags) are listed by name.
    - **LINE COUNT RULE (ABSOLUTE — V9)**: explicit per-section windows in the prompt — INTRO 2 (4 if SECTION LINE TARGETS allows), HOOK 4/6/8, VERSE 8/12/16, BRIDGE 4, OUTRO 2/4. SECTION LINE TARGETS remains the final authority and always wins (so per-arrangement profiles are not overridden).
    - **EMOTION TAG RULE (ANTI-REPEAT, BEHAVIOR-BOUND)**: ONE primary tag per section + ONE optional secondary only when blueprint demands contrast. Adds an explicit ROTATION LAW (intro = mood-set, verse = narrative, chorus = peak, bridge = contrast, outro = resolution).
    - **DYNAMIC STYLE SELECTION RULE**: emotion + delivery MUST be derived from THIS song's story / theme / section role / energy curve — not from generic templates. "A struggle verse is NOT an energetic verse." Pairs with the existing per-request creative spice in the emotion engine.
    - **ADLIB INTELLIGENCE RULE**: adlibs are context-bound and must vary across sections. Forbidden to sprinkle "Oya / Eh / Amen" everywhere. Pulls from blueprint adlib_style.
    - **STRUCTURE ENFORCEMENT (self-validate before return)**: Qwen is instructed to internally verify line counts, emotion diversity, hook-keeperLine anchoring, keeperLine verbatim preservation, and adlib variation before emitting JSON; if any check fails, regenerate ONLY that section.
    - **QUALITY OVERRIDE RULE**: if a draft feels repetitive / flat / tag-stuck, reassign emotion per section and regenerate section TONE — preserve structure and keeperLine, change wording only.
    - **Stage 5.5 generalized to ALL sections**: the post-generation structure enforcer was previously verse-only with a hardcoded `[8, 12, 16]` set. V9 walks every section (intro / verse1 / hook / verse2 / bridge / outro) and now uses `diversityProfile.sectionLineTargets[section]` as the source of allowed counts (per-arrangement, V9-compatible). Hook fixes have a hard "keeperLine MUST appear verbatim" gate — if Qwen drops the keeper while trimming/expanding the chorus, the fix is rejected and the original draft ships. The strict-acceptance gate (every fixed section must hit EXACTLY one of its allowed counts) and the "ship original on failure" fallback are unchanged.
    - **PDLCS budget impact**: Stage 3 system prompt is now ~3.7 K chars (~930 tokens). Still ~4 K chars under the 8 K-token cap; the budget guard at `~line 4010` will warn on regression.
  - **V10 EMOTION DRIFT ENGINE (April 30, 2026)**: replaces the per-section emotion-label model with an arc-based, drift-driven trajectory. Emotion is now a PATH, not a LABEL — every section emotion is required to evolve from the previous one along a song-wide ARC ARCHETYPE. All edits in `artifacts/api-server/src/routes/generate-song.ts`:
    - **Arc archetypes (4 named)**: `ARC_ARCHETYPES` defines four song-wide arcs and their per-section CORE EMOTION steps + illustrative composite tags:
      1. STRUGGLE → PRESSURE → BREAK → RELEASE (street / pain / survival)
      2. CALM → HUSTLE → WIN → CELEBRATION (success / uplifting)
      3. LOVE → DOUBT → LOSS → ACCEPTANCE (romantic / emotional)
      4. CHAOS → CONFUSION → ANGER → DEFIANCE (protest / aggression)
    - **`selectArcArchetype()`**: deterministic heuristic picker that runs before Stage 2. It scans `topic + genre + mood + notes` for keyword anchors (love/heartbreak → romantic, protest/rage → protest, success/win → uplift, default → struggle) and returns the matching archetype. Logged at INFO as `MSGP Stage 2 (V10): emotion arc archetype selected`.
    - **Composite tag format (3-part LAW)**: `EMOTION_TAG_SYSTEM_PROMPT` retitled "AFROMUSE EMOTION DRIFT ENGINE — STAGE 2 (V10 ARC-BASED)". Every tag MUST now be `[CORE EMOTION] + [ENERGY STATE] + [CONTEXT FLAVOR]` (e.g. "Rising Pressure Street Build", "Soft Prayer Spiritual Drift", "Explosive Joy Celebration Wave"). Single-word and two-word tags are explicitly forbidden.
    - **EMOTION DRIFT RULE**: `EMOTION(n) = EVOLVE(EMOTION(n-1), STORY_CONTEXT)` — verse1 influences hook, hook influences verse2, verse2 influences bridge, bridge resolves into outro. Each tag must be a CONSEQUENCE of the previous, never a reset or copy.
    - **EMOTION CURVE INJECTION**: `buildEmotionTagPrompt` now embeds the chosen arc's per-section CORE EMOTION + an example composite tag for every section into the user prompt, so LLaMA sees explicit per-section CORE word targets ("intro → CORE = 'Quiet Pain'", etc.). Examples are illustrative only — the prompt explicitly bans verbatim echo.
    - **Anti-plateau enforcement (programmatic, 3-pass)** inside `callEmotionEngine`:
      - **Pass 1 — composite shape**: any tag with fewer than 3 words is replaced with `arcArchetype.exampleTags[section]`.
      - **Pass 2 — adjacent CORE-EMOTION plateau**: a `coreWord(tag)` helper strips leading energy adjectives (rising / soft / explosive / controlled / hollow / etc.) to extract the actual CORE word. If two adjacent sections share the same CORE word (the classic "Pain Chant Float / Pain Chant Build" plateau, or the canonical "Anthemic / Anthemic" syndrome), the offender is rewritten from the arc archetype — guaranteeing a different CORE step.
      - **Pass 3 — final dedup**: arc-archetype rewrites might collide with another section's existing tag, so a final pass appends a section-flavored suffix to any duplicate.
    - **Adjacent-CORE rule in prompt**: the GLOBAL VARIATION RULE was hardened to also ban adjacent sections sharing the same CORE EMOTION word, with worked examples ("intro=Pain Chant Float, verse1=Pain Chant Build → BANNED"). This makes both the prompt-side rule and the programmatic Pass 2 say the exact same thing.
    - **What V10 fixes**: kills the "Anthemic / Energetic" repetition syndrome, eliminates same-CORE-word adjacent plateaus, removes the "AI template feeling" by forcing 3-part composite phrasing, and binds emotion progression to the song's actual storyline via the arc selector.
  - **V11 CULTURAL VOICE ENGINE (April 30, 2026)**: solves the "correct words, English brain" problem in non-English lyrics — Yoruba words with English rhythm, Twi with Western phrasing, Chinese / Italian lines that read written-not-lived. The engine forces the model to THINK inside the cultural voice instead of translating into it. All edits in `artifacts/api-server/src/routes/generate-song.ts`:
    - **Per-language Cultural Voice Profiles** (`getCulturalVoiceProfile`): nine languages currently mapped — **Yoruba** (wisdom + proverb flow, compressed density), **Twi** (reflective story rhythm, slow pacing), **Pidgin** (street natural flow, fast / high-repetition chant), **Patois** (yard-native conviction, fast riddim chant — V11 frame stacked on top of the existing detailed `getDialectBlock`), **Chinese** (emotional compression, slow / low-repetition / poetic-short), **Italian** (melodic emotional speech, balanced / vowel-melodic), **French** (intimate lyrical phrasing), **Spanish** (passionate direct expression), **Swahili** (communal proverb-rich storytelling). Each profile defines: thinking mode, 4 emotional-delivery rules, rhythm pacing, repetition style, syllable density, structure flex, and 2 cultural emotion-lens examples (Pain + Joy through that culture's lens).
    - **`getCulturalVoiceEngineBlock(effectiveFlavor)`** assembles the V11 block dynamically per language. Returns `[]` for English / unrecognized flavors so English keeps its strict 8/12/16 V9 line counts.
    - **Five enforcement layers** in every emitted V11 block:
      1. **THINKING MODE** — declares the personality of the language ("Wisdom + Proverb Flow", "Emotional Compression", etc.).
      2. **🚫 TRANSLATION IS FORBIDDEN** — explicit law: generate DIRECTLY in the cultural thinking mode; if the line was written in English first and word-swapped, it FAILS. Includes the per-line self-test ("Is this how a native artist would feel and say this?").
      3. **EMOTIONAL DELIVERY (per language)** — 4 culture-specific delivery rules (e.g. for Yoruba: "Use proverbs in place of literal explanation when emotion runs deep" / "Repetition is for EMPHASIS, never filler" / "Spiritual undertone — destiny, ori, ìfẹ́, agbára — should sit underneath even non-spiritual themes").
      4. **DIALECT × EMOTION LAW** — explicitly binds the V10 CORE EMOTION word from Stage 2's tag to the voice style: "Angry Yoruba ≠ Prayer Yoruba", "Street Pidgin ≠ Gospel Pidgin". The same CORE word that drives the emotion arc now also drives pronunciation / phrasing / pacing.
      5. **CULTURAL EMOTION LENS** — 2 worked examples per language showing how generic emotions ("Pain", "Joy") are reframed through the cultural lens (e.g. Yoruba Pain = "destiny struggle tone", Pidgin Pain = "survival / street endurance voice", Chinese Pain = "silent internal suffering metaphor").
      6. **ACCENT SIMULATION** — 3 explicit dials per language: rhythm pacing (slow / balanced / fast), repetition style (low / medium / high), syllable density (compressed / normal / melodic). These lock the linguistic *behavior*, not just vocabulary.
      7. **STRUCTURE FLEX** — V9's strict 8/12/16 line counts are LOOSENED per language: Pidgin → chant rhythm (collapse / split allowed), Yoruba → proverb pacing (proverb + response may collapse), Chinese → short poetic lines, Italian → melodic phrase breaks, etc. SECTION LINE TARGETS still apply but the writer may collapse 2 ultra-short lines into 1 or split 1 long line into 2 when the language's natural rhythm demands it. English is unchanged — it keeps strict V9 counts.
    - **Wired into both prompt paths**: V11 block is injected into the active Stage 3 `buildCompressedLyricsPrompt` (right after `notes`, before the Director Block) AND into the legacy `buildUserPrompt` (right after `languageFlavorInstruction`). Stage 3 is the one Qwen actually sees in the V8.1+ pipeline; the legacy path is covered for completeness.
    - **PDLCS budget impact**: the V11 cultural voice block is ~1.0–1.4 K chars per language (only emitted when non-English is selected). Stage 3 system prompt remains ~3.7 K chars (V9); the V11 block is added to the user prompt instead, which had ~3.5 K chars headroom under the 8 K-token cap. The budget guard at `~line 4010` will still warn on regression.
    - **What V11 fixes**: eliminates "English-brain structure with translated words", binds dialect pronunciation to the V10 CORE EMOTION (so Angry Yoruba reads completely differently from Prayer Yoruba), unlocks language-natural structural flexibility (chant for Pidgin, proverb pacing for Yoruba, poetic compression for Chinese), and gives every supported language its own thinking personality instead of a generic "write in language X" hint.
  - **V12 MASTER INTELLIGENCE CORE (April 30, 2026)**: unifies V8.1 / V9 / V10 / V11 into one in-prompt "Master Rule" contract that makes the writer treat **emotion as BEHAVIOR (not a label), section as ROLE (not just a slot), hook as IDENTITY (not just a chorus), and adlibs as TYPED REACTIONS (not random "yeah/eh")**. All edits in `artifacts/api-server/src/routes/generate-song.ts`:
    - **`getMasterIntelligenceCoreV12Block(arcArchetype, effectiveFlavor)`** — the single new helper, always emitted (English + non-English) into the active Stage 3 user prompt right above the V11 cultural voice block. Carries five enforcement layers:
      1. **MASTER 4-PILLAR RULE** — every draft must satisfy: ① Emotion PROGRESSION ② Cultural THINKING (V11) ③ Vocal BEHAVIOR ④ Blueprint AUTHORITY (V8.1/V9). One contract at the top so every other rule has a parent law.
      2. **EMOTION → BEHAVIOR ENGINE** — explicit mechanical mapping of CORE EMOTION word to physical lyric behavior (line length / repetition / phrasing / delivery): *Pain* → slower lines + repetition + broken phrasing; *Joy* → bouncy lines + chant rhythm + call-response; *Struggle* → storytelling + tension build; *Victory* → confident declarative short punches; *Prayer* → spaced lines + spiritual adlibs + breath in gaps; *Pressure* → compressed escalating density; *Release* → opened phrasing + longer breath; *Anger* → punchy short bursts + hard consonants; *Longing* → drawn vowels + pause-heavy + ache-tinted. This goes beyond V10 (which assigned the tag) — V12 dictates HOW the lines must physically perform that tag.
      3. **SECTION EMOTIONAL ROLE MAP** — each section gets a non-negotiable storytelling job: INTRO=FEELING (climate, not plot), VERSE1=EXPERIENCE (live the situation, first-person), HOOK=STATEMENT (the one thing the song is saying — anchored to keeperLine), VERSE2=ESCALATION (raise stakes / change angle / deepen pressure), BRIDGE=SHIFT (confession / prayer / breakdown / truth pivot), OUTRO=RESOLUTION (closure / fade / triumph — match arc). If verse1 explains instead of experiences, or hook describes instead of states → REWRITE that section.
      4. **HOOK IDENTITY (PICK ONE — NO HYBRIDS)** — the hook must commit to exactly one of: **Chant** (repeated punch phrase, crowd-friendly), **Melody** (vowel-flowing, lifted, sung), **Call-and-Response** (leader line + (crowd response) on next line), or **Minimal Mantra** (3–5 word repeated anchor, Asake-style). The new helper `suggestV12HookIdentity(arcArchetype, effectiveFlavor)` auto-suggests the right identity by reading V10's arc archetype + V11's cultural flavor: **struggle / protest** OR street culture (Pidgin / Patois / Naija / Yoruba) → Chant + (crowd response) (the AUTO-CHANT TRIGGER); **romantic** → Melody; **uplift** → Call-and-Response; default → Minimal Mantra. The suggestion appears inline in the prompt as `SUGGESTED HOOK IDENTITY for this song: **<type>** (<reason>)`. If the hook reads like an ordinary verse line → REWRITE the hook.
      5. **ADLIB EMOTION × CULTURE MATRIX** — adlibs are typed by EMOTION + CULTURE + SECTION ROLE, never random "eh / yeah". Per-emotion bank: Pain → (ahh / why / hmm / no), Prayer → (amen / jah / lord / selah), Street → (oya! / gba! / who dey! / run am!), Victory → (yeah! / we up! / run am! / let's go), Joy → (woo! / bounce! / yeahh / let's go), Struggle → (no lie / real talk / truth / we tried), Longing → (oh / still / wait / one more time). Plus a CULTURE BIAS line dynamically chosen per language: African street palette for Pidgin/Patois/Yoruba/Twi, Latin/romance palette for Italian/Spanish/French (melodic exclamations / sighs / vowel-led emphasis), minimal palette for Chinese (single-syllable emphasis or breath, NOT English-style adlibs). Rule: an adlib that does not match the section's CORE EMOTION (e.g. `(yeah!)` in a Pain verse) → STRIP IT. Cap: ≤ 1 adlib per 2 lines.
      6. **HARD FAIL CONDITIONS** — consolidated rejection checklist that fires internal regeneration of the offending section: (a) two adjacent sections share same CORE EMOTION word (V10 plateau); (b) verse line count ≠ 8 / 12 / 16 (and section is not chant-flexible / non-English per V11); (c) hook has no committed identity (drifts between chant/melody/call-response); (d) adlibs feel random or repeat the same style every section; (e) lines read TRANSLATED in non-English mode (V11); (f) section behavior contradicts its CORE EMOTION (e.g. Joy verse with broken pause-heavy lines); (g) section role missed (verse1 doesn't EXPERIENCE, hook doesn't STATE, etc.); (h) blueprint emotion_map / flow_map / hook_style overridden by "creativity".
    - **Plumbing change**: `buildCompressedLyricsPrompt` now accepts an optional `arcArchetype: ArcArchetype | null` param so V12 can read the song's arc (struggle / uplift / romantic / protest) for hook-identity auto-suggestion. The Stage 3 call site at the end of the route now passes the already-computed `arcArchetype` from V10's `selectArcArchetype()`.
    - **Token budget**: V12 block is ~2.0–2.4 K chars and is always emitted. Combined with V11 (~1.0–1.4 K when non-English), Stage 3 user prompt now sits ~5.5–6.0 K chars + ~5.4 K system prompt. Still well within the 8 K compressed-mode cap; the budget guard at `~line 4010` will warn on regression.
    - **What V12 fixes**: solves the residual "correct emotion words but wrong physical behavior" problem (Pain section that reads like Joy because the lines aren't slower / broken / repetitive); locks each section into its storytelling job so verses stop becoming mini-summaries of the hook; forces the hook to PICK an identity instead of drifting between chant + melody in the same chorus; cleans up "random eh / yeah" adlib spam by binding adlibs to the same CORE EMOTION that drives the section; and consolidates the rejection criteria into one hard-fail list so the writer knows exactly what triggers an internal rewrite. V12 stacks on top of V8.1 / V9 / V10 / V11 — none of those are replaced, V12 is the unified vocal-execution layer above them.
  - All four engines accept both the user's `artistInspiration` AND the Lyrics-Studio `style` (Sound Reference) field as artist references via the shared `parseArtistInputs` helper.
  - **UI BPM rendering**: a `stripBpmSuffix` helper in `Studio.tsx` and an inline regex in `GenerateMusic.tsx` strip any trailing `BPM` text from the model's value before the UI appends its own ` BPM` label, eliminating the legacy "100 BPM BPM" duplication.

## Audio Provider: AI Music API

- **Instrumental generation** is handled by [AI Music API](https://aimusicapi.org) (`AI_MUSIC_API_KEY` env var required).
- POST `/api/v2/generate` → receive `task_id` → poll GET `/api/feed?workId=<taskId>` every 6 s (up to 40 attempts, ~4 min).
- Poll response: `{ data: { type: "SUCCESS"|"IN_PROGRESS"|"ERROR", response_data: [...tracks] } }`.
- **Custom Mode** (lyrics present): `prompt` (lyrics text) + `style` string + `title` + `gender`.
- **Inspiration Mode** (no lyrics): `gpt_description_prompt` + `make_instrumental: true`.
- Auth header: `Authorization: Bearer <AI_MUSIC_API_KEY>`.
- Returns ALL tracks from the API (multi-track: Track A, Track B). Frontend shows all tracks with individual players + download buttons.
- Key files: `artifacts/api-server/src/services/musicGeneration.ts`, `engine/providers/instrumental.ts`.

## Music Generation System (Upgraded April 2026)

### Backend Routes (`artifacts/api-server/src/routes/music.ts`):
- `POST /music/generate` — auth-required; enforces usage limits; saves to `generated_tracks` DB table; returns all tracks
- `GET /music/library` — auth-required; returns user's generated track history (last 100)
- `GET /music/usage` — auth-required; returns current usage count vs plan limit
- `POST /music/callback` — AI Music API webhook

### Usage Limits (enforced server-side):
- **Free**: 1 lifetime generation
- **Creator Pro**: 50 per month
- **Artist Pro**: 100 per month
- **Admin**: unlimited

### Music Generation Payload (full spec):
- Core: `genre`, `mood`, `bpm`, `key`, `energy`, `gender`, `aiMusicModel`, `section`
- Lyrics: `{ intro, verse1, chorus, verse2, bridge, outro }` (arrays of lines)
- Beat DNA: `{ bounceStyle, melodyDensity, drumCharacter, hookLift }` (Pro+)
- Artist DNA: `{ referenceArtist, vocalTexture, singerStyle, dialectDepth }` (Artist Pro)
- Audio Stack: `{ reverb, eq, compression, stereoWidth }` (0–100 sliders)
- Advanced: `styleWeight`, `weirdnessConstraint`, `audioWeight`, `negativeTags`

### Model Access by Plan:
- Free: `chirp-v4-5`
- Creator Pro: `chirp-v4-5`, `chirp-v5`
- Artist Pro: `chirp-v4-5`, `chirp-v4-5-plus`, `chirp-v5`, `chirp-v4-0`

### DB Schema (new table):
- `generated_tracks`: userId, title, audioUrl, coverArt, genre, mood, model, trackIndex, tags, createdAt

### Admin Panel:
- `GET /admin/stats` — includes `audioGenMonthly` and `audioGenAllTime` per user, plus `totalTracks`
- `POST /admin/change-plan` — admin changes user plan (Free/Pro/Gold)

### Frontend Pages/Routes:
- `/generate` — full GenerateMusic component with Beat DNA, Artist DNA, Audio Stack, multi-track display
- `/library` — `Library.tsx` page showing user's saved track history
- `/studio` — `Studio.tsx` with AudioStudioV2

### Key Files:
- `artifacts/api-server/src/services/musicGeneration.ts` — multi-track return, Beat/Artist/AudioStack → prompt
- `artifacts/api-server/src/routes/music.ts` — auth + limits + library
- `artifacts/api-server/src/routes/admin.ts` — usage stats + change-plan
- `artifacts/afromuse-ai/src/components/GenerateMusic.tsx` — full expanded UI
- `artifacts/afromuse-ai/src/pages/Library.tsx` — track library page
- `lib/db/src/schema/generatedTracks.ts` — DB schema for generated tracks

## Music Engine (Python FastAPI)

- New service in `artifacts/music-engine/main.py`, started via the `Music Engine` workflow on port **8000**.
- `POST /generate` accepts `{prompt, key, bpm, mood, artist_dna, beat_dna}`, validates `key`/`bpm` as required, builds a structured `MusicSpec`, logs it, then returns `{status, audio_url, spec}`.
- `generate_music_with_engine(spec)` calls the **ACE-Step** Hugging Face Space using the **Gradio queue-based API** wired to the Space's actual generation function (April 2026 migration — replaces the old `/run/predict` call and the placeholder `fn_index=0`):
  1. `POST {base}/gradio_api/queue/join` with `{data: [...54 inputs...], event_data: null, fn_index: 77, trigger_id: 77, api_name: "generation_wrapper", session_hash}` → returns `{event_id}`.
  2. `GET {base}/gradio_api/queue/data?session_hash=...` as an SSE stream; `iter_lines` over the event stream until `msg: "process_completed"` (success) or a terminal error event (`queue_full`, `unexpected_error`).
  3. Audio URL is extracted from `event.output.data[8]` — the Space's "📁 All Generated Files (Download)" output, which is a list of filepath dicts `[{path, url, ...}, ...]`. Falls back to scanning slots `[0..7]` for direct filepath dicts. Relative paths are prefixed with the base URL.
- **Prompt engine** (`build_afromuse_caption` + `expand_beat_dna` + `_build_tag_prompt` in `main.py`) fuses the inbound free-form prompt with the structured fields into two ACE-Step-ready strings:
  - `caption` — multi-line **AfroMuse spec block** with sections `STYLE / HARMONY / RHYTHM / INSTRUMENTATION / MOOD / STRUCTURE / PRODUCTION / HARMONIC_TONE`. `STYLE` is hard-coded to `Afrobeat`; `HARMONY.Key`, `RHYTHM.BPM`, `MOOD`, and the artist/beat lines are filled from the spec. `expand_beat_dna(beat_dna)` enriches the user's beat DNA with a canonical afrobeats kit (`log drums, shakers, kick-snare-hat groove, talking drum accents`), and falls back to that kit alone when no beat DNA is provided. Used as the `simple_query_input` content (slot [2]).
  - `tag_prompt` — comma-separated descriptor tags built from `genre + mood + artist_dna + beat_dna` (deduped, case-insensitive). Used as the custom-mode `Prompt` tag input (slot [4]).
- `MusicSpec` now carries both the original `prompt` (verbatim user text) and the engineered `caption` + `tag_prompt`, alongside `key_scale`, `bpm`, `duration`, `genre` (always `"afrobeat"`), `mood`, `artist_dna`, `beat_dna`, `vocal_language`.
- **`generation_wrapper` payload** (`_build_generation_wrapper_payload`) builds the 54-element input array in **`custom` mode by default** so the Space's structured inputs actually drive generation (not just `simple_query_input`). The simple_* slots are still populated as a safety fallback in case the Space ever ignores custom-mode fields:
  - `[0] selected_model` ← `ACE_STEP_MODEL` (default `acestep-v15-xl-turbo`)
  - `[1] generation_mode` ← `ACE_STEP_GENERATION_MODE` (default `"custom"`, validated to `{"simple","custom"}`)
  - `[2] simple_query_input` ← `spec.caption` (rich prompt-engine sentence — fallback)
  - `[3] simple_vocal_language` ← `spec.vocal_language` (fallback)
  - `[4] Prompt (custom)` ← `spec.tag_prompt` (descriptor tags)
  - `[5] Lyrics (custom)` ← `""` (instrumental for now)
  - `[6] BPM (custom)` ← `int(spec.bpm)`
  - `[7] Key Signature (custom)` ← `spec.key_scale`
  - `[8] Time Signature (custom)` ← `""` (component default)
  - `[9] Vocal Language (custom)` ← `spec.vocal_language`
  - `[15] Audio Duration (seconds)` ← `spec.duration` (default 12, kept short to avoid the Hugging Face Space's free-tier GPU quota)
  - `[23] task` ← `"text2music"`
  - All other 42 inputs use the Space's component defaults (DiT inference steps=8, batch size=2, `mp3` output, LM temp=0.85, etc.)
- The legacy `[caption, genre, mood, key_scale, bpm, duration]` 6-element array has been removed.
- `GenerateRequest` accepts two optional fields: `vocal_language` (default `"en"`, normalized against the Space's allow-list) and `duration` (default `12`, range 5–240 s). Existing `prompt`/`key`/`bpm`/`mood`/`artist_dna`/`beat_dna` fields are unchanged.
- Configuration env vars: `ACE_STEP_BASE_URL` (default `https://ace-step-ace-step-v1-5.hf.space`), `ACE_STEP_FN_INDEX` (default `77`), `ACE_STEP_API_NAME` (default `generation_wrapper`), `ACE_STEP_MODEL` (default `acestep-v15-xl-turbo`), `ACE_STEP_GENERATION_MODE` (default `custom`, alternative `simple`), `ACE_STEP_TIMEOUT` (default `240` s, total deadline for the SSE stream), `ACE_STEP_CONNECT_TIMEOUT` (default `30` s). The legacy `ACE_STEP_URL` env var is still honored — any trailing `/run/predict`, `/api/predict`, or `/gradio_api/queue/join` suffix is stripped automatically.
- On any failure (network error, non-2xx on `/queue/join` or `/queue/data`, malformed SSE line, terminal error event, timeout, missing audio URL) the engine logs the full request + response context (truncated to 2000 chars) and returns `{"status": "error", "audio_url": "", "spec": {...}, "error": "..."}` — the frontend gets a stable shape it can render.
- The frontend Vite dev server proxies `/engine-api/*` → `http://localhost:8000/*` (see `artifacts/afromuse-ai/vite.config.ts`).
- Frontend integration: the **Audio Studio tab on `/studio`** drives the engine via the engine selector (see next section). No standalone Generate / Engine page exists.
- Backend logs both `Incoming Request:` and `Final Spec:` via `print(...)` (stdout) and `logger.info(...)`.

### Engine selector inside Audio Studio (April 2026)

The engine selector lives **inside the Audio Studio tab on `/studio`** (`AudioStudioV2.tsx`). There is no separate Generate / Engine page — all music generation happens in one place.

- The selector sits at the very top of the Audio Studio form ("Generation Engine" section) with two pill cards:
  - **AfroMuse Engine** (default) → Python FastAPI on port 8000 via `/engine-api/generate`
  - **AfroMuse Cloud** → existing `/api/generate-instrumental-preview` pipeline (unchanged)
- Internal `engine` state values: `"afromuse"` and `"cloud"`.
- The third-party "Udio" brand is no longer surfaced anywhere in the UI.
- When **AfroMuse Engine** is selected:
  - A required **Engine Prompt** textarea appears directly under the selector (falls back to the Style Direction field if left blank).
  - Clicking "Generate Instrumental" branches into `runAfroMuseEngine()` which composes `{ prompt, key, bpm, mood, artist_dna, beat_dna }` from the existing Audio Studio fields (Voice DNA → `artist_dna`; Beat DNA → `beat_dna`).
  - `console.log("AfroMuse Payload:", payload)` before POSTing to `/engine-api/generate`.
  - Validates `prompt`, `key`, `bpm` client-side and shows a destructive toast with the backend's error string otherwise.
  - On success the returned `audio_url` flows into the existing `<AudioPlayer>` and the spec is shown as a collapsible **Engine Spec / Debug View** card (chips of key/value pairs + raw JSON) right below the player.

## AfroMuse Engine

- The lyrics generation system prompt has been replaced with the AFROMUSE_ENGINE, a clean structured prompt with a fixed song structure (INTRO → CHORUS → VERSE1 → CHORUS → VERSE2 → CHORUS → BRIDGE → OUTRO) and simple rules: catchy chorus, storytelling verses, natural phrasing, short rhythmic lines.
- User inputs map to: theme (topic), mood, language (languageFlavor), style (genre).
- The JSON output format is preserved for frontend compatibility: title, intro, hook, verse1, verse2, bridge, outro, diversityReport, and analytics fields.

## Lyrics Emotion Intelligence Layer

- New module `artifacts/afromuse-ai/src/lib/lyricsEmotion.ts` adds an **emotion-aware tagging layer** on top of any generated `SongDraft`. It is strictly additive — it does **not** add, remove, reorder, or rewrite sections.
- Emotion catalog (7 tags): `Confident & Rhythmic`, `Smooth & Seductive`, `Building Tension`, `Emotional Peak`, `Reflective / Deep`, `Anthemic / Energetic`, `Calm Resolution`.
- `inferLyricsEmotions(draft, mood)` returns one tag per section role (`intro`, `hook`, `verse1`, `verse2`, `bridge`, `outro`) using:
  1. **Keyword scoring** — each section's lines are scanned against a per-tag lexicon (e.g. `kiss/touch/skin → Smooth & Seductive`, `rise/fire/win → Anthemic / Energetic`, `tears/break/pain → Emotional Peak`, `?` count → Building Tension, etc.).
  2. **Role + mood fallback** — when scoring is inconclusive, the chorus uses a `mood → tag` bias table (`Romantic → Smooth & Seductive`, `Heartbreak → Emotional Peak`, `Uplifting → Anthemic / Energetic`, …) and other roles fall back to a sensible per-role default.
  3. **Consistency rules** — outro is always `Calm Resolution`; no two adjacent sections in playback order share the same tag (collisions are downgraded to a related sibling via a small `FAMILIES` graph); the bridge is forced to contrast the chorus.
- Wired into three render sites without changing structure or order:
  - `formatDraftForClipboard` (in `songGenerator.ts`) — exported / clipboard text now reads `[ CHORUS - Smooth & Seductive ]`, `[ VERSE 1 - Confident & Rhythmic ]`, etc.
  - `LYRICS_SECTIONS` in `pages/Studio.tsx` — each section header still shows the original colored tag (Chorus / Verse / Bridge / Intro), with a **second small badge** appended showing the inferred emotion.
  - Drawer in `pages/Projects.tsx` — section labels in the saved-project drawer are decorated with `— <emotion>`.
- The chorus emotion is computed once and reused on every chorus repeat, so all three chorus instances share the same anchor emotion.

## V13 Runtime Audit Pass (April 30, 2026)

The Stage 3 lyrics pipeline now enforces the V12 master core's HARD FAIL conditions both **in-prompt** and **post-generation**:

- **Prompt additions** in `LYRICS_COMPRESSED_SYSTEM_PROMPT` (`artifacts/api-server/src/routes/generate-song.ts`):
  - Dialect Authenticity Rule (no English-with-swapped-words; switch to native grammar system).
  - Dancehall Mode (real Patois grammar — `mi nah / dem cyaan / weh dem know bout / inna di place / man a rise`; bans `de de de / fi de / we a we a` spam).
  - Hook Quality Rule (repetition must evolve line-to-line OR include a `(crowd)` line; flat loops are rewritten).
  - Genre Dominance Rule (Dancehall ≠ Afrobeats ≠ Drill ≠ Amapiano ≠ Gospel ≠ Highlife — genre overrides defaults).
  - Emotion → Writing Enforcement (each section's tag must visibly change ≥4 of: line length, repetition, energy, vocal tone, adlib palette).

- **Dynamic emotion-tag section labels**: `draftToLyricsText` now reads `draft.emotionTags` (Stage 2) or `creativeBlueprint.emotion_map` (fallback) and emits headers as `[Verse 1 — <tag>]` / `[Chorus — <tag>]`. Static labels like "Anthemic / Energetic" are no longer hard-coded.

- **Stage 5.7 — `runtimeAuditV13`** (after Stage 5.5, before Stage 6 localization). Programmatically checks the draft against the master core's HARD FAIL conditions:
  1. **HF-1 lineCount** — section line count outside `diversityProfile.sectionLineTargets` window.
  2. **HF-2 adjacentCorePlateau** — two adjacent sections share the same CORE EMOTION word (energy adjectives stripped).
  3. **HF-3 hookIdentityDrift** — flat repetition loop (identical first-3-word anchor across all hook lines, no `(crowd)` line, no full-line variation).
  4. **HF-4 wrongEmotionAdlib** — adlibs whose family doesn't match the section's CORE (e.g. `(yeah!)` inside a Pain verse), checked against `V13_ADLIB_FAMILIES` with neutral adlibs tolerated.
  5. **HF-5 missedSectionRole** — hook missing the `keeperLine` (no STATEMENT), or verse2 line-set overlap with verse1 ≥ 0.60 (no ESCALATION).

- **Per-section regeneration**: when the audit finds failures, `buildV13RegenPrompt` asks the Qwen retry model (`QWEN_LYRICS_RETRY_MODEL`, JSON-only, 60s timeout) to rewrite **only the offending sections**, with each section's emotion tag, target line count, and fail reasons explicitly spelled out. Regenerated sections are accepted only if they (a) hit the allowed line-count window, (b) preserve the keeperLine for hook fixes, and (c) the next audit shows a strictly lower failure count. Up to 2 fix passes; if violations persist, the best draft ships and residual failures are logged.

## Stage 4 — Micro-Refinement Engine (April 30, 2026, replaces Solar polish)

Solar-10.7B was previously running as the Stage 4 "polish" pass but it kept degrading lyrics — flattening dialect, translating street language into standard English, weakening emotional intensity, and rewriting rhythm/phrasing. That broke every downstream intelligence layer (style, emotion, chant behavior). Stage 4 has been rebuilt as a strict micro-refinement pass:

- **Model swap (initial)**: replaced Solar with `openai/gpt-oss-120b` (temperature `0.2`, JSON-only output, 60s timeout) running in strict-preservation mode.
- **Role swap with Stage 2 (current, April 30 2026)**: swapped the gpt-oss-120b ↔ LLaMA 3.2 3B assignments between Stage 2 (emotion authority) and Stage 4 (micro-refinement). Stage 4 now runs on `meta/llama-3.2-3b-instruct` (temperature `0.2`); Stage 2 now runs on `openai/gpt-oss-120b` (temperature `0.85`). Rationale: a small + cool model is the better fit for "fix only mechanical issues, change nothing else", while emotion-tag generation benefits from the heavyweight model's broader vocabulary + variety. Constants were renamed to be role-named instead of model-named: `LLAMA_EMOTION_MODEL` → `EMOTION_TAG_MODEL` and `SOLAR_POLISH_MODEL` → `MICRO_REFINEMENT_MODEL` (so future swaps can change the model id without making the constant name a lie). All call sites and log lines were updated; the system prompt constant `SOLAR_POLISH_SYSTEM_PROMPT` was left as-is to minimize churn.
- **Prompt rewrite** (`SOLAR_POLISH_SYSTEM_PROMPT`): explicit "MICRO-REFINEMENT ENGINE — STRICT PRESERVATION MODE". The model is told it is NOT a rewriter, NOT a translator, and NOT allowed to improve creatively. It may ONLY fix broken grammar, remove duplicated words, and patch malformed sentences. Slang particles (oya, gba, mi, dem, naija, fi, weh, yuh, dey, sabi, abi, no be, etc.) are listed as preservation-required.
- **Stage 4 gate** — `needsMicroRefinement(draft)` runs before any model call. It scans every line for mechanical issues only: duplicated adjacent words (`"the the"`), doubled punctuation runs (`",,"`, `".."`, `"?!?!"`), dangling/stray punctuation, whitespace-only or single-character lines, unbalanced parens/quotes. **If no issues are detected, Stage 4 is SKIPPED entirely** and the raw Qwen output ships untouched. The detected issue list is forwarded to the model so it knows exactly which lines to touch.
- **Strict acceptance gate** — if the model returns a refined draft, three independent checks must pass before it overlays the original:
  1. Identical line counts per section (existing `sectionsMatch`).
  2. **Dialect/slang preservation** — `countDialectMarkers` counts Pan-African + Caribbean dialect tokens across the whole draft using `STAGE4_DIALECT_LEXICON`; the refined draft is rejected if the count drops below the original.
  3. **Hit score not regressed** — `computeHitScore` must not drop by more than 2 points.
  
  If any check fails, the original Qwen draft is kept verbatim. `keeperLine`, `title`, and `lyricsIntelligenceCore` are always preserved on our side regardless of what the model returns.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

- `pnpm --filter @workspace/scripts run create-admin` — interactively create or promote a user to the admin role

## AfroMuse V3+ Architecture (Monetization & Access Control)

### 3-Tier Plan System
- **Free** — 10 song generations total, basic lyric gen, 3 audio trials
- **Creator Pro** ($20/mo) — Unlimited generations, full lyric controls, full rewrite stack (Humanize/Catchier/Harder), Audio Studio V2, exports, unlimited saves
- **Artist Pro** ($40/mo) — Everything in Creator Pro + Artist DNA engine, voice clone placeholder, persistent memory

### DB Schema (V3 additions to `lib/db/src/schema/users.ts`)
- `planExpiry` — datetime, when the paid plan expires
- `artistDna` — jsonb, persisted Artist DNA style profile
- `voiceCloneData` — jsonb, voice clone metadata placeholder
- `usageStats` — jsonb, per-user usage counters

### DB Schema (new `lib/db/src/schema/usageLogs.ts`)
- `usageLogsTable` — tracks feature-level usage events for analytics

### Backend Access Layer (`artifacts/api-server/src/access/`)
- `types.ts` — `ServerPlanId`, `FeatureKey` union types
- `plans.ts` — PLANS config map, `getPlan()`, `resolveServerPlan()` (bridges legacy "Pro"/"Gold" to new IDs)
- `featureGate.ts` — `checkFeatureAccess()`, `getFeatureGateLabel()`
- `middleware.ts` — `requireAuth`, `attachPlanFromDb`, `requireFeature(key)` middleware chain

### Backend Routes (V3 additions)
- `routes/artist-dna.ts` — `GET/POST /api/artist-dna` (Artist Pro gated)
- `routes/voice-clone.ts` — `POST /api/voice-clone/sing` (Personal Voice Clone Singing Engine — active), `GET /api/voice-clone/job/:jobId` (job polling), `GET /api/voice-clone/status`
- `routes/stripe.ts` — `POST /api/stripe/create-checkout-session`, `POST /api/stripe/webhook`; gracefully returns 503 if `STRIPE_SECRET_KEY` not set
- `routes/usage.ts` — `GET /api/usage/stats`
- `routes/generate-song.ts` — `/rewrite-lyrics`, `/harden-lyrics`, `/catchier-lyrics` now gated with Creator Pro middleware

### Frontend Access Layer (`artifacts/afromuse-ai/src/`)
- `lib/access/types.ts` — `PlanId`, `FeatureKey` types
- `lib/access/plans.ts` — `PLANS`, `resolveServerPlan()`, `getPlan()`
- `context/PlanContext.tsx` — `Plan` = `"Free" | "Creator Pro" | "Artist Pro"`, `PLAN_LIMITS`, `PLAN_COLORS`, `FEATURES`, `usePlan()`

### Frontend UI (V3 additions)
- `components/ui/SubscriptionModal.tsx` — Stripe checkout flow modal with monthly/yearly toggle
- `components/ui/UpgradeModal.tsx` — 3-tier upgrade prompt
- `pages/Pricing.tsx` + `components/sections/Pricing.tsx` — Updated with Creator Pro/Artist Pro cards
- `pages/Studio.tsx` — Advanced Songwriting controls gated (Creator Pro), rewrite buttons gated (Creator Pro), Artist DNA panel added (Artist Pro only)
- `components/layout/Navbar.tsx` — Plan badge with Crown/Zap icons for Artist Pro/Creator Pro

### Stripe Integration Notes
- Add `STRIPE_SECRET_KEY` env var to enable payments
- Add `STRIPE_WEBHOOK_SECRET` env var to verify webhooks
- `app.ts` applies `express.raw()` before JSON middleware for `/api/stripe/webhook`
- `build.mjs` externalizes `stripe` so runtime `require("stripe")` works without bundling

## Live Engine Control Layer (V2 Operations Upgrade)

Second architectural upgrade adding full operational control before real audio API integration. Zero UI changes. Zero breaking changes to existing engine, routes, or providers.

### New Files

**`artifacts/api-server/src/engine/engineConfig.ts`**
Per-environment engine mode configuration. Defines `EngineMode` ("mock" | "live" | "disabled") and `EngineEnvironment` ("development" | "staging" | "production"). Each environment (dev/staging/prod) has independent mode defaults and `fallbackToMock` flags per provider. Supports runtime overrides via `setProviderModeOverride(category, mode)` / `clearProviderModeOverride(category)`. Key exports: `getActiveEngineConfig()`, `getProviderModeConfig(category)`, `getProviderModeOverride(category)`.

**`artifacts/api-server/src/engine/providerCredentials.ts`**
Credential slot registry for future live provider API keys. Each provider (instrumental, vocal, mastering, stems) has a `ProviderCredentialSlot` with `apiKey`, `endpoint`, `model`, `region`, `timeoutMs` — all sourced from env vars (e.g. `INSTRUMENTAL_API_KEY`, `INSTRUMENTAL_API_ENDPOINT`). All null by default — safe to deploy now. Key exports: `getProviderCredentials(category)`, `isCredentialReady(category)`, `getCredentialSummary(category)` (no secret values).

**`artifacts/api-server/src/engine/providerResolver.ts`**
Single decision point for "what mode should this provider run in?" Resolution priority: (1) caller-specified override → (2) runtime override → (3) env-config default → (4) registry forced-disabled. Safety guard prevents live mode from running in development unless `allowLiveInDev` is explicitly set. Returns `ResolvedProviderMode` with `resolvedMode`, `source`, `isLiveCapable`, `credentialsReady`, `canRun`, `disabledReason`. Key exports: `resolveProviderMode(category, requestedMode?)`, `resolveAllProviders()`.

**`artifacts/api-server/src/engine/fallback.ts`**
Structured fallback behavior for live provider failures. Supports two strategies per provider: "fall back to mock" (reads `fallbackToMock` from env config) or "fail cleanly" (structured `NormalizedResponse` with error). Never silently swallows failures. Key exports: `buildFailureResponse(jobId, category, reason, message)`, `executeFallback(jobId, category, error, mockRunner)`.

**`artifacts/api-server/src/engine/diagnostics.ts`**
Complete engine state snapshot for admin/debug inspection. Reports: current environment, resolved modes and their sources, registry statuses, credential slot readiness (no secret values), capability profiles, fallback config, overall engine mode classification ("all-mock" | "partial-live" | "all-live" | "all-disabled"), safety settings. Key exports: `getEngineDiagnostics()` → `EngineDiagnostics`.

### Updated Files

**`artifacts/api-server/src/engine/types.ts`**
Added `EngineMode` type ("mock" | "live" | "disabled") alongside existing `ProviderStatus`.

**`artifacts/api-server/src/routes/generate-audio.ts`**
Added `GET /engine/diagnostics` endpoint that returns a full `EngineDiagnostics` snapshot. Internal/admin use only — gate with auth middleware before exposing publicly in production.

### Live Provider Activation Checklist (per category)
1. Set registry `status → "live-ready"`, `isLive → true` in `providers/registry.ts`
2. Set environment config `mode → "live"` in `engineConfig.ts`
3. Configure credential env vars (`<CATEGORY>_API_KEY`, `<CATEGORY>_API_ENDPOINT`, etc.)
4. Implement the live `run()` logic inside the provider module
5. The resolver automatically enables it — routes and UI untouched

### Diagnostics Endpoint
`GET /api/engine/diagnostics` — returns full engine state. No auth required in development. Add auth middleware before exposing in production.

## Instrumental Live Provider Bridge (V2 First Live Provider Path)

Focused upgrade to the instrumental provider only. All other providers (vocal, mastering, stems) are untouched and remain fully mocked.

### What Changed

**`artifacts/api-server/src/engine/providers/instrumental.ts`** — Complete refactor. File structure:

1. **`InstrumentalPayload`** — unchanged public interface (routes still work as-is)
2. **`LiveInstrumentalProviderResponse`** — new shape for real provider responses, including: `previewUrl`, `wavUrl`, `externalJobId`, `generationTitle`, `sonicNotes`, `duration`, `coverArtUrl`, `waveformMeta`
3. **`buildBaseMetadata()`** — extracted helper (was inline in `run()`)
4. **`fetchAiSessionBrief()`** — unchanged AI brief logic, now called by both mock and live paths
5. **`runMock()`** — all previous mock logic, cleanly isolated
6. **`callLiveInstrumentalProvider()`** — isolated live request execution block. Reads credentials from `getProviderCredentials("instrumental")`. Contains the clearly marked DROP-IN ZONE where real API call logic goes. Throws a structured error until implemented (triggers fallback correctly)
7. **`runLive()`** — complete live execution path: calls provider → enriches with AI brief → maps into `RawInstrumentalResponse` → normalizes through adapter
8. **`run()`** — new dispatcher: calls `resolveProviderMode("instrumental")`, routes to mock/live/disabled, wires live failures through `executeFallback()`

### Live Drop-in Checklist (Instrumental)
1. Set `registry.ts` → `status: "live-ready"`, `isLive: true`
2. Set `engineConfig.ts` dev/staging/prod → `instrumental.mode: "live"`
3. Set env vars: `INSTRUMENTAL_API_KEY`, `INSTRUMENTAL_API_ENDPOINT`, `INSTRUMENTAL_MODEL`, `INSTRUMENTAL_TIMEOUT_MS`
4. Implement the body of `callLiveInstrumentalProvider()` — map provider response to `LiveInstrumentalProviderResponse`
5. Zero changes to routes, adapters, job store, or UI

### Fallback Behavior (Instrumental)
- In development/staging: `fallbackToMock: true` — live failure → mock run, annotated in notes
- In production: `fallbackToMock: false` — live failure → clean `NormalizedResponse` with structured error
- Disabled mode → immediate clean failure, no dispatch

## Engine Integration Readiness Layer (V2 Architecture Upgrade)

Six-component internal architecture upgrade hardening the engine before real audio API integration. No UI changes.

### New Files

**`artifacts/api-server/src/engine/capabilities.ts`**
Capability profiles for all four providers. Each profile declares 10 boolean flags:
`supportsInstrumental`, `supportsVocals`, `supportsBlueprint`, `supportsMastering`, `supportsStems`, `supportsPreviewOnly`, `supportsFullExport`, `supportsPolling`, `supportsRealtime`, `supportsCustomLyrics`.
Exports `getCapabilities(category)` and `listAllCapabilities()`.

**`artifacts/api-server/src/engine/translators.ts`**
Payload translation layer. Five functions translate the internal `AfroMuseSessionState` into each provider's specific request payload:
`toInstrumentalPayload`, `toVocalDemoPayload`, `toLeadVocalPayload`, `toMasteringPayload`, `toStemExtractionPayload`.
When a new real provider has a different request shape, only the relevant translator changes.

**`artifacts/api-server/src/engine/adapters.ts`**
Response adapter layer. Four raw provider response types (`RawInstrumentalResponse`, `RawVocalResponse`, `RawMasteringResponse`, `RawStemExtractionResponse`) with adapter functions that normalize them to `NormalizedResponse`.
All four mock providers now build a raw response and pass it through the adapter — proving the architecture end-to-end with current mock data.

**`artifacts/api-server/src/engine/compatibility.ts`**
Feature/mode compatibility checks called before dispatching jobs:
`canProviderHandleBuildMode`, `canProviderHandleMasteredExport`, `canProviderHandleCustomLyrics`, `canProviderHandleStems`, `canProviderHandleRealtime`, `canProviderHandlePolling`, `checkCapability` (generic).

### Updated Files

**`artifacts/api-server/src/engine/types.ts`**
Added `ProviderStatus` ("mock" | "live-ready" | "unavailable" | "disabled"), `ProviderCapabilities` interface, and `AfroMuseSessionState` (canonical session input to all translators).

**`artifacts/api-server/src/engine/providers/registry.ts`**
`ProviderConfig` now has `status: ProviderStatus` alongside `isLive`. `listProviders()` now includes the full capability profile per provider. Added `isProviderActive(category)` helper.

**`artifacts/api-server/src/engine/providers/instrumental.ts` / `vocal.ts` / `mastering.ts` / `stems.ts`**
All four providers refactored: they build a `RawXxxResponse` and call `adaptXxx()` before returning. Live swap pattern is documented inline — replace the raw response block with a real API call.

**`artifacts/api-server/src/routes/generate-audio.ts`**
Compatibility checks wired into dispatch routes: `canProviderHandleCustomLyrics` before lead-vocal, `canProviderHandleMasteredExport` before mix-master, `canProviderHandleStems` before extract-stems. `GET /engine/providers` now returns capability profiles and `engineMode` field.

### Live Swap Pattern
When a real API is ready for any provider:
1. Call the real API with the translated payload (from `translators.ts`).
2. Map its response to the relevant `RawXxxResponse` type.
3. Pass it to the adapter (`adaptXxx()`).
4. Set `status: "live-ready"` and `isLive: true` in `registry.ts`.
5. Update capability profile in `capabilities.ts` if the real API has different capabilities.
Changes are isolated to the relevant provider module + its translator — routes and UI are untouched.

## Project Library / Saved Sessions (V2 Upgrade)

Local-first session persistence layer added to the Studio page. Architecture is designed to be swapped for a real backend later without touching the UI layer.

### New Files

- **`artifacts/afromuse-ai/src/lib/projectLibrary.ts`** — `SavedSession` model, localStorage persistence (up to 50 sessions), status intelligence (`Draft → In Progress → Instrumental Ready → Vocal Ready → Export Ready`), CRUD helpers (`saveSession`, `deleteSessionById`, `duplicateSessionById`, `updateSessionOutputRegistry`).
- **`artifacts/afromuse-ai/src/context/ProjectLibraryContext.tsx`** — React context provider (`ProjectLibraryProvider`) with `saveCurrentSession`, `deleteSession`, `duplicateSession`, and `refresh`. Also exports `extractResumeState` helper.
- **`artifacts/afromuse-ai/src/components/studio/ProjectLibraryPanel.tsx`** — Compact collapsible "Project Library" sidebar panel showing saved sessions with status badges, last-updated timestamps, and Resume / Duplicate / Delete actions.

### Integration Points

- **`artifacts/afromuse-ai/src/App.tsx`** — `ProjectLibraryProvider` wraps the Studio route.
- **`artifacts/afromuse-ai/src/pages/Studio.tsx`** — Uses `useProjectLibrary` to save sessions, and `handleResume` to restore all form state + draft from a saved session. "Save to Projects" button now saves locally without requiring login.

### Session Fields

`sessionId`, `sessionTitle`, `topic`, `genre`, `mood`, `songLength`, `lyricsSource`, `lyricsText`, `languageFlavor`, `customFlavor`, `style`, `notes`, `commercialMode`, `lyricalDepth`, `hookRepeat`, `genderVoiceModel`, `performanceFeel`, `bpm`, `key`, `energy`, `atmosphere`, `leadVoice`, `mixFeel`, `buildMode`, `currentStage`, `exportStatus`, `draft`, `outputRegistry`, `createdAt`, `updatedAt`.

## Lyrics-Aware Beat Shaping System

Deep lyrical analysis layer that intelligently shapes instrumental direction from song content — making the Audio Studio feel like it builds a beat around the song, not beside it.

**`deriveLyricsSignal(lyrics: string): LyricsSignal`** — the core analysis function that derives:
- `tone` — existing LyricsTone keyword scan (spiritual / intimate / street / party / defiant / neutral)
- `energyLevel` — high/medium/low from energy word lists + exclamations + ALL CAPS
- `hookPotential` — high/medium/low from line repetition and short-line ratio  
- `pacingFeel` — slow/medium/fast from average words-per-line
- `intimacyScale` — intimate or performance (derived from tone)
- `writingLead` — storytelling or vibe (narrative word density + uniqueness ratio)
- `beatShapingHints` — array of actionable beat direction strings derived from all signals
- `diagnosticSummary` — compact one-line internal diagnostic string

**Wired into the intelligence pipeline:**
- `buildFullIntelligence` computes `lyricsSignal` first, uses it for `lyricsTone`, and passes it through all builders
- `buildArrangementStyle` now receives `lyricsTone` (previously missing — arrangement hints were never applied)
- `buildProducerNotes` uses top 3 `beatShapingHints` for lyrics-aware beat shaping (replaces simple tone note)
- `buildStudioExportNotes` surfaces lyrics intelligence, beat shaping derived hints, hook direction, and arrangement signal in the Session Notes block
- `FullIntelligence` includes `lyricsSignal` for diagnostic access

**UI microcopy:** "· lyrics-aware" badge appears in the lyrics section header when lyrics contain sufficient content (>30 chars)

**Works for:** Lyrics Studio generated lyrics AND user-pasted custom lyrics — both flow through `audioLyrics` state and into `buildFullIntelligence`

## Beat DNA Feature (V2 Completion)

A premium musical control layer inside the Audio Studio that makes AfroMuse producer-aware and beat-intentional.

**Four controls added to the Audio Studio UI:**
- **Bounce Style** — groove motion feel (Smooth Glide, Club Bounce, Street Bounce, Late Night Swing, Festival Lift, Slow Wine, Log Drum Drive)
- **Melody Density** — melodic layer weight (Minimal, Balanced, Rich, Lush, Cinematic)
- **Drum Character** — percussion texture feel (Clean, Punchy, Raw, Dusty, Percussive, Heavy Groove)
- **Hook Lift** — chorus/drop energy level (Subtle, Balanced, Big, Anthemic, Explosive)

**Intelligence integration:** All four Beat DNA values are passed into `buildFullIntelligence()` and flow through to `buildProducerNotes`, `buildHookFocus`, `buildBeatSummary`, `buildStudioExportNotes` — each one generating specific, meaningful language about groove, melody, drums, and hook payoff.

**Session persistence:** Beat DNA fields are saved to the project library (`SavedSession` + `SaveSessionParams`) and restored on resume via `AudioStudioV2Handle.getBeatDNAState()` / `setBeatDNAState()`. They survive session duplication (spread on clone in `duplicateSessionById`).

**Key files:** `lib/audioIntelligence.ts`, `components/studio/AudioStudioV2.tsx`, `lib/projectLibrary.ts`, `context/ProjectLibraryContext.tsx`, `pages/Studio.tsx`

## Lead Vocal Generation Feature

Added `POST /api/generate-lead-vocals` endpoint in `artifacts/api-server/src/routes/generate-audio.ts`.

**Inputs**: `lyrics`, `instrumentalUrl`, `gender`, `performanceFeel`, `vocalStyle`, `emotionalTone`, `buildMode`, `genre`, `bpm`, `key`

**Backend flow**:
- Creates an in-memory job (type `"lead-vocal"`) and returns a `jobId` immediately
- Calls NVIDIA AI (`qwen/qwen3.5-122b-a10b`) to generate a detailed `LeadVocalSessionData` brief
- Poll progress via `GET /api/audio-job/:jobId` — returns `leadVocalSessionData` when complete
- Gracefully skips AI brief if `NVIDIA_API_KEY` is not set

**LeadVocalSessionData fields**: `vocalBrief`, `phrasingGuide`, `emotionalArc`, `syncNotes`, `performanceDirection`, `deliveryStyle`, `vocalProcessingNotes`

**Frontend** (`artifacts/afromuse-ai/src/components/studio/AudioStudioV2.tsx`):
- Lead Vocal Identity section (Section 3) now includes: Emotional Tone picker, Instrumental Track URL input, Session Build Mode toggle (Full / Vocal Demo), and "Generate Lead Vocals" button
- Result renders as a full-width panel below the main 3-card grid with colour-coded sub-sections for each brief field
- "Copy Full Brief" button copies all 7 fields to clipboard

**Requires**: `NVIDIA_API_KEY` environment secret for AI brief generation.

## Personal Voice Clone Singing Engine

Full AI singing engine where the user's own 30-second voice recording is the sole reference. No artist imitation. 

**Parameters** (from user spec):
- **Performance Feel**: Smooth / Melodic / Gritty / Emotional / Soulful / Intimate / Confident / Airy / Prayerful / Street
- **Dialect Depth**: Light / Medium / Deep
- **Voice Texture**: Warm / Bright / Breathier / Raspy / Powerful
- **Hitmaker Mode**: On / Off — enhances energy, timing, phrasing without altering voice identity

**Backend** (`artifacts/api-server/src/`):
- `engine/providers/vocal.ts` — `VoiceClonePayload` interface + `runVoiceCloneSing()` function with dedicated NVIDIA AI prompt
- `routes/voice-clone.ts` — `POST /api/voice-clone/sing` (multipart-free — base64 JSON), `GET /api/voice-clone/job/:jobId`, `GET /api/voice-clone/status`
- `engine/types.ts` — `SessionBlueprintData` extended with `singingBrief`, `voiceAnalysis`, `singingDirection`, `performanceNotes`, `stemConfig`, `voiceCloneProcessingChain`, `voiceCloneMetadata`; `AudioJobType` extended with `"voice-clone-sing"`

**Frontend** (`AudioStudioV2.tsx`):
- `VoiceCloneData` interface
- Voice recorder (MediaRecorder API, webm/opus, 30s max) with waveform animation, countdown progress bar, playback, discard/redo
- "Personal Voice Clone" sub-section inside Voice Engine expander panel with: recorder, Performance Feel selector (10 options), Hitmaker Mode toggle, "Generate My Singing Demo" CTA button (visible only when recording captured)
- Voice Clone Singing Demo result card: Singing Directive, Voice Analysis, Singing Direction, Performance Notes, Processing Chain, Stem Configuration, Ad-lib Suggestions, vocal demo stem slot (with "Export Stem" button that notifies when synthesis API not yet connected), Copy Directive button
- Recording stored as `Blob`, converted to base64 on submit, sent as JSON to `/api/voice-clone/sing`

**Synthesis API slot**: Audio URL slots remain `null` until a real voice synthesis provider (e.g. ElevenLabs Voice Clone API) is connected.

## Authentication System

Real server-side authentication using JWT cookies.

- **Users table**: `lib/db/src/schema/users.ts` — stores name, email, bcrypt password hash, role (`user` | `admin`)
- **Auth routes** (`/api/auth/*`):
  - `POST /api/auth/register` — create account, returns user + sets httpOnly JWT cookie
  - `POST /api/auth/login` — verify credentials, returns user + sets httpOnly JWT cookie
  - `POST /api/auth/logout` — clears the auth cookie
  - `GET /api/auth/me` — returns current user from cookie (used on app load to restore session)
- **JWT**: signed with `SESSION_SECRET` env var, 7-day expiry, stored in httpOnly cookie
- **Password hashing**: bcryptjs, 12 rounds
- **Frontend AuthContext** (`artifacts/afromuse-ai/src/context/AuthContext.tsx`):
  - Calls `/api/auth/me` on mount to restore session
  - `login()` and `signup()` are async, return `{success, error?}`
  - `user` object includes `role` field
- **Route guards**:
  - `ProtectedRoute` — redirects to `/auth` if not logged in
  - `AdminRoute` — redirects to `/` if not admin (role !== 'admin')
- **Admin visibility**: Admin link and panel only shown when `user.role === 'admin'`
- **Create admin**: Run `pnpm --filter @workspace/scripts run create-admin` in Shell tab

## AfroMuse V2 Final Polish Pass (Completed)

The V2 Studio has gone through a final completion pass. Key fixes applied:

- **`AudioStudioV2.tsx`**: "Blueprint Locked" status label → "Blueprint Ready"; removed dead-end "WAV Preparing" button in instrumental preview footer; changed per-stem "WAV Preparing" buttons to static non-interactive "WAV · Coming Soon" badges; removed dead-end "Export Session" button from session export bar; FinalExportCard export toasts are now honest (directing users to MP3 player or noting coming Pro features); ProToolsSection "Prepare My Session" button removed; "See What's Coming" is now a real `/pricing` link; Studio Export Notes section gets `id="studio-export-notes"` anchor for scroll-to navigation; FinalExportCard footer copy updated to be accurate.
- **`SendToAudioCard.tsx`**: Removed duplicate "Instrumental Only" quick mode (was identical to the primary "Instrumental Quick Setup" button) — replaced with "Full Session" (default mode) so all three quick-mode grid items are distinct.
- **`BringToLifeCard.tsx`**: `downloadProductionNotes` now handles V2 drafts that don't have V1 fields (`chordVibe`, `melodyDirection`, `arrangement`) by using optional spread — falls back to just writing the hook if available. No more undefined values in exported notes.

These changes align with the V2 completion spec: no fake future UX, honest available-now vs coming-soon states, and a coherent premium studio feel.
