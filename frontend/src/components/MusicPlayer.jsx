import React, { useEffect, useRef, useState, useCallback } from "react";
import { useMusicStore, useAuthStore } from "../store";
import { API, api } from "../lib/api";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  X, Music as MusicIcon, ExternalLink, Youtube,
} from "lucide-react";

const fmt = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

/* --- YouTube IFrame API loader ------------------------------------------ */
let ytReady = null;
const loadYT = () => {
  if (ytReady) return ytReady;
  ytReady = new Promise((resolve) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev && prev();
      resolve(window.YT);
    };
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
  });
  return ytReady;
};

/* --- Spotify IFrame API loader ------------------------------------------ */
let spReady = null;
const loadSpotify = () => {
  if (spReady) return spReady;
  spReady = new Promise((resolve) => {
    if (window.SpotifyIframeApi) return resolve(window.SpotifyIframeApi);
    const prev = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      window.SpotifyIframeApi = IFrameAPI;
      prev && prev(IFrameAPI);
      resolve(IFrameAPI);
    };
    if (!document.getElementById("sp-iframe-api")) {
      const s = document.createElement("script");
      s.id = "sp-iframe-api";
      s.src = "https://open.spotify.com/embed/iframe-api/v1";
      s.async = true;
      document.head.appendChild(s);
    }
  });
  return spReady;
};

