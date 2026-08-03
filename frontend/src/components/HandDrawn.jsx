import React from "react";

/**
 * HandDrawn.jsx — Unified illustrated icon set.
 * Style: 2-3px organic wobbly ink line, muted flat fills (sage/pink/cream/terracotta),
 * asymmetric personality, subtle paper texture inside fills.
 * Every icon must feel drawn by the same illustrator as CompanionMascot.
 */

const INK = "#3D4437";
const SAGE = "#7FAE62";
const PEACH = "#F7D9C4";
const CORAL = "#F2B5A7";
const CREAM = "#FFFDF8";
const TERRA = "#C67B5C";

// Reusable paper-grain filter — call this once in App and reuse via url(#grain)
export const InkDefs = () => (
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    <defs>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="4" />
        <feColorMatrix values="0 0 0 0 0.24  0 0 0 0 0.27  0 0 0 0 0.22  0 0 0 0.06 0" />
        <feComposite in2="SourceGraphic" operator="in" />
      </filter>
      <filter id="wobble">
        <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" seed="2" />
        <feDisplacementMap in="SourceGraphic" scale="1.2" />
      </filter>
    </defs>
  </svg>
);

const wrap = (children, size = 48, viewBox = "0 0 48 48") => (
  <svg width={size} height={size} viewBox={viewBox} fill="none" xmlns="http://www.w3.org/2000/svg">
    {children}
  </svg>
);

// ============ MOOD ILLUSTRATIONS ============

export const IconLit = ({ size = 56 }) => wrap(
  <g>
    {/* Flame body */}
    <path d="M24 5 C 21 12, 12 15, 15 26 C 16 31, 12 34, 15 40 C 18 45, 30 45, 33 40 C 36 34, 32 31, 33 26 C 35 20, 32 14, 30 12 C 28 15, 27 13, 24 5 Z"
      fill={CORAL} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    {/* Inner flame */}
    <path d="M23 20 C 21 25, 20 29, 22 34 C 26 37, 28 34, 27 30 C 26 27, 25 24, 23 20 Z"
      fill={PEACH} stroke={INK} strokeWidth="1.6" strokeLinejoin="round"/>
    {/* Little face */}
    <circle cx="22" cy="30" r="1.4" fill={INK}/>
    <circle cx="28" cy="30" r="1.4" fill={INK}/>
    <path d="M22 34 Q 25 37 28 34" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
  </g>, size);

export const IconZen = ({ size = 56 }) => wrap(
  <g>
    {/* Sitting cat */}
    <path d="M14 40 C 12 32, 15 26, 24 26 C 33 26, 36 32, 34 40 Z"
      fill={SAGE} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    {/* Head */}
    <path d="M17 27 C 15 20, 19 15, 24 15 C 29 15, 33 20, 31 27 Z"
      fill={SAGE} stroke={INK} strokeWidth="2.2" strokeLinejoin="round"/>
    {/* Ears */}
    <path d="M17 18 L 15 12 L 21 16 Z M 31 18 L 33 12 L 27 16 Z" fill={SAGE} stroke={INK} strokeWidth="2"/>
    {/* Closed eyes */}
    <path d="M19 21 Q 21 23 23 21" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M25 21 Q 27 23 29 21" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M23 24 L 25 24" stroke={INK} strokeWidth="1.6" strokeLinecap="round"/>
    {/* Steam curl */}
    <path d="M36 12 Q 40 10 38 6 Q 34 4 36 1" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
  </g>, size);

export const IconMeh = ({ size = 56 }) => wrap(
  <g>
    <circle cx="24" cy="24" r="17" fill={PEACH} stroke={INK} strokeWidth="2.2" filter="url(#grain)"/>
    {/* One tilted eye */}
    <path d="M17 21 L 21 21" stroke={INK} strokeWidth="2.2" strokeLinecap="round"/>
    <path d="M27 20 L 31 22" stroke={INK} strokeWidth="2.2" strokeLinecap="round"/>
    {/* Flat mouth */}
    <path d="M18 32 L 30 31" stroke={INK} strokeWidth="2" strokeLinecap="round"/>
  </g>, size);

