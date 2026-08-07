import { LevelConfig } from "./types";

/**
 * Original level designs for Trickstep. Grids are built from small string
 * helpers so widths stay exact; the LevelBuilder validates every row.
 *
 * Difficulty arc:
 *   1 movement tutorial → 2 spikes → 3 moving platforms → 4 falling floors
 *   → 5 hidden spikes + fake floor → 6 trapdoors / sliding walls / invisible
 *   bridge → 7 crushers / timed spikes / saws → 8 fake exit + gravity flip.
 */

const d = (n: number): string => ".".repeat(n);
const x = (n: number): string => "X".repeat(n);
const s = (n: number): string => "S".repeat(n);
const k = (n: number): string => "K".repeat(n);

const LEVEL_1: LevelConfig = {
  id: 1,
  name: "First Steps",
  hint: "Move with ← → or A D. Jump with Space, W or ↑.",
  grid: [
    d(44), d(44), d(44), d(44), d(44), d(44), d(44), d(44),
    d(44), d(44), d(44), d(44), d(44), d(44),
    ".." + "P" + d(15) + "XX" + d(20) + "D" + d(3),
    x(12) + ".." + x(12) + "..." + x(15),
    x(12) + ".." + x(12) + "..." + x(15),
  ],
};

const LEVEL_2: LevelConfig = {
  id: 2,
  name: "A Pointy Situation",
  hint: "Spikes hurt. Jump them.",
  grid: [
    d(48), d(48), d(48), d(48), d(48), d(48), d(48), d(48),
    d(48), d(48), d(48), d(48), d(48),
    d(31) + x(3) + d(14),
    ".." + "P" + d(7) + s(2) + d(8) + s(3) + d(7) + s(5) + d(10) + "D" + d(2),
    x(48),
    x(48),
  ],
  events: [
    {
      // a first taste of "the level fights back": spikes pop up ahead,
      // far enough away to react to
      trigger: { kind: "area", x: 38, y: 10, w: 1, h: 5 },
      actions: [
        { kind: "emergeSpikes", at: [{ x: 42, y: 14 }, { x: 43, y: 14 }] },
        { kind: "shake", intensity: 0.003 },
      ],
    },
  ],
};

const LEVEL_3: LevelConfig = {
  id: 3,
  name: "Going Places",
  hint: "Ride the platforms. Mind the gap.",
  grid: [
    d(56), d(56), d(56), d(56), d(56), d(56), d(56),
    d(47) + "D" + d(8),
    d(40) + x(10) + d(6),
    d(56), d(56), d(56), d(56), d(56),
    ".." + "P" + d(53),
    x(12) + d(16) + x(28),
    x(12) + d(16) + x(28),
  ],
  movers: [
    { x: 12, y: 13, widthTiles: 3, dx: 6, dy: 0, durationMs: 2200 },
    { x: 21, y: 13, widthTiles: 3, dx: 4, dy: 0, durationMs: 1800, delayMs: 400 },
    { x: 36, y: 14, widthTiles: 3, dx: 0, dy: -6, durationMs: 2400 },
  ],
};

const LEVEL_4: LevelConfig = {
  id: 4,
  name: "Short-Term Support",
  hint: "These platforms have commitment issues. Keep moving.",
  grid: [
    d(56), d(56), d(56), d(56), d(56), d(56), d(56), d(56),
    d(56), d(56), d(56), d(56), d(56),
    d(10) + "FF..FF..FF" + d(10) + "FF..FF..FF..FF..FF" + d(8),
    ".." + "P" + d(21) + "C" + d(28) + "D" + d(2),
    x(8) + s(14) + x(6) + s(22) + x(6),
    x(56),
  ],
};

const LEVEL_5: LevelConfig = {
  id: 5,
  name: "Trust Issues",
  hint: "This floor seems... nervous.",
  grid: [
    d(56), d(56), d(56), d(56), d(56), d(56), d(56), d(56),
    d(56), d(56), d(56), d(56),
    d(37) + x(6) + d(13),
    d(56),
    ".." + "P" + d(9) + "HH" + d(6) + "X" + "HH" + d(9) + "C" + "." + "XX" + d(12) + "HH" + d(3) + "D" + d(2),
    x(36) + k(6) + x(14),
    x(36) + k(6) + x(14),
  ],
};

