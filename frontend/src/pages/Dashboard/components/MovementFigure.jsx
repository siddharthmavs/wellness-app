import React from "react";

/*
 * Looping demonstration figures for the guided Move Break, drawn in the same
 * ink-line style as components/HandDrawn. Motion is pure CSS (MoveBreakSession.css,
 * `.mf-*` rules); with `animate` false the figure holds a representative pose, which
 * doubles as the reduced-motion illustration.
 */

const Ink = ({ children }) => (
  <g fill="none" stroke="var(--mbs-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </g>
);

const Head = ({ cx = 100, cy = 42 }) => (
  <>
    <circle cx={cx} cy={cy} r="15" fill="var(--mbs-skin)" />
    <path d={`M${cx - 5} ${cy + 3} q5 4 10 0`} strokeWidth="2.5" />
    <circle cx={cx - 5} cy={cy - 3} r="1.6" fill="var(--mbs-ink)" stroke="none" />
    <circle cx={cx + 5} cy={cy - 3} r="1.6" fill="var(--mbs-ink)" stroke="none" />
  </>
);

const Legs = () => (
  <>
    <path d="M100 122 L88 172" />
    <path d="M100 122 L112 172" />
    <path d="M80 174 h12 M108 174 h12" />
  </>
);

function Hand({ x, y, flip = false }) {
  const s = flip ? -1 : 1;
  const fingers = [-26, -12, 0, 12, 24];
  return (
    <g transform={`translate(${x} ${y}) scale(${s} 1)`}>
      <rect x="-20" y="0" width="40" height="44" rx="14" fill="var(--mbs-skin)" />
      {fingers.map((a, i) => (
        <g key={a} className={`mf-finger mf-finger-${i}`} style={{ "--a": `${a}deg` }}>
          <path d={`M${-15 + i * 7.5} 4 L${-15 + i * 7.5} -26`} />
        </g>
      ))}
      <path className="mf-thumb" d="M20 26 L36 12" />
    </g>
  );
}

function HandStretch() {
  return (
    <Ink>
      <g className="mf-hands">
        <Hand x={62} y={98} />
        <Hand x={138} y={98} flip />
      </g>
      <path d="M62 142 L62 180 M138 142 L138 180" />
    </Ink>
  );
}

function WristRotation() {
  return (
    <Ink>
      <path d="M22 120 L112 120" strokeWidth="14" stroke="var(--mbs-sleeve)" />
      <path d="M22 120 L112 120" />
      <g className="mf-wrist">
        <rect x="112" y="100" width="44" height="40" rx="14" fill="var(--mbs-skin)" />
        <path d="M156 106 h16 M156 114 h20 M156 122 h20 M156 130 h16" />
      </g>
      <circle cx="112" cy="120" r="4" fill="var(--mbs-ink)" stroke="none" />
      <path className="mf-orbit" d="M134 84 a38 38 0 1 1 -1 0" strokeWidth="2" strokeDasharray="4 8" opacity="0.5" />
    </Ink>
  );
}

function ShoulderRoll() {
  return (
    <Ink>
      <path d="M100 70 L100 122" />
      <Legs />
      <g className="mf-shoulders">
        <path d="M74 72 Q100 64 126 72" />
        <path d="M74 72 L66 104 L64 132" />
        <path d="M126 72 L134 104 L136 132" />
        <path className="mf-arc" d="M60 58 q-10 16 6 26 M140 58 q10 16 -6 26" strokeWidth="2.5" opacity="0.55" />
      </g>
      <Head />
      <path d="M100 57 L100 70" />
    </Ink>
  );
}

function NeckStretch() {
  return (
    <Ink>
      <path d="M100 72 L100 122" />
      <path d="M74 74 Q100 66 126 74" />
      <path d="M74 74 L68 106 L66 134 M126 74 L132 106 L134 134" />
      <Legs />
      <g className="mf-neck">
        <path d="M100 58 L100 72" />
        <Head />
      </g>
    </Ink>
  );
}

function SideStretch() {
  return (
    <Ink>
      <Legs />
      <g className="mf-lean">
        <path d="M100 70 L100 122" />
        <path d="M76 72 Q100 64 124 72" />
        <path d="M76 72 L70 104 L72 124" />
        <path d="M124 72 L132 44 L126 12" />
        <path d="M100 57 L100 70" />
        <Head />
      </g>
    </Ink>
  );
}

function UpperBodyStretch() {
  return (
    <Ink>
      <Legs />
      <g className="mf-round">
        <path d="M100 70 Q108 96 100 122" />
        <path d="M100 57 L100 70" />
        <Head />
        <g className="mf-press">
          <path d="M100 74 L136 92 L166 92" />
          <path d="M100 80 L136 100 L166 96" />
          <circle cx="170" cy="94" r="7" fill="var(--mbs-skin)" />
        </g>
      </g>
    </Ink>
  );
}

function Celebrate() {
  return (
    <Ink>
      <path d="M100 70 L100 122" />
      <Legs />
      <g className="mf-cheer">
        <path d="M76 72 Q100 64 124 72" />
        <path d="M76 72 L62 44 L54 18" />
        <path d="M124 72 L138 44 L146 18" />
      </g>
      <path d="M100 57 L100 70" />
      <Head />
      <g className="mf-sparkles" strokeWidth="3">
        <path d="M34 34 v14 M27 41 h14" />
        <path d="M166 30 v12 M160 36 h12" />
        <path d="M172 96 v10 M167 101 h10" />
      </g>
    </Ink>
  );
}

const FIGURES = {
  hand_stretch: HandStretch,
  wrist_rotation: WristRotation,
  shoulder_roll: ShoulderRoll,
  neck_stretch: NeckStretch,
  side_stretch: SideStretch,
  upper_body_stretch: UpperBodyStretch,
  celebrate: Celebrate,
};

export default function MovementFigure({ exercise, animate, phase }) {
  const Figure = FIGURES[exercise] || ShoulderRoll;
  return (
    <svg
      className={`mf ${animate ? "mf-animate" : "mf-still"} mf-phase-${(phase || "").toLowerCase()}`}
      viewBox="0 0 200 200"
      width="100%"
      height="100%"
      role="img"
      aria-label={`${phase || "Movement"} demonstration`}
    >
      <ellipse cx="100" cy="182" rx="62" ry="7" fill="var(--mbs-shadow)" />
      <Figure />
    </svg>
  );
}
