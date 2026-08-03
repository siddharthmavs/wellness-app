import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BrutalButton } from "./brutal";
import { Eye, Pause, Play, RotateCcw } from "lucide-react";

// 20-20-20 eye care timer: 20 min work, 20 sec break
const WORK = 20 * 60; // seconds
const BREAK = 20;

export const EyeCareTimer = ({ onBreakComplete }) => {
 const [secs, setSecs] = useState(WORK);
 const [phase, setPhase] = useState("work"); // work | break
 const [running, setRunning] = useState(false);
 const timerRef = useRef();

 useEffect(() => {
 if (!running) return;
 timerRef.current = setInterval(() => {
 setSecs((s) => {
 if (s <= 1) {
 if (phase === "work") {
 setPhase("break");
 return BREAK;
 } else {
 setPhase("work");
 if (onBreakComplete) onBreakComplete();
 return WORK;
 }
 }
 return s - 1;
 });
 }, 1000);
 return () => clearInterval(timerRef.current);
 }, [running, phase, onBreakComplete]);

 const mm = String(Math.floor(secs / 60)).padStart(2, "0");
 const ss = String(secs % 60).padStart(2, "0");

 return (
 <div
 data-testid="eye-care-timer"
 className={`border-[4px] border-black shadow-brutal-lg rounded-[4px] p-5 ${phase === "break" ? "bg-brutal-yellow" : "bg-white"}`}
 >
 <div className="flex items-center gap-2 mb-3">
 <Eye className="w-5 h-5" />
 <h3 className="font-display font-black uppercase text-xl"> 20-20-20 Eye Guard</h3>
 </div>
 <motion.div
 key={phase}
 initial={{ scale: 0.8, rotate: -3 }}
 animate={{ scale: 1, rotate: 0 }}
 className="font-display font-black text-6xl md:text-7xl text-center my-4 tabular-nums"
 >
 {mm}:{ss}
 </motion.div>
 <div className="text-center font-bold uppercase text-sm mb-4">
 {phase === "work" ? " FOCUS TIME" : " LOOK AT SOMETHING 20FT AWAY"}
 </div>
 <div className="flex gap-2 justify-center">
 <BrutalButton
 data-testid="timer-toggle"
 color={running ? "pink" : "green"}
 onClick={() => setRunning(!running)}
 >
 {running ? <><Pause className="inline w-4 h-4 mr-1" /> PAUSE</> : <><Play className="inline w-4 h-4 mr-1" /> START</>}
 </BrutalButton>
 <BrutalButton
 data-testid="timer-reset"
 color="white"
 onClick={() => { setRunning(false); setPhase("work"); setSecs(WORK); }}
 >
 <RotateCcw className="inline w-4 h-4 mr-1" /> RESET
 </BrutalButton>
 </div>
 </div>
 );
};
