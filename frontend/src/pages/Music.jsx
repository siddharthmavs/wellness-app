import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore, useMusicStore } from "../store";
import {
  Play, Pause, Heart, Trash2, Upload, Search, Library,
  Music as MusicIcon, Clock, Sparkles, Loader2, X, Plus,
} from "lucide-react";

const fmt = (s) => {
  if (!s || isNaN(s)) return "--:--";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

const View = { HOME: "home", LIKED: "liked", RECENT: "recent", MINE: "mine" };

export default function Music() {
  const { user } = useAuthStore();
  const { queue, currentIndex, playing, setQueue, playAt, togglePlay, removeTrack: removeFromQueue } = useMusicStore();
  const [tracks, setTracks] = useState([]);
  const [liked, setLiked] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(View.HOME);
  const [q, setQ] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;

  const load = async () => {
    setLoading(true);
    try {
      const [t, l, r] = await Promise.all([
        api.get("/music/tracks"),
        api.get("/music/liked"),
        api.get("/music/history/me"),
      ]);
      setTracks(t.data);
      setLiked(l.data);
      setRecent(r.data);
    } catch (e) {
      toast.error("Could not load music library");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const list = useMemo(() => {
    let base = tracks;
    if (view === View.LIKED) base = liked;
    else if (view === View.RECENT) base = recent;
    else if (view === View.MINE) base = tracks.filter((t) => t.user_id === user?.id);
    if (!q.trim()) return base;
    const s = q.toLowerCase();
    return base.filter(
      (t) => t.title?.toLowerCase().includes(s) || t.artist?.toLowerCase().includes(s) || t.user_name?.toLowerCase().includes(s)
    );
  }, [tracks, liked, recent, view, q, user?.id]);

  const playList = (startIdx = 0, source = list) => {
    if (!source.length) return;
    setQueue(source, startIdx);
  };

  const onRowClick = (idx) => {
    const t = list[idx];
    if (currentTrack?.id === t.id) {
      togglePlay();
    } else {
      playList(idx, list);
    }
  };

  const toggleLike = async (id) => {
    try {
      const { data } = await api.post(`/music/like/${id}`);
      setTracks((cur) => cur.map((t) => (t.id === id ? { ...t, liked: data.liked } : t)));
      if (data.liked) {
        const t = tracks.find((x) => x.id === id);
        if (t) setLiked((cur) => [{ ...t, liked: true }, ...cur.filter((x) => x.id !== id)]);
      } else {
        setLiked((cur) => cur.filter((x) => x.id !== id));
      }
    } catch { toast.error("Could not update like"); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this track?")) return;
    try {
      await api.delete(`/music/tracks/${id}`);
      setTracks((cur) => cur.filter((t) => t.id !== id));
      setLiked((cur) => cur.filter((t) => t.id !== id));
      setRecent((cur) => cur.filter((t) => t.id !== id));
      removeFromQueue(id);
      toast.success("Track removed");
    } catch { toast.error("Delete failed"); }
  };

  const featured = tracks.slice(0, 6);

  return (
    <div
      data-testid="music-zone"
      className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6 pb-32"
    >
      {/* Spotify-styled surface — dark themed island */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #1f1f1f 0%, #121212 240px, #121212 100%)",
          color: "#fff",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex flex-col md:flex-row" style={{ minHeight: 620 }}>
          {/* Sidebar */}
          <aside
            className="md:w-60 md:min-w-60 flex-shrink-0 p-4 space-y-4"
            style={{ background: "#000", borderRight: "1px solid #232323" }}
          >
            <div className="flex items-center gap-2 text-white font-bold">
              <MusicIcon className="w-5 h-5" style={{ color: "#1DB954" }} />
              <span>Music Zone</span>
            </div>
            <nav className="space-y-1 text-sm" data-testid="music-sidebar">
              {[
                { id: View.HOME, label: "Home", icon: Sparkles },
                { id: View.LIKED, label: "Liked Songs", icon: Heart },
                { id: View.RECENT, label: "Recently Played", icon: Clock },
                { id: View.MINE, label: "Your Uploads", icon: Library },
              ].map((v) => (
                <button
                  key={v.id}
                  data-testid={`music-nav-${v.id}`}
                  onClick={() => setView(v.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition ${
                    view === v.id ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <v.icon className="w-4 h-4" />
                  {v.label}
                </button>
              ))}
            </nav>
            <button
              data-testid="open-upload-btn"
              onClick={() => setUploadOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-sm text-black hover:scale-[1.02] transition"
              style={{ background: "#1DB954" }}
            >
              <Upload className="w-4 h-4" /> Upload track
            </button>
            <div className="text-[11px] text-neutral-500 pt-4 border-t border-neutral-800">
              Max 50MB · MP3, WAV, OGG, M4A
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 min-w-0 p-4 md:p-6 overflow-hidden">
            {/* Top bar */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  data-testid="music-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search tracks, artists, uploaders…"
                  className="w-full pl-9 pr-3 py-2 rounded-full text-sm"
                  style={{
                    background: "#242424 !important",
                    color: "#fff !important",
                    border: "1px solid #333 !important",
                  }}
                />
              </div>
              <div className="hidden md:block text-sm text-neutral-400">
                Hi, <span className="text-white font-semibold">{user?.name?.split(" ")[0]}</span>
              </div>
            </div>

            {/* Hero */}
            {view === View.HOME && !q && (
              <div className="mb-6 rounded-xl p-5 md:p-7"
                style={{ background: "linear-gradient(135deg, #1DB954 0%, #0f6b32 100%)" }}
              >
                <div className="text-xs uppercase tracking-widest opacity-90 mb-1">Team playlist</div>
                <h1 className="text-3xl md:text-5xl font-black mb-2" style={{ color: "#fff" }}>All Team Tracks</h1>
                <p className="text-sm md:text-base opacity-90 mb-4">{tracks.length} track{tracks.length !== 1 && "s"} shared by your team</p>
                <button
                  data-testid="play-all-btn"
                  onClick={() => playList(0, tracks)}
                  disabled={!tracks.length}
                  className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full font-semibold hover:scale-105 transition disabled:opacity-40"
                >
                  <Play className="w-4 h-4 ml-0.5" /> Play all
                </button>
              </div>
            )}

            {/* Featured grid on Home */}
            {view === View.HOME && !q && featured.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold" style={{ color: "#fff" }}>Featured</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {featured.map((t, i) => {
                    const isCurrent = currentTrack?.id === t.id;
                    return (
                      <motion.button
                        key={t.id}
                        data-testid={`featured-${t.id}`}
                        whileHover={{ y: -3 }}
                        onClick={() => playList(i, featured)}
                        className="text-left rounded-lg p-3 transition group"
                        style={{ background: "#1a1a1a" }}
                      >
                        <div
                          className="aspect-square rounded-md mb-2 relative overflow-hidden flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg,
                              hsl(${(t.title?.charCodeAt(0) || 0) * 7 % 360}, 60%, 45%),
                              hsl(${(t.title?.charCodeAt(1) || 0) * 11 % 360}, 60%, 30%))`,
                          }}
                        >
                          <MusicIcon className="w-8 h-8 text-white/40" />
                          <div
                            className="absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xl"
                            style={{ background: "#1DB954" }}
                          >
                            {isCurrent && playing ? <Pause className="w-4 h-4 text-black" /> : <Play className="w-4 h-4 text-black ml-0.5" />}
                          </div>
                        </div>
                        <div className="text-sm font-semibold truncate" style={{ color: "#fff" }}>{t.title}</div>
                        <div className="text-xs text-neutral-400 truncate">{t.artist}</div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Track list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold" style={{ color: "#fff" }}>
                  {q ? `Results for "${q}"` : view === View.LIKED ? "Liked Songs" : view === View.RECENT ? "Recently Played" : view === View.MINE ? "Your Uploads" : "All Tracks"}
                </h2>
                <span className="text-xs text-neutral-500">{list.length} tracks</span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 text-neutral-400 gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading library…
                </div>
              ) : list.length === 0 ? (
                <EmptyState onUpload={() => setUploadOpen(true)} view={view} />
              ) : (
                <div className="rounded-lg overflow-hidden" style={{ background: "#151515" }}>
                  <div className="grid grid-cols-[40px_1fr_180px_80px_80px] md:grid-cols-[40px_1fr_180px_140px_80px_80px] items-center gap-3 px-3 py-2 text-[11px] uppercase tracking-widest text-neutral-500 border-b border-neutral-800">
                    <span>#</span>
                    <span>Title</span>
                    <span className="hidden md:block">Uploaded by</span>
                    <span>Duration</span>
                    <span></span>
                    <span></span>
                  </div>
                  <div data-testid="tracks-list">
                    {list.map((t, i) => {
                      const isCurrent = currentTrack?.id === t.id;
                      const isPlaying = isCurrent && playing;
                      return (
                        <div
                          key={t.id}
                          data-testid={`track-row-${t.id}`}
                          onClick={() => onRowClick(i)}
                          className={`grid grid-cols-[40px_1fr_180px_80px_80px] md:grid-cols-[40px_1fr_180px_140px_80px_80px] items-center gap-3 px-3 py-2 text-sm cursor-pointer transition group ${
                            isCurrent ? "bg-neutral-800/60" : "hover:bg-neutral-800/40"
                          }`}
                        >
                          <div className="text-neutral-400 text-sm flex items-center justify-center w-6">
                            {isPlaying ? (
                              <div className="flex items-end gap-0.5 h-4">
                                <span className="w-0.5 bg-[#1DB954] equalize" style={{ animationDelay: "0s" }} />
                                <span className="w-0.5 bg-[#1DB954] equalize" style={{ animationDelay: "0.15s" }} />
                                <span className="w-0.5 bg-[#1DB954] equalize" style={{ animationDelay: "0.3s" }} />
                              </div>
                            ) : (
                              <span className="group-hover:hidden">{i + 1}</span>
                            )}
                            {!isPlaying && (
                              <Play className="w-4 h-4 hidden group-hover:block text-white ml-0.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className={`font-semibold truncate ${isCurrent ? "text-[#1DB954]" : "text-white"}`}>{t.title}</div>
                            <div className="text-xs text-neutral-400 truncate">{t.artist}</div>
                          </div>
                          <div className="hidden md:block text-xs text-neutral-400 truncate">{t.user_name}</div>
                          <div className="text-xs text-neutral-400">{fmt(t.duration)}</div>
                          <div className="text-right">
                            <button
                              data-testid={`like-btn-${t.id}`}
                              onClick={(e) => { e.stopPropagation(); toggleLike(t.id); }}
                              className={`p-1.5 rounded-full transition ${t.liked ? "text-[#1DB954]" : "text-neutral-400 hover:text-white"}`}
                            >
                              <Heart className={`w-4 h-4 ${t.liked ? "fill-current" : ""}`} />
                            </button>
                          </div>
                          <div className="text-right">
                            {(t.user_id === user?.id || user?.role === "admin") && (
                              <button
                                data-testid={`delete-btn-${t.id}`}
                                onClick={(e) => { e.stopPropagation(); del(t.id); }}
                                className="p-1.5 rounded-full text-neutral-500 hover:text-red-400 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {uploadOpen && (
          <UploadModal
            onClose={() => setUploadOpen(false)}
            onUploaded={(newTrack) => {
              setTracks((cur) => [newTrack, ...cur]);
              setUploadOpen(false);
              toast.success(`"${newTrack.title}" uploaded`);
            }}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes equalize {
          0%, 100% { height: 4px; }
          50% { height: 14px; }
        }
        .equalize { display: inline-block; height: 4px; animation: equalize 0.8s ease-in-out infinite; border-radius: 1px; }
        /* Force dark inputs in this dark island — override the global cozy input styles */
        [data-testid="music-zone"] input[type="text"],
        [data-testid="music-zone"] input:not([type]),
        [data-testid="music-search"] {
          background-color: #242424 !important;
          color: #fff !important;
          border: 1px solid #333 !important;
        }
        [data-testid="music-zone"] input::placeholder { color: #888 !important; }
        [data-testid="music-zone"] input:focus {
          border-color: #1DB954 !important;
          box-shadow: 0 0 0 2px rgba(29,185,84,0.25) !important;
        }
      `}</style>
    </div>
  );
}

const EmptyState = ({ onUpload, view }) => (
  <div className="text-center py-14 rounded-lg" style={{ background: "#151515" }} data-testid="music-empty">
    <div className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-3" style={{ background: "#1DB95422" }}>
      <MusicIcon className="w-6 h-6" style={{ color: "#1DB954" }} />
    </div>
    <div className="text-white font-semibold mb-1">
      {view === View.LIKED ? "No liked songs yet" : view === View.RECENT ? "No recent plays" : view === View.MINE ? "You haven't uploaded yet" : "Your library is empty"}
    </div>
    <div className="text-sm text-neutral-400 mb-4">Upload your first MP3 to start the vibe.</div>
    <button
      data-testid="empty-upload-btn"
      onClick={onUpload}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-black hover:scale-105 transition"
      style={{ background: "#1DB954" }}
    >
      <Upload className="w-4 h-4" /> Upload a track
    </button>
  </div>
);

const UploadModal = ({ onClose, onUploaded }) => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const onFile = (f) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) {
      toast.error("File too large. Max 50 MB.");
      return;
    }
    if (!f.type.startsWith("audio/")) {
      toast.error("Please pick an audio file.");
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title || file.name);
      fd.append("artist", artist || "Unknown");
      const { data } = await api.post("/music/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
      onUploaded(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
      data-testid="upload-modal"
    >
      <motion.form
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{ background: "#181818", color: "#fff", border: "1px solid #2a2a2a" }}
      >
        <button
          type="button"
          onClick={onClose}
          data-testid="upload-close"
          className="absolute top-3 right-3 text-neutral-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold mb-1">Upload a track</h3>
        <p className="text-xs text-neutral-400 mb-4">MP3, WAV, OGG or M4A · up to 50MB</p>

        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            onFile(f);
          }}
          className="block rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition mb-4"
          style={{ borderColor: drag ? "#1DB954" : "#333", background: drag ? "#1DB95415" : "#0f0f0f" }}
          data-testid="upload-dropzone"
        >
          <input
            ref={inputRef}
            data-testid="upload-file-input"
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {file ? (
            <div className="text-sm">
              <MusicIcon className="w-6 h-6 mx-auto mb-2" style={{ color: "#1DB954" }} />
              <div className="font-semibold truncate">{file.name}</div>
              <div className="text-xs text-neutral-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          ) : (
            <div className="text-sm text-neutral-400">
              <Upload className="w-6 h-6 mx-auto mb-2 text-neutral-500" />
              Drag & drop your audio file here<br />
              <span className="text-neutral-500">or click to browse</span>
            </div>
          )}
        </label>

        <div className="space-y-2 mb-4">
          <input
            data-testid="upload-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Track title"
            className="w-full px-3 py-2 rounded-md text-sm"
            style={{ background: "#242424", color: "#fff", border: "1px solid #333" }}
          />
          <input
            data-testid="upload-artist"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist (optional)"
            className="w-full px-3 py-2 rounded-md text-sm"
            style={{ background: "#242424", color: "#fff", border: "1px solid #333" }}
          />
        </div>

        {busy && (
          <div className="mb-3">
            <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div style={{ width: `${progress}%`, background: "#1DB954" }} className="h-full transition-all" />
            </div>
            <div className="text-xs text-neutral-400 mt-1">Uploading… {progress}%</div>
          </div>
        )}

        <button
          data-testid="upload-submit"
          type="submit"
          disabled={!file || busy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-black transition disabled:opacity-50"
          style={{ background: "#1DB954" }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {busy ? "Uploading…" : "Add to library"}
        </button>

        <style>{`
          [data-testid="upload-modal"] input {
            background: #242424 !important;
            color: #fff !important;
            border: 1px solid #333 !important;
          }
          [data-testid="upload-modal"] input::placeholder { color: #888 !important; }
          [data-testid="upload-modal"] input:focus {
            border-color: #1DB954 !important;
            box-shadow: 0 0 0 2px rgba(29,185,84,0.25) !important;
          }
        `}</style>
      </motion.form>
    </motion.div>
  );
};
