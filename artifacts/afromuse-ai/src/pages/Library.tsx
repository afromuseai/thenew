/**
 * Library — user's generated track history
 *
 * Fetches tracks from GET /api/music/library and displays them grouped by
 * date (Today / Yesterday / This Week / Earlier) with play, download, and
 * pause controls.
 */

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music2, Play, Pause, Download, Loader2, Library as LibraryIcon,
  Clock, RefreshCw, Music, Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { getStoredToken } from "@/context/AuthContext";

interface GeneratedTrack {
  id: number;
  title: string;
  audioUrl: string;
  coverArt?: string | null;
  genre?: string | null;
  mood?: string | null;
  model?: string | null;
  style?: string | null;
  trackIndex: number;
  tags?: string | null;
  createdAt: string;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

type Bucket = "Today" | "Yesterday" | "This Week" | "Earlier";

function bucketFor(dateStr: string): Bucket {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ts = d.getTime();
  if (ts >= startOfToday) return "Today";
  if (ts >= startOfToday - 86_400_000) return "Yesterday";
  if (ts >= startOfToday - 6 * 86_400_000) return "This Week";
  return "Earlier";
}

// ─── Track card ───────────────────────────────────────────────────────────────

function TrackCard({
  track,
  isPlaying,
  onTogglePlay,
}: {
  track: GeneratedTrack;
  isPlaying: boolean;
  onTogglePlay: () => void;
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

  const tagPills = useMemo(() => {
    const pills: { label: string; tone: string }[] = [];
    if (track.genre) pills.push({ label: track.genre, tone: "bg-violet-500/10 text-violet-300 border-violet-500/20" });
    if (track.mood)  pills.push({ label: track.mood,  tone: "bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20" });
    if (track.model) pills.push({ label: track.model, tone: "bg-amber-500/10 text-amber-300 border-amber-500/20 font-mono" });
    return pills;
  }, [track.genre, track.mood, track.model]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group bg-white/[0.02] border rounded-2xl overflow-hidden transition-all ${
        isPlaying
          ? "border-violet-500/40 shadow-lg shadow-violet-900/20"
          : "border-white/[0.06] hover:border-white/15 hover:bg-white/[0.04]"
      }`}
    >
      <div className="p-4 flex items-center gap-4">
        {/* Cover art */}
        <div className="relative shrink-0">
          {track.coverArt ? (
            <img
              src={track.coverArt}
              alt={track.title}
              className="w-16 h-16 rounded-xl object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-900/60 via-fuchsia-900/40 to-amber-900/30 ring-1 ring-white/10 flex items-center justify-center">
              <Music2 className="w-7 h-7 text-violet-300/50" />
            </div>
          )}
          {isPlaying && (
            <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
              <div className="flex gap-0.5 items-end h-5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-1 bg-violet-300 rounded-full animate-pulse"
                    style={{ animationDelay: `${i * 0.12}s`, height: `${10 + (i % 2) * 6}px` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{track.title}</p>
          {tagPills.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {tagPills.map((p) => (
                <span
                  key={p.label}
                  className={`text-[10px] tracking-wide px-2 py-0.5 rounded-full border ${p.tone}`}
                >
                  {p.label}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1 mt-1.5">
            <Clock className="w-3 h-3 text-zinc-700" />
            <span className="text-[11px] text-zinc-500">{timeAgo(track.createdAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onTogglePlay}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
              isPlaying
                ? "bg-violet-500 hover:bg-violet-400 shadow-lg shadow-violet-900/40"
                : "bg-violet-600 hover:bg-violet-500 shadow-md shadow-violet-900/40"
            }`}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-white" />
            ) : (
              <Play className="w-4 h-4 text-white ml-0.5" />
            )}
          </button>
          <button
            onClick={handleDownload}
            className="w-11 h-11 rounded-full bg-white/[0.04] border border-white/8 hover:bg-white/[0.08] hover:border-white/15 flex items-center justify-center transition-all"
            title="Download MP3"
            aria-label="Download MP3"
          >
            <Download className="w-4 h-4 text-zinc-300" />
          </button>
        </div>
      </div>

      {/* Audio player (visible when playing) */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
              <audio
                src={track.audioUrl}
                autoPlay
                controls
                className="w-full rounded-lg"
                style={{ colorScheme: "dark" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [tracks, setTracks] = useState<GeneratedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchLibrary() {
    setError(null);
    const token = getStoredToken();
    try {
      const res = await fetch("/api/music/library", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load library");
      setTracks(json.tracks ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load library");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      fetchLibrary();
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [authLoading, user]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchLibrary();
  }

  // Group tracks by date bucket — tracks already arrive newest-first from API.
  const grouped = useMemo(() => {
    const buckets: Record<Bucket, GeneratedTrack[]> = {
      Today: [], Yesterday: [], "This Week": [], Earlier: [],
    };
    for (const t of tracks) buckets[bucketFor(t.createdAt)].push(t);
    return (Object.keys(buckets) as Bucket[])
      .filter((k) => buckets[k].length > 0)
      .map((k) => ({ label: k, items: buckets[k] }));
  }, [tracks]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-amber-500 flex items-center justify-center shadow-lg shadow-violet-900/40">
              <LibraryIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">My Library</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                {tracks.length === 0
                  ? "Your generated tracks will appear here"
                  : `${tracks.length} track${tracks.length !== 1 ? "s" : ""} generated`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing || isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-white/8 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link to="/studio">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-semibold transition-all shadow-md shadow-violet-900/40">
                <Sparkles className="w-4 h-4" />
                Generate
              </button>
            </Link>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            <p className="text-sm text-zinc-600">Loading your library…</p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="bg-red-950/30 border border-red-900/40 rounded-2xl px-5 py-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Not logged in */}
        {!isLoading && !user && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center mb-4">
              <LibraryIcon className="w-8 h-8 text-zinc-700" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Sign in to view your library</h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-xs">
              Your generated tracks are tied to your account.
            </p>
            <Link to="/login">
              <button className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all">
                Log in
              </button>
            </Link>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && user && tracks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-900/40 to-fuchsia-900/30 border border-white/8 flex items-center justify-center mb-5">
              <Music2 className="w-9 h-9 text-violet-400/60" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No tracks yet</h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-sm leading-relaxed">
              Head to the Studio and generate your first track — it will appear here automatically.
            </p>
            <Link to="/studio">
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-sm font-semibold transition-all shadow-md shadow-violet-900/40">
                <Music className="w-4 h-4" />
                Open Studio
              </button>
            </Link>
          </div>
        )}

        {/* Grouped track list */}
        {!isLoading && !error && tracks.length > 0 && (
          <div className="space-y-8">
            {grouped.map((group) => (
              <section key={group.label}>
                <div className="flex items-center gap-3 mb-3 px-1">
                  <h2 className="text-[11px] font-bold tracking-widest uppercase text-zinc-500">
                    {group.label}
                  </h2>
                  <div className="h-px flex-1 bg-white/[0.04]" />
                  <span className="text-[11px] text-zinc-600">{group.items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {group.items.map((track) => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      isPlaying={playingId === track.id}
                      onTogglePlay={() =>
                        setPlayingId(playingId === track.id ? null : track.id)
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
