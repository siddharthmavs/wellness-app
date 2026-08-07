import React, { useEffect, useRef, useState } from "react";
import { useMusicStore, useAuthStore } from "../store";
import { API } from "../lib/api";
import { api } from "../lib/api";
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Repeat, Shuffle, X, Music as MusicIcon,
} from "lucide-react";

const fmt = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

export const MusicPlayer = () => {
  const {
    queue, currentIndex, playing, volume, muted,
    togglePlay, next, prev, setPlaying, setVolume, toggleMute,
    updateTrack, clear,
  } = useMusicStore();
  const token = useAuthStore((s) => s.token);
  const audioRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const track = currentIndex >= 0 ? queue[currentIndex] : null;

  // Sync playing state with audio element
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  useEffect(() => {
    if (!audioRef.current || !track) return;
    if (playing) {
      audioRef.current.play().catch(() => setPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [playing, track?.id]);

  // On track change, log play
  useEffect(() => {
    if (!track) return;
    api.post(`/music/history/${track.id}`).catch(() => {});
    setProgress(0);
  }, [track?.id]);

  if (!track || !token) return null;
  const streamUrl = `${API}/music/stream/${track.id}?auth=${token}`;

  const onSeek = (e) => {
    const v = +e.target.value;
    if (audioRef.current) audioRef.current.currentTime = v;
    setProgress(v);
  };

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
      <audio
        ref={audioRef}
        src={streamUrl}
        preload="metadata"
        onTimeUpdate={(e) => setProgress(e.target.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.target.duration);
          if (track && !track.duration) {
            updateTrack(track.id, { duration: e.target.duration });
          }
        }}
        onEnded={next}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-2.5 grid grid-cols-12 items-center gap-2 md:gap-4">
        {/* Left: track meta */}
        <div className="col-span-4 md:col-span-3 flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 md:w-12 md:h-12 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#1DB954,#0f6b32)" }}
          >
            <MusicIcon className="w-5 h-5 text-black" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate" data-testid="player-title">{track.title}</div>
            <div className="text-[11px] text-neutral-400 truncate">{track.artist}</div>
          </div>
        </div>

        {/* Center: controls + progress */}
        <div className="col-span-8 md:col-span-6 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              data-testid="player-prev"
              onClick={prev}
              className="text-neutral-300 hover:text-white transition"
              title="Previous"
            >
              <SkipBack className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              data-testid="player-toggle"
              onClick={togglePlay}
              className="bg-white text-black rounded-full w-9 h-9 md:w-10 md:h-10 flex items-center justify-center hover:scale-105 transition"
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button
              data-testid="player-next"
              onClick={next}
              className="text-neutral-300 hover:text-white transition"
              title="Next"
            >
              <SkipForward className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          <div className="w-full flex items-center gap-2 hidden md:flex">
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
        </div>

        {/* Right: volume + close */}
        <div className="col-span-12 md:col-span-3 flex items-center justify-end gap-2">
          <button
            data-testid="player-mute"
            onClick={toggleMute}
            className="text-neutral-300 hover:text-white transition"
            title={muted ? "Unmute" : "Mute"}
          >
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
          <button
            data-testid="player-close"
            onClick={clear}
            className="text-neutral-500 hover:text-white transition ml-1"
            title="Close player"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <style>{`
        .spotify-range {
          -webkit-appearance: none;
          background: #4d4d4d;
          border-radius: 999px;
        }
        .spotify-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px; height: 12px;
          background: #fff; border-radius: 50%;
          cursor: pointer;
        }
        .spotify-range::-moz-range-thumb {
          width: 12px; height: 12px;
          background: #fff; border-radius: 50%;
          border: none; cursor: pointer;
        }
      `}</style>
    </div>
  );
};
