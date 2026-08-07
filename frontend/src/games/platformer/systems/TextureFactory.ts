import Phaser from "phaser";
import { Palette, TILE } from "../config/constants";

/**
 * All game art is generated at runtime from the active palette: flat
 * shapes drawn once into textures (and the whole player animation set into
 * a single canvas atlas). Zero downloads, crisp at any DPI, and instantly
 * re-themeable for dark mode / high contrast.
 */

export const TEX = {
  tile: "ts-tile",
  mover: "ts-mover",
  spike: "ts-spike",
  saw: "ts-saw",
  crusher: "ts-crusher",
  door: "ts-door",
  doorOpen: "ts-door-open",
  checkpoint: "ts-checkpoint",
  checkpointActive: "ts-checkpoint-active",
  particle: "ts-particle",
  dust: "ts-dust",
  player: "ts-player",
} as const;

export const ANIM = {
  idle: "ts-anim-idle",
  run: "ts-anim-run",
  jump: "ts-anim-jump",
  fall: "ts-anim-fall",
  win: "ts-anim-win",
} as const;

export const PLAYER_FRAME = { w: 24, h: 32 } as const;
export const DOOR_SIZE = { w: 44, h: 60 } as const;
export const SAW_RADIUS = 15;

/** Tracks which palette the current textures were built from. */
let builtPaletteKey: string | null = null;

export function texturesNeedRebuild(palette: Palette): boolean {
  return builtPaletteKey !== palette.key;
}

export function buildTextures(scene: Phaser.Scene, palette: Palette): void {
  if (!texturesNeedRebuild(palette) && scene.textures.exists(TEX.tile)) return;
  removeAll(scene);
  buildTile(scene, palette);
  buildMover(scene, palette);
  buildSpike(scene, palette);
  buildSaw(scene, palette);
  buildCrusher(scene, palette);
  buildDoors(scene, palette);
  buildCheckpoints(scene, palette);
  buildParticles(scene, palette);
  buildPlayerAtlas(scene, palette);
  registerAnimations(scene);
  builtPaletteKey = palette.key;
}

/** Reset module state when a game instance is destroyed. */
export function resetTextureCache(): void {
  builtPaletteKey = null;
}

function removeAll(scene: Phaser.Scene): void {
  Object.values(TEX).forEach((key) => {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  });
  Object.values(ANIM).forEach((key) => {
    if (scene.anims.exists(key)) scene.anims.remove(key);
  });
}

function g(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.make.graphics({ x: 0, y: 0 }, false);
}

function buildTile(scene: Phaser.Scene, p: Palette): void {
  const gr = g(scene);
  gr.fillStyle(p.platform, 1);
  gr.fillRect(0, 0, TILE, TILE);
  gr.fillStyle(p.platformEdge, 1);
  gr.fillRect(0, 0, TILE, 3);
  gr.fillStyle(0x000000, 0.12);
  gr.fillRect(0, TILE - 3, TILE, 3);
  gr.generateTexture(TEX.tile, TILE, TILE);
  gr.destroy();
}

function buildMover(scene: Phaser.Scene, p: Palette): void {
  const w = TILE * 3;
  const h = 20;
  const gr = g(scene);
  gr.fillStyle(p.platformEdge, 1);
  gr.fillRoundedRect(0, 0, w, h, 6);
  gr.fillStyle(p.platform, 1);
  gr.fillRoundedRect(0, 3, w, h - 3, 6);
  gr.generateTexture(TEX.mover, w, h);
  gr.destroy();
}

function buildSpike(scene: Phaser.Scene, p: Palette): void {
  const gr = g(scene);
  // two teeth per tile read better at small sizes than one big triangle
  gr.fillStyle(p.hazard, 1);
  gr.fillTriangle(1, TILE, 8, TILE - 15, 15, TILE);
  gr.fillTriangle(17, TILE, 24, TILE - 15, 31, TILE);
  gr.fillStyle(p.hazardDark, 1);
  gr.fillTriangle(8, TILE - 15, 11, TILE - 8, 5, TILE - 8);
  gr.fillTriangle(24, TILE - 15, 27, TILE - 8, 21, TILE - 8);
  gr.generateTexture(TEX.spike, TILE, TILE);
  gr.destroy();
}

