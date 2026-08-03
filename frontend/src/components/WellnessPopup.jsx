import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BrutalButton } from "./brutal";

export const WellnessPopup = ({ notif, onYes, onIgnore }) => {
 if (!notif) return null;
 const bgColor =
 notif.type === "water" ? "bg-brutal-cyan" :
 notif.type === "eye_care" ? "bg-brutal-yellow" :
 notif.type === "stand" ? "bg-brutal-pink" :
 "bg-brutal-green";
 return (
 <AnimatePresence>
 <motion.div
 key="backdrop"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 data-testid="wellness-popup"
 className="fixed inset-0 z-[100] flex items-center justify-center p-4"
 style={{ background: "rgba(0,0,0,0.4)" }}
 >
 <motion.div
 initial={{ scale: 0.5, rotate: -8, opacity: 0 }}
 animate={{ scale: 1, rotate: -2, opacity: 1 }}
 exit={{ scale: 0.5, rotate: 8, opacity: 0 }}
 transition={{ type: "spring", stiffness: 300, damping: 18 }}
 className={`relative ${bgColor} border-[6px] border-black shadow-brutal-xl max-w-xl w-full p-8 md:p-12 rounded-[4px]`}
 >
 <motion.div
 animate={{ rotate: [0, 3, -3, 0] }}
 transition={{ repeat: Infinity, duration: 2 }}
 className="absolute -top-6 -left-4 bg-black text-white border-[3px] border-black px-3 py-1 font-black uppercase text-xs tracking-widest"
 >
 WELLNESS ALERT
 </motion.div>

 <h2 className="font-display font-black text-4xl md:text-6xl uppercase leading-none mb-5 text-black">
 {notif.title}
 </h2>
 <p className="font-body text-lg md:text-xl font-semibold text-black mb-8">
 {notif.message}
 </p>

 <div className="flex gap-4 flex-wrap">
 <BrutalButton data-testid="popup-yes" color="green" size="lg" onClick={onYes}>
 YES LOCK IN
 </BrutalButton>
 <BrutalButton data-testid="popup-ignore" color="white" size="lg" onClick={onIgnore}>
 NAH, IM BAD 
 </BrutalButton>
 </div>

 <div className="absolute -bottom-5 -right-4 bg-white border-[3px] border-black px-3 py-1 font-black text-xs uppercase tracking-widest">
 +{notif.type === "breathing" ? 20 : notif.type === "eye_care" ? 15 : 10} PTS
 </div>
 </motion.div>
 </motion.div>
 </AnimatePresence>
 );
};
