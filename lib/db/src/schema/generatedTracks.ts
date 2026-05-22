import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const generatedTracksTable = pgTable("generated_tracks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  audioUrl: text("audio_url").notNull(),
  coverArt: text("cover_art"),
  genre: text("genre"),
  mood: text("mood"),
  model: text("model"),
  trackIndex: integer("track_index").notNull().default(0),
  tags: text("tags"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type GeneratedTrack = typeof generatedTracksTable.$inferSelect;
