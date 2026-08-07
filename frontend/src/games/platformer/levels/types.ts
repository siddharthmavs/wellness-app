/**
 * Config-driven level format. Levels are ASCII grids plus optional
 * dynamic-object configs (movers, saws, crushers, timed spikes) and a
 * scripted trap-event list for the "unexpected but fair" moments.
 *
 * Grid symbols:
 *   .  empty
 *   X  solid block
 *   S  spike, pointing up
 *   v  spike, pointing down (ceiling)
 *   H  hidden spike — emerges when the player gets close
 *   F  falling platform — wobbles, then collapses when stood on
 *   K  fake floor — looks identical to X, vanishes the instant it's touched
 *   I  invisible bridge — solid but unseen; faintly revealed on first touch
 *   D  exit door (drawn with its base on this tile)
 *   E  fake exit door — poofs away when reached
 *   P  player spawn
 *   C  checkpoint
 */

export interface TilePos {
  x: number;
  y: number;
}

/** Moving platform. Travels from (x,y) by (dx,dy) tiles and yoyos forever. */
export interface MoverConfig {
  x: number;
  y: number;
  widthTiles: number;
  dx: number;
  dy: number;
  durationMs: number;
  delayMs?: number;
}

/** Rotating saw hazard. orbitTiles 0 = spins in place at (cx,cy). */
export interface SawConfig {
  cx: number;
  cy: number;
  orbitTiles: number;
  /** radians per second; sign controls direction */
  speed: number;
  /** starting angle in radians */
  startAngle?: number;
}

export interface CrusherConfig {
  x: number;
  y: number;
  widthTiles: number;
  dropTiles: number;
  mode: "cycle" | "trigger";
  /** for cycle mode: full loop period */
  periodMs?: number;
  /** for cycle mode: phase offset */
  offsetMs?: number;
  /** for trigger mode: horizontal padding (px) around the drop zone */
  triggerPad?: number;
}

/** Spikes that pop out of the floor on a repeating schedule. */
export interface TimedSpikeConfig {
  at: TilePos[];
  periodMs: number;
  offsetMs?: number;
  /** how long the spikes stay out each cycle */
  upMs?: number;
}

export interface AreaTrigger {
  kind: "area";
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TrapTrigger = AreaTrigger;

export type TrapAction =
  | { kind: "emergeSpikes"; at: TilePos[]; dir?: "up" | "down" }
  | { kind: "removeTiles"; at: TilePos[] }
  | { kind: "raiseWall"; at: TilePos[] }
  | { kind: "flipGravity" }
  | { kind: "shake"; intensity?: number };

export interface TrapEvent {
  trigger: TrapTrigger;
  actions: TrapAction[];
}

export interface LevelConfig {
  id: number;
  name: string;
  /** short teaching hint shown at level start */
  hint?: string;
  grid: string[];
  movers?: MoverConfig[];
  saws?: SawConfig[];
  crushers?: CrusherConfig[];
  timedSpikes?: TimedSpikeConfig[];
  events?: TrapEvent[];
  /** where the real door appears after the fake exit (E) poofs */
  fakeExitReveal?: TilePos;
}

/** Runtime data passed between GameScene restarts (deaths, checkpoints). */
export interface LevelRunState {
  levelId: number;
  spawn?: TilePos;
  elapsedMs: number;
  attempts: number;
}
