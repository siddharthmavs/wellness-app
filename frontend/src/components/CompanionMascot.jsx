import React from "react";
import { motion } from "framer-motion";

/**
 * Hand-drawn cozy cat companion — 3 states: idle, happy, sad.
 * Uses cozy palette; blinks + sways subtly.
 */
export const CompanionMascot = ({ state = "idle", size = 160 }) => {
 const bodyColor = state === "sad" ? "#B8A896" : "#D8B592";
 const cheekColor = "#F2B5A7";
 return (
 <motion.svg
 viewBox="0 0 200 200"
 width={size}
 height={size}
 className="floaty-2"
 data-testid={`mascot-${state}`}
 >
 {/* Body */}
 <ellipse cx="100" cy="140" rx="55" ry="45" fill={bodyColor} stroke="#8B7561" strokeWidth="2" />
 {/* Head */}
 <ellipse cx="100" cy="90" rx="48" ry="42" fill={bodyColor} stroke="#8B7561" strokeWidth="2" />
 {/* Ears */}
 <path d="M 60 65 L 55 40 L 80 55 Z" fill={bodyColor} stroke="#8B7561" strokeWidth="2" strokeLinejoin="round" />
 <path d="M 140 65 L 145 40 L 120 55 Z" fill={bodyColor} stroke="#8B7561" strokeWidth="2" strokeLinejoin="round" />
 {/* Inner ears */}
 <path d="M 63 60 L 62 46 L 74 55 Z" fill={cheekColor} />
 <path d="M 137 60 L 138 46 L 126 55 Z" fill={cheekColor} />
 {/* Eyes */}
 {state === "happy" ? (
 <>
 <path d="M 78 88 Q 85 82 92 88" stroke="#3D4437" strokeWidth="3" fill="none" strokeLinecap="round" />
 <path d="M 108 88 Q 115 82 122 88" stroke="#3D4437" strokeWidth="3" fill="none" strokeLinecap="round" />
 </>
 ) : state === "sad" ? (
 <>
 <path d="M 78 92 Q 85 98 92 92" stroke="#3D4437" strokeWidth="3" fill="none" strokeLinecap="round" />
 <path d="M 108 92 Q 115 98 122 92" stroke="#3D4437" strokeWidth="3" fill="none" strokeLinecap="round" />
 </>
 ) : (
 <>
 <ellipse cx="85" cy="90" rx="4" ry="6" fill="#3D4437" className="animate-blink origin-center" style={{ transformOrigin: "85px 90px" }} />
 <ellipse cx="115" cy="90" rx="4" ry="6" fill="#3D4437" className="animate-blink origin-center" style={{ transformOrigin: "115px 90px" }} />
 </>
 )}
 {/* Cheeks */}
 <circle cx="72" cy="102" r="6" fill={cheekColor} opacity="0.6" />
 <circle cx="128" cy="102" r="6" fill={cheekColor} opacity="0.6" />
 {/* Nose */}
 <path d="M 96 100 L 100 105 L 104 100 Z" fill="#3D4437" />
 {/* Mouth */}
 {state === "sad" ? (
 <path d="M 92 115 Q 100 108 108 115" stroke="#3D4437" strokeWidth="2" fill="none" strokeLinecap="round" />
 ) : (
 <path d="M 92 112 Q 100 118 108 112" stroke="#3D4437" strokeWidth="2" fill="none" strokeLinecap="round" />
 )}
 {/* Tail */}
 <path d="M 155 140 Q 180 130 175 105" stroke="#8B7561" strokeWidth="4" fill="none" strokeLinecap="round" />
 <path d="M 155 140 Q 180 130 175 105" stroke={bodyColor} strokeWidth="7" fill="none" strokeLinecap="round" />
 </motion.svg>
 );
};

// Small decorative illustrations for backgrounds
export const CozyDecorations = () => (
 <>
 <div className="absolute top-20 left-6 text-4xl floaty-1 pointer-events-none opacity-40"></div>
 <div className="absolute top-40 right-10 text-3xl floaty-2 pointer-events-none opacity-30"></div>
 <div className="absolute bottom-32 left-16 text-3xl floaty-3 pointer-events-none opacity-40"></div>
 <div className="absolute bottom-20 right-24 text-2xl floaty-1 pointer-events-none opacity-30"></div>
 </>
);