export const IconStressed = ({ size = 56 }) => wrap(
  <g>
    {/* Scribble cloud */}
    <path d="M8 24 Q 6 30 12 32 Q 10 38 18 38 Q 22 42 28 39 Q 36 41 38 34 Q 44 32 40 26 Q 42 20 34 19 Q 30 14 22 17 Q 14 15 12 21 Q 6 20 8 24 Z"
      fill={CORAL} stroke={INK} strokeWidth="2.2" filter="url(#grain)"/>
    {/* Tangled scribble in the middle */}
    <path d="M14 28 C 20 22, 22 34, 28 26 C 32 20, 34 32, 28 34 C 22 36, 18 32, 14 28 Z"
      stroke={INK} strokeWidth="1.5" fill="none"/>
    {/* Stressed eyes (Xs) */}
    <path d="M16 24 L 20 27 M 20 24 L 16 27" stroke={INK} strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M28 24 L 32 27 M 32 24 L 28 27" stroke={INK} strokeWidth="1.8" strokeLinecap="round"/>
  </g>, size);

export const IconTired = ({ size = 56 }) => wrap(
  <g>
    <circle cx="24" cy="24" r="17" fill={CREAM} stroke={INK} strokeWidth="2.2" filter="url(#grain)"/>
    {/* Droopy eyes */}
    <path d="M15 22 Q 18 25 21 22" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M27 22 Q 30 25 33 22" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    {/* Small yawn */}
    <ellipse cx="24" cy="32" rx="3" ry="2.5" fill={INK}/>
    {/* Little z */}
    <text x="34" y="14" fontFamily="Kalam" fontSize="12" fill={INK}>z</text>
    <text x="38" y="9" fontFamily="Kalam" fontSize="8" fill={INK}>z</text>
  </g>, size);

export const IconHyped = ({ size = 56 }) => wrap(
  <g>
    {/* Star burst */}
    <path d="M24 4 L 27 17 L 40 17 L 30 25 L 34 38 L 24 30 L 14 38 L 18 25 L 8 17 L 21 17 Z"
      fill={PEACH} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    {/* Happy face */}
    <path d="M19 22 Q 21 20 23 22" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M25 22 Q 27 20 29 22" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M20 27 Q 24 31 28 27" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
  </g>, size);

export const IconOverload = ({ size = 56 }) => wrap(
  <g>
    <circle cx="24" cy="26" r="15" fill={CORAL} stroke={INK} strokeWidth="2.2" filter="url(#grain)"/>
    {/* Frazzled hair spikes */}
    <path d="M14 15 L 12 8 M 20 12 L 20 6 M 26 12 L 27 6 M 33 15 L 36 9 M 37 20 L 42 18" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none"/>
    {/* Spiral eyes */}
    <circle cx="19" cy="24" r="2.5" fill="none" stroke={INK} strokeWidth="1.6"/>
    <path d="M19 24 L 19 22" stroke={INK} strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="29" cy="24" r="2.5" fill="none" stroke={INK} strokeWidth="1.6"/>
    <path d="M29 24 L 29 22" stroke={INK} strokeWidth="1.4" strokeLinecap="round"/>
    {/* Squiggle mouth */}
    <path d="M19 31 Q 22 28 24 31 T 29 31" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
  </g>, size);

export const IconCold = ({ size = 56 }) => wrap(
  <g>
    <circle cx="24" cy="24" r="17" fill="#C8DFF0" stroke={INK} strokeWidth="2.2" filter="url(#grain)"/>
    {/* Blue lips */}
    <ellipse cx="24" cy="32" rx="5" ry="1.6" fill={INK}/>
    {/* Shivering eyes */}
    <circle cx="18" cy="22" r="1.6" fill={INK}/>
    <circle cx="30" cy="22" r="1.6" fill={INK}/>
    {/* Snowflakes */}
    <path d="M6 12 L 10 12 M 8 10 L 8 14 M 6.5 10.5 L 9.5 13.5 M 9.5 10.5 L 6.5 13.5" stroke={INK} strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M38 8 L 42 8 M 40 6 L 40 10" stroke={INK} strokeWidth="1.4" strokeLinecap="round"/>
  </g>, size);

