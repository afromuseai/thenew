// AfroMuse Memory System
// Stores user preferences, style evolution, and generation history

type UserMemory = {
  userId: string;
  genres: Record<string, number>;
  moods: Record<string, number>;
  bpmHistory: number[];
  artistDNA: Record<string, number>;
  beatDNA: Record<string, number>;
  lastPrompts: string[];
};

const memoryDB: Map<string, UserMemory> = new Map();

/**
 * Get or create user memory
 */
export function getMemory(userId: string): UserMemory {
  if (!memoryDB.has(userId)) {
    memoryDB.set(userId, {
      userId,
      genres: {},
      moods: {},
      bpmHistory: [],
      artistDNA: {},
      beatDNA: {},
      lastPrompts: [],
    });
  }
  return memoryDB.get(userId)!;
}

/**
 * Update memory after generation
 */
export function updateMemory(userId: string, data: any) {
  const mem = getMemory(userId);

  if (data.genre) {
    mem.genres[data.genre] = (mem.genres[data.genre] || 0) + 1;
  }

  if (data.mood) {
    mem.moods[data.mood] = (mem.moods[data.mood] || 0) + 1;
  }

  if (data.bpm) {
    mem.bpmHistory.push(Number(data.bpm));
    if (mem.bpmHistory.length > 20) mem.bpmHistory.shift();
  }

  if (data.prompt) {
    mem.lastPrompts.push(data.prompt);
    if (mem.lastPrompts.length > 10) mem.lastPrompts.shift();
  }

  memoryDB.set(userId, mem);
}

/**
 * Get user's dominant style
 */
export function getUserStyleProfile(userId: string) {
  const mem = getMemory(userId);

  const topGenre = Object.entries(mem.genres)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const topMood = Object.entries(mem.moods)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const avgBpm =
    mem.bpmHistory.length > 0
      ? mem.bpmHistory.reduce((a, b) => a + b, 0) / mem.bpmHistory.length
      : 110;

  return {
    topGenre,
    topMood,
    avgBpm: Math.round(avgBpm),
  };
}