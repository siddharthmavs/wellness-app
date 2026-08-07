/**
 * Central configuration for the platformer. Every tunable lives here so
 * nothing is hardcoded inside scenes/entities.
 */

export const GAME_ID = "trickstep";
export const GAME_TITLE = "TRICKSTEP";

/** Base logical resolution; Phaser scales it to fit the container. */
export const VIEW = {
  width: 960,
  height: 544,
} as const;

export const TILE = 32;

export const PHYSICS = {
  gravityY: 1700,
  runSpeed: 230,
  groundAccel: 2600,
  airAccel: 1700,
  jumpVelocity: 620,
  /** Multiplier applied to upward velocity when jump is released early. */
  jumpCutFactor: 0.45,
  coyoteMs: 90,
  jumpBufferMs: 130,
  maxFallSpeed: 900,
  /** Fall speed above which landing plays dust + squash. */
  hardLandSpeed: 520,
} as const;

export const TIMING = {
  deathFreezeMs: 380, // death animation budget (< 500ms per spec)
  spikeEmergeMs: 110,
  fallWobbleMs: 340,
  fallFadeMs: 700,
  doorOpenMs: 260,
  winWalkMs: 420,
  crusherSlamMs: 150,
  crusherHoldMs: 420,
  crusherRiseMs: 800,
} as const;

export const SCENES = {
  boot: "boot",
  select: "select",
  game: "game",
  hud: "hud",
} as const;

/** game.registry keys shared between scenes / React shell. */
export const RK = {
  systems: "systems",
  darkMode: "darkMode",
  touchLeft: "touchLeft",
  touchRight: "touchRight",
  touchJump: "touchJump",
} as const;

/** Cross-scene event names (emitted on game.events). */
export const EV = {
  levelWin: "ts-level-win",
  checkpoint: "ts-checkpoint",
  fakeExit: "ts-fake-exit",
} as const;

export const DEPTH = {
  bgDecor: 0,
  door: 2,
  checkpoint: 3,
  tiles: 4,
  hazard: 5,
  mover: 6,
  player: 10,
  particles: 12,
  hud: 20,
  overlay: 30,
} as const;

export interface Palette {
  /** Unique key: used to know when generated textures must be rebuilt. */
  key: string;
  bg: number;
  bgDecor: number;
  platform: number;
  platformEdge: number;
  hazard: number;
  hazardDark: number;
  door: number;
  doorDark: number;
  doorGlow: number;
  checkpoint: number;
  player: number;
  dust: number;
  confetti: number[];
  text: string;
  textDim: string;
  panel: number;
  panelLine: number;
  focus: number;
}

/**
 * Colorblind-friendly palettes: hazards are always orange/amber, safety and
 * goals are always blue/cyan (blue-orange is distinguishable for the most
 * common color-vision deficiencies). High-contrast variants push everything
 * to near black/white with saturated accents.
 */
const LIGHT: Palette = {
  key: "light",
  bg: 0xf1f5f9,
  bgDecor: 0xe2e8f0,
  platform: 0x334155,
  platformEdge: 0x475569,
  hazard: 0xea580c,
  hazardDark: 0x9a3412,
  door: 0x2563eb,
  doorDark: 0x1e40af,
  doorGlow: 0x93c5fd,
  checkpoint: 0x0284c7,
  player: 0x0f172a,
  dust: 0x94a3b8,
  confetti: [0x2563eb, 0xea580c, 0x0ea5e9, 0xf59e0b],
  text: "#0f172a",
  textDim: "#64748b",
  panel: 0xffffff,
  panelLine: 0x0f172a,
  focus: 0x2563eb,
};

const DARK: Palette = {
  key: "dark",
  bg: 0x0b1220,
  bgDecor: 0x16213a,
  platform: 0x8ea3c2,
  platformEdge: 0xb6c6de,
  hazard: 0xfb923c,
  hazardDark: 0xc2540a,
  door: 0x60a5fa,
  doorDark: 0x3b82f6,
  doorGlow: 0x1d4ed8,
  checkpoint: 0x38bdf8,
  player: 0xf8fafc,
  dust: 0x64748b,
  confetti: [0x60a5fa, 0xfb923c, 0x38bdf8, 0xfbbf24],
  text: "#f1f5f9",
  textDim: "#94a3b8",
  panel: 0x111c30,
  panelLine: 0xf1f5f9,
  focus: 0x60a5fa,
};

const LIGHT_HC: Palette = {
  ...LIGHT,
  key: "light-hc",
  bg: 0xffffff,
  bgDecor: 0xf1f1f1,
  platform: 0x000000,
  platformEdge: 0x333333,
  hazard: 0xd90429,
  hazardDark: 0x8a021a,
  door: 0x0033cc,
  doorDark: 0x001f80,
  doorGlow: 0x99bbff,
  checkpoint: 0x0066ff,
  player: 0x000000,
  dust: 0x777777,
  text: "#000000",
  textDim: "#444444",
  panel: 0xffffff,
  panelLine: 0x000000,
  focus: 0x0033cc,
};

const DARK_HC: Palette = {
  ...DARK,
  key: "dark-hc",
  bg: 0x000000,
  bgDecor: 0x14141a,
  platform: 0xffffff,
  platformEdge: 0xcccccc,
  hazard: 0xffe600,
  hazardDark: 0xb3a100,
  door: 0x00e5ff,
  doorDark: 0x00a8bb,
  doorGlow: 0x006677,
  checkpoint: 0x00e5ff,
  player: 0xffffff,
  dust: 0x999999,
  text: "#ffffff",
  textDim: "#bbbbbb",
  panel: 0x000000,
  panelLine: 0xffffff,
  focus: 0x00e5ff,
};

export function paletteFor(dark: boolean, highContrast: boolean): Palette {
  if (highContrast) return dark ? DARK_HC : LIGHT_HC;
  return dark ? DARK : LIGHT;
}

export function hexStr(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export const FONTS = {
  display: '"Space Grotesk", "Inter", sans-serif',
  body: '"Inter", sans-serif',
} as const;