export const MusicPlayer = () => {
  const {
    queue, currentIndex, playing, volume, muted,
    togglePlay, next, prev, setPlaying, setVolume, toggleMute,
    updateTrack, clear,
  } = useMusicStore();
  const token = useAuthStore((s) => s.token);
  const audioRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const ytElRef = useRef(null);
  const spCtrlRef = useRef(null);
  const spElRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ytLoading, setYtLoading] = useState(false);
  const track = currentIndex >= 0 ? queue[currentIndex] : null;
  const source = track?.source || "upload";

  /* --- history log on new track --- */
  useEffect(() => {
    if (!track) return;
    api.post(`/music/history/${track.id}`).catch(() => {});
    setProgress(0);
    setDuration(track.duration || 0);
  }, [track?.id]);

  /* --- swallow Spotify SDK errors so they don't bubble as toasts --- */
  useEffect(() => {
    const isSpotifyErr = (msgOrErr) => {
      const s = String(msgOrErr?.stack || msgOrErr?.message || msgOrErr || "");
      return /spotifycdn|open\.spotify|iframe-api/i.test(s);
    };
    const onRej = (e) => { if (isSpotifyErr(e.reason)) e.preventDefault(); };
    const onErr = (e) => { if (isSpotifyErr(e.error) || isSpotifyErr(e.filename)) e.preventDefault(); };
    window.addEventListener("unhandledrejection", onRej);
    window.addEventListener("error", onErr, true);
    return () => {
      window.removeEventListener("unhandledrejection", onRej);
      window.removeEventListener("error", onErr, true);
    };
  }, []);

  /* ---------------- HTML5 audio (uploaded files) ---------------- */
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    if (source !== "upload" || !audioRef.current || !track) return;
    if (playing) audioRef.current.play().catch(() => setPlaying(false));
    else audioRef.current.pause();
  }, [playing, track?.id, source]);

  /* ---------------- YouTube ---------------- */
  useEffect(() => {
    if (source !== "youtube" || !track?.external_id) return;
    let cancelled = false;
    let progInt = null;
    setYtLoading(true);
    loadYT().then((YT) => {
      if (cancelled || !ytElRef.current) return;
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (_e) { /* ignore */ }
        ytPlayerRef.current = null;
      }
      ytPlayerRef.current = new YT.Player(ytElRef.current, {
        videoId: track.external_id,
        height: "100",
        width: "100",
        playerVars: { autoplay: playing ? 1 : 0, controls: 0, disablekb: 1, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e) => {
            setYtLoading(false);
            e.target.setVolume(Math.round((muted ? 0 : volume) * 100));
            if (playing) e.target.playVideo();
            const d = e.target.getDuration?.();
            if (d) {
              setDuration(d);
              if (!track.duration) updateTrack(track.id, { duration: d });
            }
            progInt = setInterval(() => {
              try {
                const cur = e.target.getCurrentTime?.();
                if (typeof cur === "number") setProgress(cur);
              } catch (_e) { /* ignore */ }
            }, 500);
          },
          onStateChange: (e) => {
            // 0=ended, 1=playing, 2=paused, 3=buffering
            if (e.data === 0) next();
            else if (e.data === 1) setPlaying(true);
            else if (e.data === 2) setPlaying(false);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (progInt) clearInterval(progInt);
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (_e) { /* ignore */ }
        ytPlayerRef.current = null;
      }
    };
  }, [track?.id, source]);

  useEffect(() => {
    if (source !== "youtube" || !ytPlayerRef.current) return;
    try {
      ytPlayerRef.current.setVolume(Math.round((muted ? 0 : volume) * 100));
    } catch (_e) { /* ignore */ }
  }, [volume, muted, source]);

  useEffect(() => {
    if (source !== "youtube" || !ytPlayerRef.current) return;
    try {
      if (playing) ytPlayerRef.current.playVideo();
      else ytPlayerRef.current.pauseVideo();
    } catch (_e) { /* ignore */ }
  }, [playing, source]);

  /* ---------------- Spotify ---------------- */
  useEffect(() => {
    if (source !== "spotify" || !track?.external_id) return;
    let cancelled = false;
    if (spCtrlRef.current) {
      try { spCtrlRef.current.destroy(); } catch (_e) { /* ignore */ }
      spCtrlRef.current = null;
    }
    loadSpotify().then((IFrameAPI) => {
      if (cancelled || !spElRef.current) return;
      const [type, id] = track.external_id.split(":");
      try {
        IFrameAPI.createController(
          spElRef.current,
          { uri: `spotify:${type || "track"}:${id}`, width: "100%", height: "80" },
          (ctrl) => {
            spCtrlRef.current = ctrl;
            try {
              ctrl.addListener("playback_update", (e) => {
                try {
                  const { position, duration: d, isPaused } = e.data || {};
                  if (typeof position === "number") setProgress(position / 1000);
                  if (typeof d === "number") setDuration(d / 1000);
                  if (typeof isPaused === "boolean") setPlaying(!isPaused);
                } catch (_e) { /* ignore listener errors */ }
              });
              if (playing) ctrl.play?.();
            } catch (_e) { /* ignore Spotify SDK init errors */ }
          }
        );
      } catch (_e) { /* ignore Spotify createController errors */ }
    }).catch(() => { /* ignore Spotify SDK load errors */ });
    return () => {
      cancelled = true;
      if (spCtrlRef.current) {
        try { spCtrlRef.current.destroy(); } catch (_e) { /* ignore */ }
        spCtrlRef.current = null;
      }
    };
  }, [track?.id, source]);

  useEffect(() => {
    if (source !== "spotify" || !spCtrlRef.current) return;
    try {
      if (playing) spCtrlRef.current.play?.();
      else spCtrlRef.current.pause?.();
    } catch (_e) { /* ignore */ }
  }, [playing, source]);

  /* ---------------- Seek ---------------- */
  const onSeek = useCallback((e) => {
    const v = +e.target.value;
    setProgress(v);
    if (source === "upload" && audioRef.current) audioRef.current.currentTime = v;
    else if (source === "youtube" && ytPlayerRef.current) {
      try { ytPlayerRef.current.seekTo(v, true); } catch (_e) { /* ignore */ }
    } else if (source === "spotify" && spCtrlRef.current) {
      try { spCtrlRef.current.seek?.(v); } catch (_e) { /* ignore */ }
    }
  }, [source]);

  if (!track || !token) return null;
  const streamUrl = source === "upload" ? `${API}/music/stream/${track.id}?auth=${token}` : null;
  const isSpotify = source === "spotify";
  const isYT = source === "youtube";

  return (
    <div
      data-testid="music-player"
      className="fixed bottom-0 left-0 right-0 z-40 select-none"
      style={{
        background: "#181818",
        color: "#fff",
        borderTop: "1px solid #282828",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.4)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Uploaded audio */}
      {source === "upload" && (
        <audio
          ref={audioRef}
          src={streamUrl}
          preload="metadata"
          onTimeUpdate={(e) => setProgress(e.target.currentTime)}
          onLoadedMetadata={(e) => {
            setDuration(e.target.duration);
            if (track && !track.duration) updateTrack(track.id, { duration: e.target.duration });
          }}
          onEnded={next}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      )}

      {/* YouTube hidden iframe */}
      {isYT && (
        <div style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
          <div ref={ytElRef} />
        </div>
      )}

      {/* Spotify embed strip — needs to be visible for the API to work reliably.
          NOTE: Spotify IFrame API REPLACES the mount element with an <iframe> and drops
          any attributes, so we keep data-testid on the OUTER wrapper (persistent) and
          let the SDK replace an inner mount div. */}
      {isSpotify && (
        <div className="max-w-7xl mx-auto px-3 md:px-4 pt-2" data-testid="spotify-embed">
          <div ref={spElRef} />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 md:px-4 py-2.5 grid grid-cols-12 items-center gap-2 md:gap-4">
        {/* Left: track meta with thumb */}
        <div className="col-span-4 md:col-span-3 flex items-center gap-3 min-w-0">
          {track.thumbnail_url ? (
            <img
              src={track.thumbnail_url}
              alt=""
              className="w-11 h-11 md:w-12 md:h-12 rounded-md object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-11 h-11 md:w-12 md:h-12 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#1DB954,#0f6b32)" }}
            >
              <MusicIcon className="w-5 h-5 text-black" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate flex items-center gap-1.5" data-testid="player-title">
              {track.title}
              {isYT && <Youtube className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
              {isSpotify && <span className="w-2 h-2 rounded-full bg-[#1DB954] flex-shrink-0" />}
            </div>
            <div className="text-[11px] text-neutral-400 truncate">{track.artist}</div>
          </div>
        </div>

        {/* Center: controls + progress */}
        <div className="col-span-8 md:col-span-6 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3 md:gap-4">
            <button data-testid="player-prev" onClick={prev} className="text-neutral-300 hover:text-white transition" title="Previous">
              <SkipBack className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              data-testid="player-toggle"
              onClick={togglePlay}
              className="bg-white text-black rounded-full w-9 h-9 md:w-10 md:h-10 flex items-center justify-center hover:scale-105 transition"
              title={playing ? "Pause" : "Play"}
              disabled={ytLoading}
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button data-testid="player-next" onClick={next} className="text-neutral-300 hover:text-white transition" title="Next">
              <SkipForward className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          {!isSpotify && (
            <div className="w-full items-center gap-2 hidden md:flex">
              <span className="text-[10px] text-neutral-400 w-9 text-right">{fmt(progress)}</span>
              <input
                data-testid="player-seek"
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(progress, duration || 0)}
                onChange={onSeek}
                className="flex-1 accent-[#1DB954] h-1 spotify-range"
              />
              <span className="text-[10px] text-neutral-400 w-9">{fmt(duration)}</span>
            </div>
          )}
          {isSpotify && (
            <div className="text-[10px] text-neutral-500 hidden md:block">
              Full playback requires Spotify login · <a href={track.link_url} target="_blank" rel="noreferrer" className="underline hover:text-white">open in Spotify</a>
            </div>
          )}
        </div>

        {/* Right: volume + close */}
        <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-2">
          {!isSpotify && (
            <>
              <button data-testid="player-mute" onClick={toggleMute} className="text-neutral-300 hover:text-white transition">
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                data-testid="player-volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => setVolume(+e.target.value)}
                className="w-20 md:w-24 accent-[#1DB954] h-1 spotify-range"
              />
            </>
          )}
          {track.link_url && (
            <a
              href={track.link_url}
              target="_blank"
              rel="noreferrer"
              className="text-neutral-500 hover:text-white transition"
              title="Open source"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button data-testid="player-close" onClick={clear} className="text-neutral-500 hover:text-white transition ml-1" title="Close player">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <style>{`
        .spotify-range { -webkit-appearance: none; background: #4d4d4d; border-radius: 999px; }
        .spotify-range::-webkit-slider-thumb {
          -webkit-appearance: none; width: 12px; height: 12px;
          background: #fff; border-radius: 50%; cursor: pointer;
        }
        .spotify-range::-moz-range-thumb {
          width: 12px; height: 12px; background: #fff;
          border-radius: 50%; border: none; cursor: pointer;
        }
      `}</style>
    </div>
  );
};