// ============ FACT REACTIONS ============

export const IconMindBlown = ({ size = 40 }) => wrap(
  <g>
    <circle cx="24" cy="26" r="14" fill={CORAL} stroke={INK} strokeWidth="2.2" filter="url(#grain)"/>
    {/* Wide eyes */}
    <circle cx="19" cy="24" r="2.8" fill={CREAM} stroke={INK} strokeWidth="1.6"/>
    <circle cx="19" cy="24" r="1.2" fill={INK}/>
    <circle cx="29" cy="24" r="2.8" fill={CREAM} stroke={INK} strokeWidth="1.6"/>
    <circle cx="29" cy="24" r="1.2" fill={INK}/>
    {/* Open mouth */}
    <ellipse cx="24" cy="32" rx="2.5" ry="3" fill={INK}/>
    {/* Explosion bits above */}
    <path d="M14 10 L 16 6 M 24 6 L 24 2 M 34 10 L 32 6 M 40 16 L 44 14 M 8 16 L 4 14" stroke={INK} strokeWidth="2" strokeLinecap="round"/>
  </g>, size);

export const IconKnewIt = ({ size = 40 }) => wrap(
  <g>
    <circle cx="24" cy="24" r="15" fill={SAGE} stroke={INK} strokeWidth="2.2" filter="url(#grain)"/>
    {/* Smug eyes — one raised brow */}
    <path d="M15 20 Q 18 17 22 19" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M17 24 L 20 24" stroke={INK} strokeWidth="2" strokeLinecap="round"/>
    <path d="M27 24 L 30 24" stroke={INK} strokeWidth="2" strokeLinecap="round"/>
    {/* Smirk */}
    <path d="M19 30 Q 25 34 30 29" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
  </g>, size);

export const IconHmm = ({ size = 40 }) => wrap(
  <g>
    <circle cx="24" cy="24" r="15" fill={PEACH} stroke={INK} strokeWidth="2.2" filter="url(#grain)"/>
    {/* Squint eyes */}
    <path d="M15 23 Q 18 21 21 23" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M27 22 L 32 24" stroke={INK} strokeWidth="1.8" strokeLinecap="round"/>
    {/* Thinking mouth (curved to side) */}
    <path d="M20 30 Q 24 32 28 30" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    {/* Thought bubble */}
    <circle cx="38" cy="10" r="3" fill={CREAM} stroke={INK} strokeWidth="1.6"/>
    <circle cx="34" cy="14" r="1.5" fill={CREAM} stroke={INK} strokeWidth="1.4"/>
  </g>, size);

// ============ POST REACTIONS (replaces 😂 ❤️ 👏 🔥) ============

export const IconLaugh = ({ size = 28 }) => wrap(
  <g>
    <circle cx="24" cy="24" r="16" fill={PEACH} stroke={INK} strokeWidth="2.2" filter="url(#grain)"/>
    <path d="M15 20 Q 18 17 21 20" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M27 20 Q 30 17 33 20" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M14 28 Q 24 40 34 28 Q 30 34 24 34 Q 18 34 14 28 Z" fill={INK} stroke={INK} strokeWidth="1.8" strokeLinejoin="round"/>
    <path d="M20 32 Q 24 34 28 32" stroke={CREAM} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
  </g>, size);

export const IconHeart = ({ size = 28 }) => wrap(
  <g>
    <path d="M24 40 C 8 30, 8 15, 16 12 C 20 10, 23 13, 24 16 C 25 13, 28 10, 32 12 C 40 15, 40 30, 24 40 Z"
      fill={CORAL} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    <path d="M17 18 Q 19 16 22 17" stroke={CREAM} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
  </g>, size);

export const IconClap = ({ size = 28 }) => wrap(
  <g>
    {/* Left hand */}
    <path d="M8 26 Q 6 22 10 20 L 18 18 L 20 24 Q 22 30 18 32 L 12 34 Q 8 32 8 26 Z"
      fill={PEACH} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    {/* Right hand */}
    <path d="M40 26 Q 42 22 38 20 L 30 18 L 28 24 Q 26 30 30 32 L 36 34 Q 40 32 40 26 Z"
      fill={PEACH} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    {/* Motion lines */}
    <path d="M14 12 L 12 8 M 24 8 L 24 4 M 34 12 L 36 8" stroke={INK} strokeWidth="1.8" strokeLinecap="round"/>
  </g>, size);