function buildSaw(scene: Phaser.Scene, p: Palette): void {
  const r = SAW_RADIUS;
  const size = r * 2 + 6;
  const c = size / 2;
  const gr = g(scene);
  gr.fillStyle(p.hazard, 1);
  gr.fillCircle(c, c, r);
  gr.fillStyle(p.hazardDark, 1);
  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    gr.fillCircle(c + Math.cos(a) * (r - 2), c + Math.sin(a) * (r - 2), 2.6);
  }
  gr.fillStyle(p.bg, 1);
  gr.fillCircle(c, c, 4);
  gr.generateTexture(TEX.saw, size, size);
  gr.destroy();
}

function buildCrusher(scene: Phaser.Scene, p: Palette): void {
  const w = TILE * 2;
  const h = TILE + 12;
  const gr = g(scene);
  gr.fillStyle(p.platformEdge, 1);
  gr.fillRect(0, 0, w, h - 10);
  gr.fillStyle(p.platform, 1);
  gr.fillRect(2, 2, w - 4, h - 14);
  gr.fillStyle(p.hazard, 1);
  const teeth = 4;
  const tw = w / teeth;
  for (let i = 0; i < teeth; i++) {
    gr.fillTriangle(i * tw, h - 10, i * tw + tw / 2, h, (i + 1) * tw, h - 10);
  }
  gr.generateTexture(TEX.crusher, w, h);
  gr.destroy();
}

function buildDoors(scene: Phaser.Scene, p: Palette): void {
  const { w, h } = DOOR_SIZE;
  const closed = g(scene);
  closed.fillStyle(p.doorDark, 1);
  closed.fillRoundedRect(0, 0, w, h, { tl: 10, tr: 10, bl: 0, br: 0 });
  closed.fillStyle(p.door, 1);
  closed.fillRoundedRect(4, 4, w - 8, h - 4, { tl: 8, tr: 8, bl: 0, br: 0 });
  closed.fillStyle(p.doorGlow, 1);
  closed.fillCircle(w - 12, h / 2 + 2, 3); // handle
  closed.fillRoundedRect(10, 10, w - 20, 12, 4); // window
  closed.generateTexture(TEX.door, w, h);
  closed.destroy();

  const open = g(scene);
  open.fillStyle(p.doorDark, 1);
  open.fillRoundedRect(0, 0, w, h, { tl: 10, tr: 10, bl: 0, br: 0 });
  open.fillStyle(p.doorGlow, 1);
  open.fillRoundedRect(5, 5, w - 10, h - 5, { tl: 7, tr: 7, bl: 0, br: 0 });
  open.fillStyle(p.door, 1);
  open.fillRect(4, 0, 10, h); // door panel swung to the jamb
  open.generateTexture(TEX.doorOpen, w, h);
  open.destroy();
}

function buildCheckpoints(scene: Phaser.Scene, p: Palette): void {
  const w = 26;
  const h = 48;
  const make = (key: string, active: boolean) => {
    const gr = g(scene);
    gr.fillStyle(p.platformEdge, 1);
    gr.fillRoundedRect(2, 0, 4, h, 2); // pole
    gr.fillStyle(active ? p.checkpoint : p.dust, 1);
    if (active) gr.fillTriangle(6, 2, 6, 18, w, 10);
    else gr.fillTriangle(6, 26, 6, 40, w - 6, 33);
    gr.generateTexture(key, w, h);
    gr.destroy();
  };
  make(TEX.checkpoint, false);
  make(TEX.checkpointActive, true);
}

function buildParticles(scene: Phaser.Scene, p: Palette): void {
  const sq = g(scene);
  sq.fillStyle(0xffffff, 1);
  sq.fillRect(0, 0, 6, 6);
  sq.generateTexture(TEX.particle, 6, 6);
  sq.destroy();

  const dot = g(scene);
  dot.fillStyle(p.dust, 1);
  dot.fillCircle(3, 3, 3);
  dot.generateTexture(TEX.dust, 6, 6);
  dot.destroy();
}

