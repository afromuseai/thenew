/**
 * Library — user's generated track history
 *
 * Fetches tracks from GET /api/music/library and displays them with
 * play, download, and delete controls.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music2, Play, Pause, Download, Loader2, Library,
  Clock, RefreshCw, Music,
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
  trackIndex: number;
  tags?: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function TrackRow({
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-all"
    >
      <div className="p-4 flex items-center gap-4">
        {/* Cover art */}
        <div className="relative shrink-0">
          {track.coverArt ? (
            <img
              src={track.coverArt}
              alt={track.title}
              className="w-14 h-14 rounded-xl object-cover ring-1 ring-white/10"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-900/60 to-fuchsia-900/60 ring-1 ring-white/10 flex items-center justify-center">
              <Music2 className="w-6 h-6 text-violet-400/60" />
            </div>
          )}
          {isPlaying && (
            <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
              <div className="flex gap-0.5 items-end h-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1 bg-violet-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s`, height: `${8 + i * 4}px` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{track.title}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {track.genre && (
              <span className="text-xs text-zinc-500">{track.genre}</span>
            )}
            {track.mood && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-zinc-500">{track.mood}</span>
              </>
            )}
            {track.model && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-xs text-zinc-600 font-mono">{track.model}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Clock className="w-3 h-3 text-zinc-700" />
            <span className="text-xs text-zinc-600">{timeAgo(track.createdAt)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onTogglePlay}
            className="w-10 h-10 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center transition-all shadow-md shadow-violet-900/40"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-white" />
            ) : (
              <Play className="w-4 h-4 text-white ml-0.5" />
            )}
          </button>
          <button
            onClick={handleDownload}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center transition-all"
            title="Download MP3"
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
            <div className="px-4 pb-4">
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
              <Library className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">My Library</h1>
              <p className="text-sm text-muted-foreground">Your generated tracks</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <Link to="/studio">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all shadow-md shadow-violet-900/40">
                <Music className="w-4 h-4" />
                Generate
              </button>
            </Link>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="bg-red-950/30 border border-red-900/40 rounded-2xl px-5 py-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && tracks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center mb-4">
              <Music2 className="w-8 h-8 text-zinc-700" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No tracks yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Generate your first track and it will appear here automatically.
            </p>
            <Link to="/studio">
              <button className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all shadow-md shadow-violet-900/40">
                Generate your first track
              </button>
            </Link>
          </div>
        )}

        {/* Track list */}
        {!isLoading && !error && tracks.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-600 mb-4">{tracks.length} track{tracks.length !== 1 ? "s" : ""} generated</p>
            {tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                isPlaying={playingId === track.id}
                onTogglePlay={() => setPlayingId(playingId === track.id ? null : track.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
