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
  // Free-form creative direction the user typed in the Audio Studio
  // "Style / Direction" field at generation time. Nullable for older rows.
  style: text("style"),
  // Engine job id from the in-memory job store — used to make persistence
  // idempotent so the same generation isn't inserted twice on repeat polls.
  jobId: text("job_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type GeneratedTrack = typeof generatedTracksTable.$inferSelect;