/* ------------------------------------------------------------------ */
/* Player: a small stickman, all frames packed into one canvas atlas.  */
/* ------------------------------------------------------------------ */

interface Pose {
  name: string;
  headBob?: number;
  arms: [number, number, number, number][]; // pairs of line endpoints from shoulder
  legs: [number, number, number, number][];
}

const POSES: Pose[] = [
  { name: "idle-0", arms: [[12, 13, 8, 20], [12, 13, 16, 20]], legs: [[12, 21, 9, 30], [12, 21, 15, 30]] },
  { name: "idle-1", headBob: 1, arms: [[12, 14, 8, 20], [12, 14, 16, 20]], legs: [[12, 21, 9, 30], [12, 21, 15, 30]] },
  { name: "run-0", arms: [[12, 13, 6, 17], [12, 13, 18, 18]], legs: [[12, 21, 5, 29], [12, 21, 18, 27]] },
  { name: "run-1", arms: [[12, 13, 9, 19], [12, 13, 15, 19]], legs: [[12, 21, 9, 30], [12, 21, 14, 29]] },
  { name: "run-2", arms: [[12, 13, 18, 17], [12, 13, 6, 18]], legs: [[12, 21, 19, 29], [12, 21, 6, 27]] },
  { name: "run-3", arms: [[12, 13, 15, 19], [12, 13, 9, 19]], legs: [[12, 21, 15, 30], [12, 21, 10, 29]] },
  { name: "jump", arms: [[12, 13, 5, 7], [12, 13, 19, 7]], legs: [[12, 21, 8, 26], [12, 21, 16, 26]] },
  { name: "fall", arms: [[12, 13, 4, 10], [12, 13, 20, 10]], legs: [[12, 21, 7, 29], [12, 21, 17, 29]] },
  { name: "win-0", arms: [[12, 13, 5, 5], [12, 13, 19, 5]], legs: [[12, 21, 9, 30], [12, 21, 15, 30]] },
  { name: "win-1", arms: [[12, 13, 7, 8], [12, 13, 17, 4]], legs: [[12, 21, 9, 30], [12, 21, 15, 30]] },
];

function buildPlayerAtlas(scene: Phaser.Scene, p: Palette): void {
  const { w, h } = { w: PLAYER_FRAME.w, h: PLAYER_FRAME.h };
  const canvasTexture = scene.textures.createCanvas(TEX.player, w * POSES.length, h);
  if (!canvasTexture) return;
  const ctx = canvasTexture.getContext();
  const color = Phaser.Display.Color.IntegerToColor(p.player).rgba;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";

  POSES.forEach((pose, i) => {
    const ox = i * w;
    const bob = pose.headBob ?? 0;
    ctx.beginPath();
    ctx.arc(ox + 12, 6.5 + bob, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ox + 12, 11 + bob);
    ctx.lineTo(ox + 12, 21);
    ctx.stroke();
    [...pose.arms, ...pose.legs].forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath();
      ctx.moveTo(ox + x1, y1 + (y1 < 21 ? bob : 0));
      ctx.lineTo(ox + x2, y2);
      ctx.stroke();
    });
    canvasTexture.add(pose.name, 0, ox, 0, w, h);
  });
  canvasTexture.refresh();
}

function registerAnimations(scene: Phaser.Scene): void {
  const frames = (names: string[]) =>
    names.map((frame) => ({ key: TEX.player, frame }));
  scene.anims.create({ key: ANIM.idle, frames: frames(["idle-0", "idle-1"]), frameRate: 2, repeat: -1 });
  scene.anims.create({ key: ANIM.run, frames: frames(["run-0", "run-1", "run-2", "run-3"]), frameRate: 11, repeat: -1 });
  scene.anims.create({ key: ANIM.jump, frames: frames(["jump"]), frameRate: 1 });
  scene.anims.create({ key: ANIM.fall, frames: frames(["fall"]), frameRate: 1 });
  scene.anims.create({ key: ANIM.win, frames: frames(["win-0", "win-1"]), frameRate: 5, repeat: -1 });
}
