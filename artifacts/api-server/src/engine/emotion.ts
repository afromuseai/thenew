// AfroMuse Emotion Engine
// Converts mood input + memory into musical emotional direction

import { getUserStyleProfile } from "./memory";

export type EmotionProfile = {
  intensity: number;       // 0–1
  tension: number;         // 0–1
  warmth: number;          // 0–1
  energyCurve: string;     // "rising" | "stable" | "drop" | "wave"
  harmonicMood: string;    // descriptive music emotion
};

export function getEmotionProfile(
  userId: string,
  mood?: string
): EmotionProfile {
  const memory = getUserStyleProfile(userId);

  const baseMood = mood || memory.topMood || "chill";

  // Core emotional mapping (AfroMuse logic)
  const emotionMap: Record<string, EmotionProfile> = {
    chill: {
      intensity: 0.4,
      tension: 0.2,
      warmth: 0.7,
      energyCurve: "stable",
      harmonicMood: "smooth harmonic flow, soft percussion",
    },

    energetic: {
      intensity: 0.9,
      tension: 0.6,
      warmth: 0.5,
      energyCurve: "rising",
      harmonicMood: "driving rhythm, layered percussion, strong bass pulse",
    },

    sad: {
      intensity: 0.5,
      tension: 0.7,
      warmth: 0.3,
      energyCurve: "wave",
      harmonicMood: "minor key emotional depth, atmospheric pads",
    },

    romantic: {
      intensity: 0.6,
      tension: 0.4,
      warmth: 0.9,
      energyCurve: "wave",
      harmonicMood: "soft melodies, warm chords, gentle rhythm",
    },

    aggressive: {
      intensity: 1,
      tension: 0.9,
      warmth: 0.2,
      energyCurve: "drop",
      harmonicMood: "heavy drums, dark bass, sharp transients",
    },
  };

  return emotionMap[baseMood] || emotionMap.chill;
}