import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore, useMusicStore } from "../store";
import {
  Play, Pause, Heart, Trash2, Upload, Search, Library,
  Music as MusicIcon, Clock, Sparkles, Loader2, X, Plus,
  Link2, Youtube, ListMusic, GripVertical, Share2, Lock, Globe, Users,
  ChevronLeft, MoreHorizontal, Flame,
} from "lucide-react";

const fmt = (s) => {
  if (!s || isNaN(s)) return "--:--";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

const View = { HOME: "home", LIKED: "liked", RECENT: "recent", MINE: "mine", TRENDING: "trending" };

const Cover = ({ track, size = "md" }) => {
  const cls = size === "lg" ? "w-40 h-40" : size === "sm" ? "w-9 h-9" : "w-full aspect-square";
  if (track?.thumbnail_url) {
    return <img src={track.thumbnail_url} alt="" className={`${cls} rounded-md object-cover`} />;
  }
  const seed = ((track?.title || "?").charCodeAt(0) || 0) * 7 % 360;
  const seed2 = ((track?.title || "?").charCodeAt(1) || 5) * 11 % 360;
  return (
    <div
      className={`${cls} rounded-md flex items-center justify-center`}
      style={{ background: `linear-gradient(135deg, hsl(${seed},60%,45%), hsl(${seed2},60%,30%))` }}
    >
      <MusicIcon className="w-1/3 h-1/3 text-white/40" />
    </div>
  );
};

const SourceBadge = ({ source }) => {
  if (source === "youtube") return <Youtube className="w-3 h-3 text-red-500" />;
  if (source === "spotify") return <span className="w-2 h-2 rounded-full bg-[#1DB954] inline-block" />;
  return null;
};

export default function Music() {
  const { user } = useAuthStore();
  const { queue, currentIndex, playing, setQueue, togglePlay, removeTrack: removeFromQueue } = useMusicStore();
  const [tracks, setTracks] = useState([]);
  const [liked, setLiked] = useState([]);
  const [recent, setRecent] = useState([]);
  const [trending, setTrending] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylist, setActivePlaylist] = useState(null); // { ...pl, tracks: [] }
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(View.HOME);
  const [q, setQ] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createPlOpen, setCreatePlOpen] = useState(false);
  const [addToPlOpen, setAddToPlOpen] = useState(null); // track or null

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;

  const load = async () => {
    setLoading(true);
    try {
      const [t, l, r, tr, pls] = await Promise.all([
        api.get("/music/tracks"),
        api.get("/music/liked"),
        api.get("/music/history/me"),
        api.get("/music/trending"),
        api.get("/playlists"),
      ]);
      setTracks(t.data); setLiked(l.data); setRecent(r.data);
      setTrending(tr.data); setPlaylists(pls.data);
    } catch { toast.error("Could not load music library"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const list = useMemo(() => {
    let base = tracks;
    if (view === View.LIKED) base = liked;
    else if (view === View.RECENT) base = recent;
    else if (view === View.MINE) base = tracks.filter((t) => t.user_id === user?.id);
    else if (view === View.TRENDING) base = trending;
    if (!q.trim()) return base;
    const s = q.toLowerCase();
    return base.filter(
      (t) => t.title?.toLowerCase().includes(s) || t.artist?.toLowerCase().includes(s) || t.user_name?.toLowerCase().includes(s)
    );
  }, [tracks, liked, recent, trending, view, q, user?.id]);

  const playList = (startIdx = 0, source = list) => {
    if (!source.length) return;
    setQueue(source, startIdx);
  };
  const onRowClick = (idx, source = list) => {
    const t = source[idx];
    if (currentTrack?.id === t.id) togglePlay();
    else playList(idx, source);
  };

  const toggleLike = async (id) => {
    try {
      const { data } = await api.post(`/music/like/${id}`);
      const patch = (arr) => arr.map((t) => (t.id === id ? { ...t, liked: data.liked } : t));
      setTracks(patch); setTrending(patch); setRecent(patch);
      if (data.liked) {
        const t = tracks.find((x) => x.id === id) || trending.find((x) => x.id === id) || recent.find((x) => x.id === id);
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
      const rm = (arr) => arr.filter((t) => t.id !== id);
      setTracks(rm); setLiked(rm); setRecent(rm); setTrending(rm);
      removeFromQueue(id);
      if (activePlaylist) {
        setActivePlaylist((cur) => cur ? { ...cur, tracks: cur.tracks.filter((t) => t.id !== id) } : cur);
      }
      toast.success("Track removed");
    } catch { toast.error("Delete failed"); }
  };

  const openPlaylist = async (pid) => {
    try {
      const { data } = await api.get(`/playlists/${pid}`);
      setActivePlaylist(data);
    } catch { toast.error("Could not open playlist"); }
  };

  const removeFromPlaylist = async (trackId) => {
    if (!activePlaylist) return;
    try {
      await api.delete(`/playlists/${activePlaylist.id}/tracks/${trackId}`);
      setActivePlaylist((cur) => ({ ...cur, tracks: cur.tracks.filter((t) => t.id !== trackId), track_count: (cur.track_count || cur.tracks.length) - 1 }));
      setPlaylists((cur) => cur.map((p) => p.id === activePlaylist.id ? { ...p, track_count: (p.track_count || 0) - 1 } : p));
    } catch { toast.error("Could not remove"); }
  };

  const featured = tracks.slice(0, 6);

  return (
    <div data-testid="music-zone" className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6 pb-40">
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "linear-gradient(180deg, #1f1f1f 0%, #121212 240px, #121212 100%)", color: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}
      >
        <div className="flex flex-col md:flex-row" style={{ minHeight: 620 }}>
          {/* Sidebar */}
          <aside className="md:w-64 md:min-w-64 flex-shrink-0 p-4 space-y-3 md:overflow-y-auto md:max-h-[calc(100vh-200px)]" style={{ background: "#000", borderRight: "1px solid #232323" }}>
            <div className="flex items-center gap-2 text-white font-bold">
              <MusicIcon className="w-5 h-5" style={{ color: "#1DB954" }} />
              <span>Music Zone</span>
            </div>
            <nav className="space-y-1 text-sm" data-testid="music-sidebar">
              {[
                { id: View.HOME, label: "Home", icon: Sparkles },
                { id: View.TRENDING, label: "Trending this Week", icon: Flame },
                { id: View.LIKED, label: "Liked Songs", icon: Heart },
                { id: View.RECENT, label: "Recently Played", icon: Clock },
                { id: View.MINE, label: "Your Uploads", icon: Library },
              ].map((v) => (
                <button
                  key={v.id}
                  data-testid={`music-nav-${v.id}`}
                  onClick={() => { setView(v.id); setActivePlaylist(null); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition ${
                    view === v.id && !activePlaylist ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  <v.icon className="w-4 h-4" /> {v.label}
                </button>
              ))}
            </nav>

            <div className="pt-3 border-t border-neutral-800">
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Playlists</span>
                <button
                  data-testid="create-playlist-btn"
                  onClick={() => setCreatePlOpen(true)}
                  className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800"
                  title="Create playlist"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto" data-testid="playlists-list">
                {playlists.length === 0 && (
                  <div className="text-xs text-neutral-500 px-2 py-1">No playlists yet.</div>
                )}
                {playlists.map((p) => (
                  <button
                    key={p.id}
                    data-testid={`playlist-item-${p.id}`}
                    onClick={() => openPlaylist(p.id)}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition ${
                      activePlaylist?.id === p.id ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    <span className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center" style={{ background: p.cover_color || "#1DB954" }}>
                      <ListMusic className="w-3.5 h-3.5 text-black/70" />
                    </span>
                    <span className="truncate flex-1">{p.name}</span>
                    {p.visibility === "public" ? <Globe className="w-3 h-3 text-neutral-500" /> :
                     p.visibility === "shared" ? <Users className="w-3 h-3 text-neutral-500" /> :
                     <Lock className="w-3 h-3 text-neutral-500" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              data-testid="open-upload-btn"
              onClick={() => setUploadOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-sm text-black hover:scale-[1.02] transition mt-3"
              style={{ background: "#1DB954" }}
            >
              <Upload className="w-4 h-4" /> Add track
            </button>
            <div className="text-[10px] text-neutral-500 pt-2">MP3/WAV ≤50MB · YouTube · Spotify</div>
          </aside>

          {/* Main */}
          <main className="flex-1 min-w-0 p-4 md:p-6 overflow-hidden">
            {activePlaylist ? (
              <PlaylistDetail
                playlist={activePlaylist}
                currentTrack={currentTrack}
                playing={playing}
                onBack={() => setActivePlaylist(null)}
                onPlayAt={(idx) => onRowClick(idx, activePlaylist.tracks)}
                onToggleLike={toggleLike}
                onRemoveFromPlaylist={removeFromPlaylist}
                onAddToPlaylist={(t) => setAddToPlOpen(t)}
                onReordered={(newTracks) => setActivePlaylist((cur) => ({ ...cur, tracks: newTracks }))}
                onPlaylistUpdated={(patch) => {
                  setActivePlaylist((cur) => ({ ...cur, ...patch }));
                  setPlaylists((cur) => cur.map((p) => p.id === activePlaylist.id ? { ...p, ...patch } : p));
                }}
                onPlaylistDeleted={() => {
                  setPlaylists((cur) => cur.filter((p) => p.id !== activePlaylist.id));
                  setActivePlaylist(null);
                }}
                user={user}
              />
            ) : (
              <>
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
                    />
                  </div>
                  <div className="hidden md:block text-sm text-neutral-400">
                    Hi, <span className="text-white font-semibold">{user?.name?.split(" ")[0]}</span>
                  </div>
                </div>

                {view === View.HOME && !q && (
                  <>
                    <HeroBanner tracks={tracks} onPlayAll={() => playList(0, tracks)} />
                    {trending.length > 0 && (
                      <RowSection
                        title="Trending in your team this week"
                        icon={Flame}
                        items={trending}
                        onPlayItem={(i) => onRowClick(i, trending)}
                        currentTrack={currentTrack}
                        playing={playing}
                        testid="trending-row"
                      />
                    )}
                    {featured.length > 0 && (
                      <RowSection
                        title="Featured"
                        items={featured}
                        onPlayItem={(i) => onRowClick(i, featured)}
                        currentTrack={currentTrack}
                        playing={playing}
                        testid="featured-row"
                      />
                    )}
                  </>
                )}

                {/* Track list */}
                <TrackTable
                  title={q ? `Results for "${q}"` : view === View.LIKED ? "Liked Songs" : view === View.RECENT ? "Recently Played" : view === View.MINE ? "Your Uploads" : view === View.TRENDING ? "Trending this Week" : "All Tracks"}
                  tracks={list}
                  loading={loading}
                  currentTrack={currentTrack}
                  playing={playing}
                  onRowClick={(i) => onRowClick(i, list)}
                  onToggleLike={toggleLike}
                  onDelete={del}
                  onAddToPlaylist={(t) => setAddToPlOpen(t)}
                  user={user}
                  onEmptyUpload={() => setUploadOpen(true)}
                />
              </>
            )}
          </main>
        </div>
      </div>

      <AnimatePresence>
        {uploadOpen && (
          <AddTrackModal
            onClose={() => setUploadOpen(false)}
            onAdded={(newTrack) => { setTracks((cur) => [newTrack, ...cur]); setUploadOpen(false); toast.success(`"${newTrack.title}" added`); }}
          />
        )}
        {createPlOpen && (
          <CreatePlaylistModal
            onClose={() => setCreatePlOpen(false)}
            onCreated={(pl) => { setPlaylists((cur) => [{ ...pl, track_count: 0, can_edit: true }, ...cur]); setCreatePlOpen(false); toast.success(`Playlist "${pl.name}" created`); }}
          />
        )}
        {addToPlOpen && (
          <AddToPlaylistModal
            track={addToPlOpen}
            playlists={playlists.filter((p) => p.can_edit)}
            onClose={() => setAddToPlOpen(null)}
            onAdded={(playlistName) => { setAddToPlOpen(null); toast.success(`Added to "${playlistName}"`); load(); }}
            onCreateFirst={() => { setAddToPlOpen(null); setCreatePlOpen(true); }}
          />
        )}
      </AnimatePresence>

      <style>{`
        @keyframes equalize { 0%, 100% { height: 4px; } 50% { height: 14px; } }
        .equalize { display: inline-block; height: 4px; animation: equalize 0.8s ease-in-out infinite; border-radius: 1px; }
        [data-testid="music-zone"] input, [data-testid="music-zone"] textarea {
          background-color: #242424 !important; color: #fff !important; border: 1px solid #333 !important;
        }
        [data-testid="music-zone"] input::placeholder, [data-testid="music-zone"] textarea::placeholder { color: #888 !important; }
        [data-testid="music-zone"] input:focus, [data-testid="music-zone"] textarea:focus {
          border-color: #1DB954 !important; box-shadow: 0 0 0 2px rgba(29,185,84,0.25) !important;
        }
      `}</style>
    </div>
  );
}

/* ============= Hero ============= */
const HeroBanner = ({ tracks, onPlayAll }) => (
  <div className="mb-6 rounded-xl p-5 md:p-7" style={{ background: "linear-gradient(135deg, #1DB954 0%, #0f6b32 100%)" }}>
    <div className="text-xs uppercase tracking-widest opacity-90 mb-1">Team playlist</div>
    <h1 className="text-3xl md:text-5xl font-black mb-2 text-white">All Team Tracks</h1>
    <p className="text-sm md:text-base opacity-90 mb-4">{tracks.length} track{tracks.length !== 1 && "s"} shared by your team</p>
    <button
      data-testid="play-all-btn"
      onClick={onPlayAll}
      disabled={!tracks.length}
      className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full font-semibold hover:scale-105 transition disabled:opacity-40"
    >
      <Play className="w-4 h-4 ml-0.5" /> Play all
    </button>
  </div>
);

/* ============= Card row ============= */
const RowSection = ({ title, icon: Icon, items, onPlayItem, currentTrack, playing, testid }) => (
  <div className="mb-6" data-testid={testid}>
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon className="w-4 h-4 text-[#1DB954]" />}
      <h2 className="text-lg font-bold text-white">{title}</h2>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((t, i) => {
        const isCurrent = currentTrack?.id === t.id;
        return (
          <motion.button
            key={t.id}
            data-testid={`card-${t.id}`}
            whileHover={{ y: -3 }}
            onClick={() => onPlayItem(i)}
            className="text-left rounded-lg p-3 transition group"
            style={{ background: "#1a1a1a" }}
          >
            <div className="mb-2 relative overflow-hidden rounded-md">
              <Cover track={t} />
              <div className="absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-xl" style={{ background: "#1DB954" }}>
                {isCurrent && playing ? <Pause className="w-4 h-4 text-black" /> : <Play className="w-4 h-4 text-black ml-0.5" />}
              </div>
              {t.plays && (
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-black/70 text-white">
                  {t.plays} play{t.plays !== 1 && "s"}
                </div>
              )}
            </div>
            <div className="text-sm font-semibold truncate text-white flex items-center gap-1">
              {t.title} <SourceBadge source={t.source} />
            </div>
            <div className="text-xs text-neutral-400 truncate">{t.artist}</div>
          </motion.button>
        );
      })}
    </div>
  </div>
);

/* ============= Track table ============= */
const TrackTable = ({ title, tracks, loading, currentTrack, playing, onRowClick, onToggleLike, onDelete, onAddToPlaylist, user, onEmptyUpload, showRemoveFromPl, onRemoveFromPl, draggable, onReorder }) => {
  const [dragIdx, setDragIdx] = useState(null);
  const onDragStart = (i) => setDragIdx(i);
  const onDragOver = (e) => e.preventDefault();
  const onDrop = (i) => {
    if (dragIdx === null || dragIdx === i) return;
    const next = [...tracks];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    setDragIdx(null);
    onReorder && onReorder(next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <span className="text-xs text-neutral-500">{tracks.length} tracks</span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-neutral-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading library…
        </div>
      ) : tracks.length === 0 ? (
        <EmptyState onUpload={onEmptyUpload} />
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: "#151515" }}>
          <div className="grid grid-cols-[40px_1fr_180px_80px_120px] md:grid-cols-[40px_1fr_180px_140px_80px_120px] items-center gap-3 px-3 py-2 text-[11px] uppercase tracking-widest text-neutral-500 border-b border-neutral-800">
            <span>#</span><span>Title</span><span className="hidden md:block">Uploaded by</span>
            <span>Duration</span><span></span><span></span>
          </div>
          <div data-testid="tracks-list">
            {tracks.map((t, i) => {
              const isCurrent = currentTrack?.id === t.id;
              const isPlaying = isCurrent && playing;
              return (
                <div
                  key={t.id}
                  data-testid={`track-row-${t.id}`}
                  onClick={() => onRowClick(i)}
                  draggable={!!draggable}
                  onDragStart={() => onDragStart(i)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(i)}
                  className={`grid grid-cols-[40px_1fr_180px_80px_120px] md:grid-cols-[40px_1fr_180px_140px_80px_120px] items-center gap-3 px-3 py-2 text-sm cursor-pointer transition group ${
                    isCurrent ? "bg-neutral-800/60" : "hover:bg-neutral-800/40"
                  } ${dragIdx === i ? "opacity-40" : ""}`}
                >
                  <div className="text-neutral-400 text-sm flex items-center justify-center w-6">
                    {draggable ? (
                      <GripVertical className="w-4 h-4 text-neutral-600 cursor-grab" />
                    ) : isPlaying ? (
                      <div className="flex items-end gap-0.5 h-4">
                        <span className="w-0.5 bg-[#1DB954] equalize" />
                        <span className="w-0.5 bg-[#1DB954] equalize" style={{ animationDelay: "0.15s" }} />
                        <span className="w-0.5 bg-[#1DB954] equalize" style={{ animationDelay: "0.3s" }} />
                      </div>
                    ) : (
                      <>
                        <span className="group-hover:hidden">{i + 1}</span>
                        <Play className="w-4 h-4 hidden group-hover:block text-white ml-0.5" />
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex items-center gap-3">
                    <Cover track={t} size="sm" />
                    <div className="min-w-0">
                      <div className={`font-semibold truncate flex items-center gap-1.5 ${isCurrent ? "text-[#1DB954]" : "text-white"}`}>
                        {t.title} <SourceBadge source={t.source} />
                      </div>
                      <div className="text-xs text-neutral-400 truncate">{t.artist}</div>
                    </div>
                  </div>
                  <div className="hidden md:block text-xs text-neutral-400 truncate">{t.user_name}</div>
                  <div className="text-xs text-neutral-400">{fmt(t.duration)}</div>
                  <div className="text-right">
                    <button data-testid={`like-btn-${t.id}`} onClick={(e) => { e.stopPropagation(); onToggleLike(t.id); }}
                      className={`p-1.5 rounded-full transition ${t.liked ? "text-[#1DB954]" : "text-neutral-400 hover:text-white"}`}>
                      <Heart className={`w-4 h-4 ${t.liked ? "fill-current" : ""}`} />
                    </button>
                  </div>
                  <div className="text-right flex items-center justify-end gap-1">
                    {onAddToPlaylist && (
                      <button data-testid={`add-to-pl-${t.id}`} onClick={(e) => { e.stopPropagation(); onAddToPlaylist(t); }}
                        className="p-1.5 rounded-full text-neutral-400 hover:text-white transition" title="Add to playlist">
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                    {showRemoveFromPl && (
                      <button data-testid={`remove-pl-${t.id}`} onClick={(e) => { e.stopPropagation(); onRemoveFromPl(t.id); }}
                        className="p-1.5 rounded-full text-neutral-400 hover:text-red-400 transition" title="Remove from playlist">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    {onDelete && (t.user_id === user?.id || user?.role === "admin") && (
                      <button data-testid={`delete-btn-${t.id}`} onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                        className="p-1.5 rounded-full text-neutral-500 hover:text-red-400 transition" title="Delete">
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
  );
};

/* ============= Empty state ============= */
const EmptyState = ({ onUpload }) => (
  <div className="text-center py-14 rounded-lg" style={{ background: "#151515" }} data-testid="music-empty">
    <div className="inline-flex w-14 h-14 rounded-full items-center justify-center mb-3" style={{ background: "#1DB95422" }}>
      <MusicIcon className="w-6 h-6" style={{ color: "#1DB954" }} />
    </div>
    <div className="text-white font-semibold mb-1">Nothing here yet</div>
    <div className="text-sm text-neutral-400 mb-4">Upload a file or paste a YouTube/Spotify link to get started.</div>
    <button data-testid="empty-upload-btn" onClick={onUpload}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-black hover:scale-105 transition"
      style={{ background: "#1DB954" }}>
      <Plus className="w-4 h-4" /> Add a track
    </button>
  </div>
);

/* ============= Playlist Detail ============= */
const PlaylistDetail = ({ playlist, currentTrack, playing, onBack, onPlayAt, onToggleLike, onRemoveFromPlaylist, onAddToPlaylist, onReordered, onPlaylistUpdated, onPlaylistDeleted, user }) => {
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canEdit = playlist.can_edit;

  const reorder = async (newTracks) => {
    onReordered(newTracks);
    try {
      await api.put(`/playlists/${playlist.id}/reorder`, { track_ids: newTracks.map((t) => t.id) });
    } catch { toast.error("Could not save order"); }
  };

  const playAll = () => { if (playlist.tracks?.length) onPlayAt(0); };

  const del = async () => {
    if (!window.confirm(`Delete playlist "${playlist.name}"?`)) return;
    setBusy(true);
    try {
      await api.delete(`/playlists/${playlist.id}`);
      onPlaylistDeleted();
      toast.success("Playlist deleted");
    } catch { toast.error("Delete failed"); }
    finally { setBusy(false); }
  };

  const VisIcon = playlist.visibility === "public" ? Globe : playlist.visibility === "shared" ? Users : Lock;

  return (
    <div data-testid={`playlist-detail-${playlist.id}`}>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white mb-4" data-testid="playlist-back">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col md:flex-row items-center md:items-end gap-5 md:gap-6 mb-6">
        <div className="w-40 h-40 rounded-md flex items-center justify-center shadow-2xl" style={{ background: playlist.cover_color || "#1DB954" }}>
          <ListMusic className="w-16 h-16 text-black/60" />
        </div>
        <div className="text-center md:text-left">
          <div className="text-xs uppercase tracking-widest text-neutral-400 mb-1 flex items-center gap-1.5 justify-center md:justify-start">
            <VisIcon className="w-3 h-3" /> {playlist.visibility} Playlist
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-1" data-testid="playlist-name">{playlist.name}</h1>
          {playlist.description && <p className="text-sm text-neutral-300 mb-2 max-w-xl">{playlist.description}</p>}
          <div className="text-xs text-neutral-400">
            Made by <span className="text-white font-semibold">{playlist.owner_name}</span> · {playlist.tracks?.length || 0} tracks
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <button data-testid="playlist-play-all"
          onClick={playAll} disabled={!playlist.tracks?.length}
          className="bg-[#1DB954] text-black rounded-full w-12 h-12 flex items-center justify-center hover:scale-105 transition disabled:opacity-40">
          <Play className="w-5 h-5 ml-0.5" />
        </button>
        {canEdit && (
          <>
            <button data-testid="playlist-settings" onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800 transition" title="Settings">
              <Share2 className="w-4 h-4" />
            </button>
            <button data-testid="playlist-delete" onClick={del} disabled={busy}
              className="p-2 rounded-full text-neutral-300 hover:text-red-400 hover:bg-neutral-800 transition" title="Delete playlist">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      <TrackTable
        title="Tracks"
        tracks={playlist.tracks || []}
        loading={false}
        currentTrack={currentTrack}
        playing={playing}
        onRowClick={onPlayAt}
        onToggleLike={onToggleLike}
        onAddToPlaylist={onAddToPlaylist}
        showRemoveFromPl={canEdit}
        onRemoveFromPl={onRemoveFromPlaylist}
        user={user}
        draggable={canEdit}
        onReorder={reorder}
      />

      <AnimatePresence>
        {settingsOpen && (
          <PlaylistSettingsModal
            playlist={playlist}
            onClose={() => setSettingsOpen(false)}
            onSaved={(patch) => { onPlaylistUpdated(patch); setSettingsOpen(false); toast.success("Playlist updated"); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ============= Add / Upload Modal ============= */
const AddTrackModal = ({ onClose, onAdded }) => {
  const [tab, setTab] = useState("file"); // 'file' | 'link'
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose} data-testid="upload-modal">
      <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{ background: "#181818", color: "#fff", border: "1px solid #2a2a2a" }}>
        <button type="button" onClick={onClose} data-testid="upload-close" className="absolute top-3 right-3 text-neutral-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold mb-3">Add a track</h3>
        <div className="flex gap-1 p-1 rounded-full mb-4" style={{ background: "#0f0f0f", width: "fit-content" }}>
          <button data-testid="tab-file" onClick={() => setTab("file")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${tab === "file" ? "bg-white text-black" : "text-neutral-400"}`}>
            <Upload className="w-3.5 h-3.5 inline mr-1.5" /> File
          </button>
          <button data-testid="tab-link" onClick={() => setTab("link")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${tab === "link" ? "bg-white text-black" : "text-neutral-400"}`}>
            <Link2 className="w-3.5 h-3.5 inline mr-1.5" /> Link
          </button>
        </div>
        {tab === "file" ? <UploadFileForm onAdded={onAdded} /> : <LinkForm onAdded={onAdded} />}
        <style>{`
          [data-testid="upload-modal"] input, [data-testid="upload-modal"] textarea {
            background: #242424 !important; color: #fff !important; border: 1px solid #333 !important;
          }
          [data-testid="upload-modal"] input::placeholder, [data-testid="upload-modal"] textarea::placeholder { color: #888 !important; }
          [data-testid="upload-modal"] input:focus, [data-testid="upload-modal"] textarea:focus {
            border-color: #1DB954 !important; box-shadow: 0 0 0 2px rgba(29,185,84,0.25) !important;
          }
        `}</style>
      </motion.div>
    </motion.div>
  );
};

const UploadFileForm = ({ onAdded }) => {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const onFile = (f) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) return toast.error("File too large. Max 50 MB.");
    if (!f.type.startsWith("audio/")) return toast.error("Please pick an audio file.");
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ""));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true); setProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title || file.name);
      fd.append("artist", artist || "Unknown");
      const { data } = await api.post("/music/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => { if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100)); },
      });
      onAdded(data);
    } catch (err) { toast.error(err?.response?.data?.detail || "Upload failed"); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit}>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
        className="block rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition mb-4"
        style={{ borderColor: drag ? "#1DB954" : "#333", background: drag ? "#1DB95415" : "#0f0f0f" }}
        data-testid="upload-dropzone"
      >
        <input ref={inputRef} data-testid="upload-file-input" type="file" accept="audio/*" className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])} />
        {file ? (
          <div className="text-sm">
            <MusicIcon className="w-6 h-6 mx-auto mb-2" style={{ color: "#1DB954" }} />
            <div className="font-semibold truncate">{file.name}</div>
            <div className="text-xs text-neutral-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
          </div>
        ) : (
          <div className="text-sm text-neutral-400">
            <Upload className="w-6 h-6 mx-auto mb-2 text-neutral-500" />
            Drag & drop audio file<br />
            <span className="text-neutral-500">or click to browse</span>
          </div>
        )}
      </label>
      <div className="space-y-2 mb-4">
        <input data-testid="upload-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Track title"
          className="w-full px-3 py-2 rounded-md text-sm" />
        <input data-testid="upload-artist" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist (optional)"
          className="w-full px-3 py-2 rounded-md text-sm" />
      </div>
      {busy && (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div style={{ width: `${progress}%`, background: "#1DB954" }} className="h-full transition-all" />
          </div>
          <div className="text-xs text-neutral-400 mt-1">Uploading… {progress}%</div>
        </div>
      )}
      <button data-testid="upload-submit" type="submit" disabled={!file || busy}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-black transition disabled:opacity-50" style={{ background: "#1DB954" }}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {busy ? "Uploading…" : "Add to library"}
      </button>
    </form>
  );
};

const LinkForm = ({ onAdded }) => {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    try {
      const { data } = await api.post("/music/link", { url: url.trim() });
      onAdded(data);
    } catch (err) { toast.error(err?.response?.data?.detail || "Could not add link"); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <div className="mb-3 text-xs text-neutral-400 leading-relaxed">
        Paste a YouTube or Spotify track link. We&apos;ll fetch the title + cover art automatically.
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1 text-xs text-neutral-500"><Youtube className="w-4 h-4 text-red-500" /> YouTube</div>
        <div className="flex items-center gap-1 text-xs text-neutral-500"><span className="w-2 h-2 rounded-full bg-[#1DB954] inline-block" /> Spotify</div>
      </div>
      <input
        data-testid="link-url-input"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=…  or  https://open.spotify.com/track/…"
        className="w-full px-3 py-2 rounded-md text-sm mb-4"
      />
      <button data-testid="link-submit" type="submit" disabled={!url.trim() || busy}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-black transition disabled:opacity-50" style={{ background: "#1DB954" }}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
        {busy ? "Fetching…" : "Add link"}
      </button>
    </form>
  );
};

/* ============= Create Playlist Modal ============= */
const CreatePlaylistModal = ({ onClose, onCreated }) => {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const { data } = await api.post("/playlists", { name: name.trim(), description: desc.trim(), visibility });
      onCreated(data);
    } catch { toast.error("Could not create"); }
    finally { setBusy(false); }
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose} data-testid="create-playlist-modal">
      <motion.form initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{ background: "#181818", color: "#fff", border: "1px solid #2a2a2a" }}>
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-neutral-400 hover:text-white" data-testid="create-pl-close">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold mb-4">Create playlist</h3>
        <input data-testid="pl-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Playlist name"
          className="w-full px-3 py-2 rounded-md text-sm mb-2"
          style={{ background: "#242424", color: "#fff", border: "1px solid #333" }} />
        <textarea data-testid="pl-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)"
          rows={2} className="w-full px-3 py-2 rounded-md text-sm mb-4"
          style={{ background: "#242424", color: "#fff", border: "1px solid #333" }} />
        <div className="mb-4">
          <div className="text-xs text-neutral-400 mb-2">Who can see this playlist?</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "private", icon: Lock, label: "Only me" },
              { v: "shared", icon: Users, label: "Shared" },
              { v: "public", icon: Globe, label: "Whole team" },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                data-testid={`vis-${o.v}`}
                onClick={() => setVisibility(o.v)}
                className={`p-2 rounded-md text-xs font-semibold border transition ${
                  visibility === o.v ? "bg-[#1DB954] text-black border-[#1DB954]" : "bg-neutral-800 text-neutral-300 border-neutral-700"
                }`}
              >
                <o.icon className="w-4 h-4 mx-auto mb-1" /> {o.label}
              </button>
            ))}
          </div>
        </div>
        <button data-testid="pl-create-submit" type="submit" disabled={!name.trim() || busy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-black transition disabled:opacity-50" style={{ background: "#1DB954" }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Create
        </button>
      </motion.form>
    </motion.div>
  );
};

/* ============= Add To Playlist Modal ============= */
const AddToPlaylistModal = ({ track, playlists, onClose, onAdded, onCreateFirst }) => {
  const [busy, setBusy] = useState(null);
  const add = async (pl) => {
    setBusy(pl.id);
    try {
      await api.post(`/playlists/${pl.id}/tracks`, { track_id: track.id });
      onAdded(pl.name);
    } catch { toast.error("Could not add"); setBusy(null); }
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose} data-testid="add-to-pl-modal">
      <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{ background: "#181818", color: "#fff", border: "1px solid #2a2a2a" }}>
        <button onClick={onClose} className="absolute top-3 right-3 text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-bold mb-1">Add to playlist</h3>
        <p className="text-xs text-neutral-400 mb-4 truncate">&ldquo;{track.title}&rdquo;</p>
        {playlists.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-neutral-400 mb-3">You don&apos;t have any playlists yet.</p>
            <button data-testid="add-to-pl-create-first" onClick={onCreateFirst}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-black" style={{ background: "#1DB954" }}>
              <Plus className="w-4 h-4" /> Create playlist
            </button>
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {playlists.map((p) => (
              <button
                key={p.id}
                data-testid={`add-to-pl-${p.id}`}
                onClick={() => add(p)}
                disabled={busy === p.id}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-neutral-800 transition"
              >
                <span className="w-9 h-9 rounded flex-shrink-0 flex items-center justify-center" style={{ background: p.cover_color || "#1DB954" }}>
                  <ListMusic className="w-4 h-4 text-black/70" />
                </span>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-neutral-400">{p.track_count || 0} tracks</div>
                </div>
                {busy === p.id ? <Loader2 className="w-4 h-4 animate-spin text-neutral-400" /> : <Plus className="w-4 h-4 text-neutral-400" />}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

/* ============= Playlist Settings Modal ============= */
const PlaylistSettingsModal = ({ playlist, onClose, onSaved }) => {
  const [name, setName] = useState(playlist.name);
  const [desc, setDesc] = useState(playlist.description || "");
  const [visibility, setVisibility] = useState(playlist.visibility);
  const [users, setUsers] = useState([]);
  const [shared, setShared] = useState(playlist.shared_with || []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/users").then(({ data }) => setUsers(data.filter((u) => u.id !== playlist.owner_id))).catch(() => {});
  }, [playlist.owner_id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.patch(`/playlists/${playlist.id}`, { name, description: desc, visibility, shared_with: visibility === "shared" ? shared : [] });
      onSaved(data);
    } catch { toast.error("Save failed"); }
    finally { setBusy(false); }
  };
  const toggleUser = (uid) => setShared((cur) => cur.includes(uid) ? cur.filter((x) => x !== uid) : [...cur, uid]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose} data-testid="pl-settings-modal">
      <motion.form initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 12 }}
        onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="w-full max-w-md rounded-2xl p-6 relative"
        style={{ background: "#181818", color: "#fff", border: "1px solid #2a2a2a" }}>
        <button type="button" onClick={onClose} className="absolute top-3 right-3 text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
        <h3 className="text-xl font-bold mb-4">Playlist settings</h3>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-md text-sm mb-2"
          style={{ background: "#242424", color: "#fff", border: "1px solid #333" }} />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
          className="w-full px-3 py-2 rounded-md text-sm mb-4"
          style={{ background: "#242424", color: "#fff", border: "1px solid #333" }} />
        <div className="mb-4">
          <div className="text-xs text-neutral-400 mb-2">Visibility</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: "private", icon: Lock, label: "Only me" },
              { v: "shared", icon: Users, label: "Shared" },
              { v: "public", icon: Globe, label: "Whole team" },
            ].map((o) => (
              <button key={o.v} type="button" onClick={() => setVisibility(o.v)}
                className={`p-2 rounded-md text-xs font-semibold border transition ${
                  visibility === o.v ? "bg-[#1DB954] text-black border-[#1DB954]" : "bg-neutral-800 text-neutral-300 border-neutral-700"
                }`}>
                <o.icon className="w-4 h-4 mx-auto mb-1" /> {o.label}
              </button>
            ))}
          </div>
        </div>
        {visibility === "shared" && (
          <div className="mb-4">
            <div className="text-xs text-neutral-400 mb-2">Share with</div>
            <div className="max-h-40 overflow-y-auto space-y-1 border border-neutral-800 rounded-md p-2">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={shared.includes(u.id)} onChange={() => toggleUser(u.id)} />
                  {u.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <button type="submit" disabled={busy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full font-semibold text-black transition disabled:opacity-50" style={{ background: "#1DB954" }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
        </button>
      </motion.form>
    </motion.div>
  );
};