export const IconFire = ({ size = 28 }) => wrap(
  <g>
    <path d="M24 6 C 20 14, 14 16, 16 26 C 17 32, 12 34, 14 40 C 17 44, 30 44, 34 40 Q 38 32, 33 26 Q 36 20, 30 14 C 28 16, 26 12, 24 6 Z"
      fill={CORAL} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    <path d="M23 22 Q 20 28 22 34 Q 26 36 27 32 Q 27 26 23 22 Z" fill={PEACH} stroke={INK} strokeWidth="1.5"/>
  </g>, size);

// ============ NAV STAT ICONS ============

export const IconSeedling = ({ size = 20 }) => wrap(
  <g>
    <path d="M16 40 Q 14 32 16 24 Q 20 22 24 24 Q 26 28 24 34" stroke={INK} strokeWidth="2.2" fill={SAGE} strokeLinejoin="round" filter="url(#grain)"/>
    <path d="M24 24 Q 30 20 34 22 Q 30 28 26 26" fill={SAGE} stroke={INK} strokeWidth="2" strokeLinejoin="round"/>
    <path d="M16 40 L 16 44 M 20 40 L 20 44 M 24 40 L 24 44" stroke={INK} strokeWidth="1.4" strokeLinecap="round"/>
  </g>, size);

export const IconBolt = ({ size = 20 }) => wrap(
  <g>
    <path d="M22 4 L 12 24 L 20 24 L 16 44 L 32 20 L 22 20 L 26 4 Z"
      fill={PEACH} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
  </g>, size);

export const IconTrophy = ({ size = 20 }) => wrap(
  <g>
    <path d="M14 8 L 34 8 L 32 22 Q 24 30 16 22 Z" fill={PEACH} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    <path d="M14 12 Q 6 12 8 20 Q 10 24 14 22" fill={PEACH} stroke={INK} strokeWidth="2"/>
    <path d="M34 12 Q 42 12 40 20 Q 38 24 34 22" fill={PEACH} stroke={INK} strokeWidth="2"/>
    <path d="M20 30 L 20 38 L 28 38 L 28 30 M 16 40 L 32 40" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
  </g>, size);

// ============ QUICK ACTION ILLUSTRATIONS ============

export const IconWaterDrop = ({ size = 40 }) => wrap(
  <g>
    <path d="M24 4 C 20 14, 12 22, 14 32 C 16 40, 32 40, 34 32 C 36 22, 28 14, 24 4 Z"
      fill="#C8DFF0" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    <path d="M18 28 Q 20 24 22 26" stroke={CREAM} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
  </g>, size);

export const IconEye = ({ size = 40 }) => wrap(
  <g>
    <path d="M6 24 Q 24 10 42 24 Q 24 38 6 24 Z" fill={PEACH} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    <circle cx="24" cy="24" r="6" fill={INK}/>
    <circle cx="26" cy="22" r="1.5" fill={CREAM}/>
    <path d="M8 14 Q 6 12 4 10" stroke={INK} strokeWidth="1.4" strokeLinecap="round"/>
  </g>, size);

export const IconStretch = ({ size = 40 }) => wrap(
  <g>
    <circle cx="24" cy="10" r="4" fill={PEACH} stroke={INK} strokeWidth="2"/>
    <path d="M24 14 L 24 26 M 24 18 L 14 22 M 24 18 L 34 22 M 24 26 L 18 40 M 24 26 L 30 40"
      stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
    <path d="M10 20 Q 6 18 4 20" stroke={INK} strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M38 20 Q 42 18 44 20" stroke={INK} strokeWidth="1.6" strokeLinecap="round"/>
  </g>, size);

export const IconBreathe = ({ size = 40 }) => wrap(
  <g>
    <ellipse cx="24" cy="26" rx="14" ry="10" fill={SAGE} stroke={INK} strokeWidth="2.2" filter="url(#grain)"/>
    <path d="M14 16 Q 12 10 8 8" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M34 16 Q 36 10 40 8" stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M18 24 Q 21 22 24 24 Q 27 22 30 24" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
  </g>, size);