const LEVEL_6: LevelConfig = {
  id: 6,
  name: "The Floor Is a Lie",
  hint: "Seeing isn't everything.",
  grid: [
    d(60), d(60), d(60), d(60), d(60), d(60), d(60), d(60), d(60),
    d(40) + x(13) + d(7),
    d(44) + "vvv" + d(13),
    d(60), d(60), d(60),
    ".." + "P" + d(21) + "C" + d(19) + x(2) + d(10) + "D" + d(3),
    x(15) + "IIIII" + x(40),
    x(15) + d(5) + x(40),
  ],
  events: [
    {
      trigger: { kind: "area", x: 8, y: 12, w: 1, h: 4 },
      actions: [
        { kind: "removeTiles", at: [{ x: 3, y: 15 }, { x: 4, y: 15 }, { x: 5, y: 15 }, { x: 6, y: 15 }, { x: 3, y: 16 }, { x: 4, y: 16 }, { x: 5, y: 16 }, { x: 6, y: 16 }] },
        { kind: "shake", intensity: 0.004 },
      ],
    },
    {
      trigger: { kind: "area", x: 29, y: 10, w: 1, h: 6 },
      actions: [
        { kind: "removeTiles", at: [{ x: 33, y: 15 }, { x: 34, y: 15 }, { x: 35, y: 15 }, { x: 33, y: 16 }, { x: 34, y: 16 }, { x: 35, y: 16 }] },
        { kind: "raiseWall", at: [{ x: 28, y: 14 }, { x: 28, y: 13 }] },
        { kind: "shake", intensity: 0.006 },
      ],
    },
  ],
};

const LEVEL_7: LevelConfig = {
  id: 7,
  name: "Under Pressure",
  hint: "Timing is everything.",
  grid: [
    d(60), d(60), d(60), d(60), d(60), d(60), d(60), d(60), d(60),
    d(4) + x(17) + d(39),
    d(60), d(60), d(60), d(60),
    ".." + "P" + d(29) + "C" + d(24) + "D" + d(2),
    x(36) + d(3) + x(21),
    x(36) + d(3) + x(21),
  ],
  crushers: [
    { x: 7, y: 10, widthTiles: 2, dropTiles: 4, mode: "trigger" },
    { x: 13, y: 10, widthTiles: 2, dropTiles: 4, mode: "trigger" },
    { x: 18, y: 10, widthTiles: 2, dropTiles: 4, mode: "cycle", periodMs: 2200, offsetMs: 300 },
  ],
  timedSpikes: [
    {
      at: [{ x: 24, y: 14 }, { x: 25, y: 14 }, { x: 26, y: 14 }, { x: 27, y: 14 }, { x: 28, y: 14 }],
      periodMs: 1500,
      upMs: 650,
    },
  ],
  saws: [
    { cx: 37.5, cy: 12, orbitTiles: 2.2, speed: 1.6 },
    { cx: 48, cy: 12.5, orbitTiles: 2.8, speed: -1.8 },
  ],
};

const LEVEL_8: LevelConfig = {
  id: 8,
  name: "Exit Strategy",
  hint: "That door looks a little too easy.",
  grid: [
    d(64), d(64), d(64),
    d(34) + x(20) + d(10),
    d(42) + "vv" + d(3) + "vv" + d(15),
    d(64), d(64), d(64), d(64),
    d(58) + x(2) + d(4),
    d(64), d(64), d(64),
    d(24) + "FF..FF..FF" + d(30),
    ".." + "P" + d(11) + "E" + d(5) + "HH" + d(13) + "C" + d(19) + "C" + d(8),
    x(24) + s(10) + x(30),
    x(64),
  ],
  fakeExitReveal: { x: 60, y: 14 },
  crushers: [
    { x: 58, y: 10, widthTiles: 2, dropTiles: 4, mode: "cycle", periodMs: 2000 },
  ],
  events: [
    {
      trigger: { kind: "area", x: 38, y: 8, w: 1, h: 8 },
      actions: [{ kind: "flipGravity" }, { kind: "shake", intensity: 0.006 }],
    },
    {
      trigger: { kind: "area", x: 52, y: 2, w: 1, h: 4 },
      actions: [{ kind: "flipGravity" }, { kind: "shake", intensity: 0.004 }],
    },
  ],
};

export const LEVELS: LevelConfig[] = [
  LEVEL_1,
  LEVEL_2,
  LEVEL_3,
  LEVEL_4,
  LEVEL_5,
  LEVEL_6,
  LEVEL_7,
  LEVEL_8,
];

export function levelById(id: number): LevelConfig {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level id: ${id}`);
  return level;
}
