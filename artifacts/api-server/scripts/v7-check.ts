// Standalone sanity check for the V7 Hit Scoring System and prompt blocks.
// Run with: pnpm --filter @workspace/api-server exec tsx scripts/v7-check.ts
//
// This is intentionally a one-shot script (not a test framework) — the project
// doesn't currently use vitest/jest, so a runnable check script is the cheapest
// way to verify the math and the block builders without firing live LLM calls.

import {
  computeHitScore,
  buildUserCreativeDirectionBlock,
  buildUserCreativeDirectionReminder,
  getMelodyDirectionBlock,
  getVoiceStyleSimulationBlock,
} from "../src/routes/generate-song";

const goodDraft = {
  title: "Run To You",
  keeperLine: "Na you my mind dey run to",
  intro: ["Yeah yeah (oh oh)", "Make I tell you tonight"],
  verse1: [
    "Wahala plenty for road, but I dey hold on",
    "Na you carry the light when the sun done gone",
    "Every time I close my eyes you dey for my mind (you know)",
    "Baby say you go stay with me till morning shine",
    "I no fit lie, my heart dey beat like drum",
    "Whenever I see your face I forget where I from",
    "Pidgin sweet for mouth, your name na the sweetest",
    "If love na battle then na you my deepest",
  ],
  hook: [
    "Na you my mind dey run to",
    "Na you my heart dey sing to",
    "Na you my body bring to (oh)",
    "Na you my mind dey run to",
  ],
  verse2: [
    "Lagos to Accra dem dey call your name",
    "Even when the rain fall, you still my flame",
    "Promise wey I make I no go ever break",
    "Stay with me forever, na you I take",
    "When the night dey cold I dey feel your fire",
    "Every step we take na you my desire",
    "No matter how far, I go always find you",
    "Heart of mine na yours, I no go leave you",
  ],
  bridge: [
    "When the world go quiet (so quiet)",
    "And the music fade slow",
    "Just hold me close, baby",
    "Let our story flow",
  ],
  outro: ["Na you my mind dey run to", "Forever and always (oh)"],
};

const weakDraft = {
  title: "Untitled",
  intro: ["Yeah", "Yeah"],
  verse1: [
    "Baby girl in the club tonight the night is young we turn it up",
    "Up all night love is in the air let the music play one of a kind",
    "Like no other till the morning we together baby girl tonight",
    "In the club the night is young turn it up let the music play forever",
  ],
  hook: [
    "Tonight tonight tonight tonight tonight tonight tonight",
    "Tonight tonight tonight tonight tonight tonight tonight",
  ],
  verse2: [],
  bridge: [],
  outro: ["The end", "The end"],
};

let failed = 0;
function expect(label: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

console.log("─── HIT SCORE: GOOD DRAFT ───");
const good = computeHitScore(goodDraft as any);
console.log(JSON.stringify(good, null, 2));
expect("good.overall >= 60", good.overall >= 60, `got ${good.overall}`);
expect("good.hookStrength >= 70", good.hookStrength >= 70, `got ${good.hookStrength}`);
expect("good.flowQuality >= 60", good.flowQuality >= 60, `got ${good.flowQuality}`);

console.log("\n─── HIT SCORE: WEAK DRAFT ───");
const weak = computeHitScore(weakDraft as any);
console.log(JSON.stringify(weak, null, 2));
expect("weak.overall < good.overall", weak.overall < good.overall, `weak=${weak.overall} good=${good.overall}`);
expect("weak.originality penalized for cliches", weak.originality < good.originality, `weak=${weak.originality} good=${good.originality}`);
expect("weak.notes mentions cliche", weak.notes.some((n) => n.toLowerCase().includes("cliche")));

console.log("\n─── USER DIRECTION BLOCK (with notes) ───");
const block = buildUserCreativeDirectionBlock("Make it about leaving Lagos in the rain, name-drop Sandra");
console.log(block.join("\n"));
expect("block contains the user's words", block.join("\n").includes("Sandra"));
expect("block contains PRIORITY DIRECTIVE", block.join("\n").includes("PRIORITY DIRECTIVE"));

console.log("\n─── USER DIRECTION BLOCK (empty input) ───");
const empty = buildUserCreativeDirectionBlock("");
expect("empty notes -> 0-length block", empty.length === 0, `got length ${empty.length}`);
const reminderEmpty = buildUserCreativeDirectionReminder("");
expect("empty notes -> 0-length reminder", reminderEmpty.length === 0);

console.log("\n─── MELODY DIRECTION (Afrobeats / Uplifting / Smooth) ───");
const mel = getMelodyDirectionBlock("Afrobeats", "Uplifting", "Smooth");
console.log(mel.slice(0, 14).join("\n"));
expect("Afrobeats signature appears", mel.some((l) => l.includes("Afrobeats")));
expect("hook contour mentioned", mel.some((l) => l.toLowerCase().includes("hook")));

console.log("\n─── MELODY DIRECTION (Trap / Aggressive / Hard) ───");
const melTrap = getMelodyDirectionBlock("Trap", "Aggressive", "Hard");
expect("trap signature appears", melTrap.some((l) => l.includes("Trap")));

console.log("\n─── VOICE PERSONA (Romantic / Smooth / Female / R&B) ───");
const voice = getVoiceStyleSimulationBlock("Romantic", "Smooth", "Female", "R&B");
console.log(voice.slice(0, 12).join("\n"));
expect("seductive persona resolved", voice.some((l) => l.includes("Smooth-Seductive")));
expect("female pronoun applied", voice.some((l) => l.toLowerCase().includes("she/her")));

console.log("\n─── VOICE PERSONA (Aggressive / Hard / Male / Trap) ───");
const voiceStreet = getVoiceStyleSimulationBlock("Aggressive", "Hard", "Male", "Trap");
expect("street-raw persona resolved", voiceStreet.some((l) => l.includes("Street-Raw")));
expect("male pronoun applied", voiceStreet.some((l) => l.toLowerCase().includes("he/him")));

console.log("\n─── VOICE PERSONA (Reflective / Smooth / Random / Gospel) ───");
const voiceGospel = getVoiceStyleSimulationBlock("Reflective", "Smooth", "Random", "Gospel");
expect("spiritual-reflective persona resolved", voiceGospel.some((l) => l.includes("Spiritual-Reflective")));

console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`}`);
process.exit(failed === 0 ? 0 : 1);