// ============ CARD CORNER DOODLES ============

export const IconLightbulb = ({ size = 60 }) => wrap(
  <g>
    <path d="M24 4 C 14 4, 10 14, 14 22 Q 18 28, 18 32 L 30 32 Q 30 28, 34 22 C 38 14, 34 4, 24 4 Z"
      fill={PEACH} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    <path d="M20 36 L 28 36 M 21 40 L 27 40" stroke={INK} strokeWidth="2" strokeLinecap="round"/>
    <path d="M22 12 Q 20 16 22 20" stroke={CREAM} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    {/* Light rays */}
    <path d="M6 12 L 10 14 M 42 12 L 38 14 M 24 -2 L 24 2" stroke={INK} strokeWidth="1.6" strokeLinecap="round"/>
  </g>, size);

export const IconBook = ({ size = 60 }) => wrap(
  <g>
    <path d="M6 10 Q 6 8 8 8 L 22 10 L 22 40 L 8 38 Q 6 38 6 36 Z" fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    <path d="M42 10 Q 42 8 40 8 L 26 10 L 26 40 L 40 38 Q 42 38 42 36 Z" fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    <path d="M10 16 L 18 17 M 10 20 L 18 21 M 10 24 L 16 25" stroke={INK} strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M30 16 L 38 17 M 30 20 L 38 21 M 30 24 L 36 25" stroke={INK} strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M24 10 L 24 40" stroke={INK} strokeWidth="1.6"/>
  </g>, size);

export const IconSparkle = ({ size = 40 }) => wrap(
  <g>
    <path d="M24 4 L 26 20 L 42 24 L 26 28 L 24 44 L 22 28 L 6 24 L 22 20 Z"
      fill={PEACH} stroke={INK} strokeWidth="2" strokeLinejoin="round" filter="url(#grain)"/>
  </g>, size);

export const IconLeaf = ({ size = 40 }) => wrap(
  <g>
    <path d="M6 42 Q 4 26, 14 18 Q 26 8, 42 6 Q 40 22, 30 32 Q 20 42, 6 42 Z"
      fill={SAGE} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
    <path d="M8 40 Q 20 28 40 8" stroke={INK} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    <path d="M18 30 Q 24 28 30 22 M 14 34 Q 22 32 26 28" stroke={INK} strokeWidth="1.2" fill="none" strokeLinecap="round"/>
  </g>, size);

export const IconCloud = ({ size = 40 }) => wrap(
  <g>
    <path d="M10 30 Q 4 30, 6 24 Q 6 18, 14 18 Q 16 12, 24 14 Q 32 10, 36 18 Q 44 18, 42 26 Q 44 32, 36 32 Z"
      fill={CREAM} stroke={INK} strokeWidth="2.2" strokeLinejoin="round" filter="url(#grain)"/>
  </g>, size);

// Wobbly frame border (used to wrap key cards)
export const WobblyFrame = ({ children, className = "", stroke = INK }) => (
  <div className={`relative ${className}`}>
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M2,4 C 2,2.5 3,2 5,2 L 50,2.5 L 95,2 C 97,2 98,2.8 98.3,4.5 L 98.5,50 L 98,95 C 98,97 97,98 95.2,98.3 L 50,98 L 4.8,98.2 C 3,98 2,97 2,95.2 L 2.3,50 Z"
        fill="none"
        stroke={stroke}
        strokeWidth="0.4"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
    <div className="relative">{children}</div>
  </div>
);

// Small hand-drawn divider (a squiggly line)
export const InkDivider = ({ width = 120 }) => (
  <svg width={width} height="12" viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="my-2">
    <path d="M2 6 Q 15 2, 30 6 T 60 6 T 90 6 T 118 6"
      stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
  </svg>
);

// Map mood labels to icons for easy lookup
export const MOOD_ICONS = {
  Lit: IconLit, Zen: IconZen, Meh: IconMeh, Stressed: IconStressed,
  Tired: IconTired, Hyped: IconHyped, Overload: IconOverload, Cold: IconCold,
};
