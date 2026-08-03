import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalTag } from "../components/brutal";
import { Play, Pause, SkipForward, Volume2, VolumeX } from "lucide-react";

export default function Music() {
 const [lists, setLists] = useState([]);
 const [activeList, setActiveList] = useState(null);
 const [trackIdx, setTrackIdx] = useState(0);
 const [playing, setPlaying] = useState(false);
 const [volume, setVolume] = useState(0.6);
 const [muted, setMuted] = useState(false);
 const audioRef = useRef();

 useEffect(() => {
 api.get("/music/playlists").then(({ data }) => {
 setLists(data);
 setActiveList(data[0]);
 });
 }, []);

 useEffect(() => {
 if (audioRef.current) {
 audioRef.current.volume = muted ? 0 : volume;
 }
 }, [volume, muted]);

 const play = (list, idx = 0) => {
 setActiveList(list);
 setTrackIdx(idx);
 setPlaying(true);
 setTimeout(() => audioRef.current?.play().catch(() => {}), 100);
 };

 const toggle = () => {
 if (!audioRef.current) return;
 if (playing) audioRef.current.pause();
 else audioRef.current.play().catch(() => {});
 setPlaying(!playing);
 };

 const skip = () => {
 if (!activeList) return;
 const next = (trackIdx + 1) % activeList.tracks.length;
 setTrackIdx(next);
 setPlaying(true);
 setTimeout(() => audioRef.current?.play().catch(() => {}), 100);
 };

 const currentTrack = activeList?.tracks?.[trackIdx];

 return (
 <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 pb-32">
 <motion.div
 initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: -1, opacity: 1 }}
 className="bg-brutal-pink text-white border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
 data-testid="music-header"
 >
 <h1 className="font-display font-black text-5xl uppercase leading-none"> MUSIC ZONE</h1>
 <p className="text-xs uppercase tracking-widest mt-2">vibes, on demand</p>
 </motion.div>

 <div className="flex gap-2 mb-6 flex-wrap" data-testid="playlist-tabs">
 {lists.map((l) => (
 <BrutalTag key={l.id} active={activeList?.id === l.id} color={l.id === "focus" ? "cyan" : l.id === "relax" ? "green" : "pink"} onClick={() => setActiveList(l)}>
 {l.name}
 </BrutalTag>
 ))}
 </div>

 {activeList && (
 <BrutalCard color="white" hover={false}>
 <h2 className="font-display font-black text-3xl uppercase mb-3">{activeList.name}</h2>
 <div className="space-y-2" data-testid="track-list">
 {activeList.tracks.map((t, i) => {
 const isCurrent = currentTrack?.id === t.id;
 return (
 <div
 key={t.id}
 data-testid={`track-${t.id}`}
 onClick={() => play(activeList, i)}
 className={`flex items-center gap-3 border-[3px] border-black p-3 cursor-pointer ${isCurrent ? "bg-brutal-yellow shadow-brutal-sm" : "bg-white"}`}
 >
 <div className="font-display font-black text-2xl w-10 text-center">{i + 1}</div>
 <div className="flex-1">
 <div className="font-black uppercase">{t.title}</div>
 <div className="text-xs font-bold">{t.artist}</div>
 </div>
 <span className="text-xs font-bold">{Math.floor(t.duration / 60)}:{String(t.duration % 60).padStart(2, "0")}</span>
 </div>
 );
 })}
 </div>
 </BrutalCard>
 )}

 {/* Persistent player */}
 {currentTrack && (
 <motion.div
 initial={{ y: 100 }} animate={{ y: 0 }}
 className="fixed bottom-0 left-0 right-0 z-50 border-t-[4px] border-black bg-brutal-yellow shadow-brutal-xl"
 data-testid="music-player"
 >
 <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
 <div className="flex-1 min-w-[180px]">
 <div className="font-black uppercase text-sm truncate">{currentTrack.title}</div>
 <div className="text-xs font-bold">{currentTrack.artist} · {activeList.name}</div>
 </div>
 <button data-testid="player-toggle" onClick={toggle} className="bg-black text-white border-[3px] border-black p-3 shadow-brutal-sm">
 {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
 </button>
 <button data-testid="player-skip" onClick={skip} className="bg-white border-[3px] border-black p-3 shadow-brutal-sm">
 <SkipForward className="w-5 h-5" />
 </button>
 <button data-testid="player-mute" onClick={() => setMuted(!muted)} className="bg-white border-[3px] border-black p-3 shadow-brutal-sm">
 {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
 </button>
 <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(+e.target.value)} className="w-24" />
 </div>
 <audio
 ref={audioRef}
 src={currentTrack.url}
 onEnded={skip}
 onPlay={() => setPlaying(true)}
 onPause={() => setPlaying(false)}
 />
 </motion.div>
 )}
 </div>
 );
}
