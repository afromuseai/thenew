import { pgTable, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const userMusicMemory = pgTable("user_music_memory", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),

  // preference tracking
  topGenres: jsonb("top_genres").default([]),
  topMoods: jsonb("top_moods").default([]),

  beatDNA: jsonb("beat_dna").default({}),
  artistDNA: jsonb("artist_dna").default({}),

  preferredTrackType: text("preferred_track_type").default("A"),

  totalGenerations: integer("total_generations").default(0),

  lastUpdated: timestamp("last_updated").defaultNow(),
});