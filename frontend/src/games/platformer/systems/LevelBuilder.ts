import Phaser from "phaser";
import { DEPTH, Palette, PHYSICS, TILE, TIMING } from "../config/constants";
import { LevelConfig, MoverConfig, TilePos } from "../levels/types";
import { DOOR_SIZE, TEX } from "./TextureFactory";

type StaticImage = Phaser.GameObjects.Image & {
  body: Phaser.Physics.Arcade.StaticBody;
};

export interface MoverRuntime {
  img: Phaser.Physics.Arcade.Image;
  prevX: number;
  prevY: number;
}

export interface SawRuntime {
  img: Phaser.GameObjects.Image;
  cx: number;
  cy: number;
  orbit: number;
  speed: number;
  angle: number;
}

export interface CrusherRuntime {
  img: Phaser.GameObjects.Image;
  restY: number;
  dropY: number;
  mode: "cycle" | "trigger";
  zone: Phaser.Geom.Rectangle;
  state: "armed" | "slamming" | "recovering";
}

export interface HiddenSpikeRuntime {
  img: Phaser.GameObjects.Image;
  killRect: Phaser.Geom.Rectangle;
  emerged: boolean;
  lethal: boolean;
}

export interface TimedSpikeRuntime {
  imgs: Phaser.GameObjects.Image[];
  killRects: Phaser.Geom.Rectangle[];
  lethal: boolean;
}

export interface DoorRuntime {
  img: Phaser.GameObjects.Image;
  enterRect: Phaser.Geom.Rectangle;
  fake: boolean;
  consumed: boolean;
}

export interface CheckpointRuntime {
  img: Phaser.GameObjects.Image;
  rect: Phaser.Geom.Rectangle;
  tile: TilePos;
  active: boolean;
}

export interface FallerRuntime {
  img: Phaser.Physics.Arcade.Image;
  state: "idle" | "wobbling" | "falling";
}

export interface BuiltLevel {
  widthPx: number;
  heightPx: number;
  spawn: TilePos;
  solids: Phaser.Physics.Arcade.StaticGroup;
  invisibles: Phaser.Physics.Arcade.StaticGroup;
  fakes: Phaser.Physics.Arcade.StaticGroup;
  fallerGroup: Phaser.Physics.Arcade.Group;
  fallers: Map<Phaser.GameObjects.GameObject, FallerRuntime>;
  fakeGroupIds: Map<Phaser.GameObjects.GameObject, number>;
  fakeGroups: Map<number, StaticImage[]>;
  removableTiles: Map<string, StaticImage>;
  movers: MoverRuntime[];
  saws: SawRuntime[];
  crushers: CrusherRuntime[];
  hiddenSpikes: HiddenSpikeRuntime[];
  timedSpikes: TimedSpikeRuntime[];
  staticKillRects: Phaser.Geom.Rectangle[];
  doors: DoorRuntime[];
  checkpoints: CheckpointRuntime[];
}

const INVISIBLE_IDLE_ALPHA = 0.07;
const INVISIBLE_REVEALED_ALPHA = 0.35;

/**
 * Turns a LevelConfig into physics groups, hazards and interactive set
 * pieces. Solid runs are merged into single bodies (one TileSprite + one
 * static body per horizontal run) to keep collision checks cheap; tiles
 * that trap events need to remove later are built individually.
 */
export class LevelBuilder {
  private scene: Phaser.Scene;
  private palette: Palette;

  constructor(scene: Phaser.Scene, palette: Palette) {
    this.scene = scene;
    this.palette = palette;
  }

  build(level: LevelConfig): BuiltLevel {
    const grid = this.normalizeGrid(level.grid);
    const cols = grid[0].length;
    const rows = grid.length;

    const built: BuiltLevel = {
      widthPx: cols * TILE,
      heightPx: rows * TILE,
      spawn: { x: 1, y: rows - 3 },
      solids: this.scene.physics.add.staticGroup(),
      invisibles: this.scene.physics.add.staticGroup(),
      fakes: this.scene.physics.add.staticGroup(),
      fallerGroup: this.scene.physics.add.group({ allowGravity: false, immovable: true }),
      fallers: new Map(),
      fakeGroupIds: new Map(),
      fakeGroups: new Map(),
      removableTiles: new Map(),
      movers: [],
      saws: [],
      crushers: [],
      hiddenSpikes: [],
      timedSpikes: [],
      staticKillRects: [],
      doors: [],
      checkpoints: [],
    };

    this.addDecor(level.id, built.widthPx, built.heightPx);

    // Tiles referenced by removeTiles events must stay individual bodies.
    const removable = new Set<string>();
    (level.events ?? []).forEach((ev) =>
      ev.actions.forEach((a) => {
        if (a.kind === "removeTiles") a.at.forEach((t) => removable.add(`${t.x},${t.y}`));
      })
    );

    this.buildSolids(grid, removable, built);
    this.buildCells(grid, built);
    this.buildFakeFloors(grid, built);
    (level.movers ?? []).forEach((m) => this.buildMover(m, built));
    (level.saws ?? []).forEach((s) =>
      built.saws.push({
        img: this.scene.add
          .image(s.cx * TILE, s.cy * TILE, TEX.saw)
          .setDepth(DEPTH.hazard),
        cx: s.cx * TILE,
        cy: s.cy * TILE,
        orbit: s.orbitTiles * TILE,
        speed: s.speed,
        angle: s.startAngle ?? 0,
      })
    );
    (level.crushers ?? []).forEach((c) => this.buildCrusher(c, built));
    (level.timedSpikes ?? []).forEach((t) =>
      this.buildTimedSpikes(t.at, t.periodMs, t.offsetMs ?? 0, t.upMs ?? 650, built)
    );
    return built;
  }

  /* ---------------------------------------------------------------- */

  private normalizeGrid(rawGrid: string[]): string[] {
    const width = Math.max(...rawGrid.map((r) => r.length));
    return rawGrid.map((r) => r.padEnd(width, "."));
  }

  private addDecor(levelId: number, widthPx: number, heightPx: number): void {
    // Deterministic soft background blobs; parallax via scroll factor.
    const gr = this.scene.add.graphics().setDepth(DEPTH.bgDecor).setScrollFactor(0.35);
    gr.fillStyle(this.palette.bgDecor, 1);
    let seed = levelId * 7919 + 17;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const count = 7;
    for (let i = 0; i < count; i++) {
      const r = 40 + rand() * 90;
      gr.fillCircle(rand() * widthPx * 0.5, rand() * heightPx * 0.7, r);
    }
  }

  private buildSolids(grid: string[], removable: Set<string>, built: BuiltLevel): void {
    for (let y = 0; y < grid.length; y++) {
      let runStart = -1;
      const flush = (endExclusive: number) => {
        if (runStart < 0) return;
        const w = endExclusive - runStart;
        const strip = this.scene.add
          .tileSprite(runStart * TILE, y * TILE, w * TILE, TILE, TEX.tile)
          .setOrigin(0, 0)
          .setDepth(DEPTH.tiles);
        this.scene.physics.add.existing(strip, true);
        built.solids.add(strip);
        runStart = -1;
      };
      for (let x = 0; x < grid[y].length; x++) {
        const isPlainSolid = grid[y][x] === "X" && !removable.has(`${x},${y}`);
        if (isPlainSolid) {
          if (runStart < 0) runStart = x;
        } else {
          flush(x);
          if (grid[y][x] === "X") {
            // removable tile: keep it individual so events can take it away
            const tile = this.addStaticTile(built.solids, x, y, TEX.tile);
            built.removableTiles.set(`${x},${y}`, tile);
          }
        }
      }
      flush(grid[y].length);
    }
  }

  private addStaticTile(
    group: Phaser.Physics.Arcade.StaticGroup,
    x: number,
    y: number,
    tex: string
  ): StaticImage {
    const img = this.scene.add
      .image(x * TILE + TILE / 2, y * TILE + TILE / 2, tex)
      .setDepth(DEPTH.tiles);
    group.add(img);
    return img as StaticImage;
  }

  private buildCells(grid: string[], built: BuiltLevel): void {
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        switch (grid[y][x]) {
          case "P":
            built.spawn = { x, y };
            break;
          case "S":
            this.buildSpike(x, y, "up", built);
            break;
          case "v":
            this.buildSpike(x, y, "down", built);
            break;
          case "H":
            built.hiddenSpikes.push(this.makeEmergingSpike(x, y, "up"));
            break;
          case "F":
            this.buildFaller(x, y, built);
            break;
          case "I": {
            const tile = this.addStaticTile(built.invisibles, x, y, TEX.tile);
            tile.setAlpha(INVISIBLE_IDLE_ALPHA);
            break;
          }
          case "D":
            built.doors.push(this.buildDoor(x, y, false));
            break;
          case "E":
            built.doors.push(this.buildDoor(x, y, true));
            break;
          case "C":
            this.buildCheckpoint(x, y, built);
            break;
          default:
            break;
        }
      }
    }
  }

  private buildSpike(x: number, y: number, dir: "up" | "down", built: BuiltLevel): void {
    const img = this.scene.add
      .image(x * TILE + TILE / 2, y * TILE + TILE / 2, TEX.spike)
      .setDepth(DEPTH.hazard);
    if (dir === "down") img.setFlipY(true);
    built.staticKillRects.push(this.spikeKillRect(x, y, dir));
  }

  private spikeKillRect(x: number, y: number, dir: "up" | "down"): Phaser.Geom.Rectangle {
    return dir === "up"
      ? new Phaser.Geom.Rectangle(x * TILE + 4, y * TILE + 18, TILE - 8, 14)
      : new Phaser.Geom.Rectangle(x * TILE + 4, y * TILE, TILE - 8, 14);
  }

  makeEmergingSpike(x: number, y: number, dir: "up" | "down"): HiddenSpikeRuntime {
    const img = this.scene.add
      .image(x * TILE + TILE / 2, dir === "up" ? (y + 1) * TILE : y * TILE, TEX.spike)
      .setOrigin(0.5, dir === "up" ? 1 : 0)
      .setDepth(DEPTH.hazard)
      .setScale(1, 0);
    if (dir === "down") img.setFlipY(true);
    return { img, killRect: this.spikeKillRect(x, y, dir), emerged: false, lethal: false };
  }

  /** Pops a hidden/scripted spike out of the floor. */
  emerge(spike: HiddenSpikeRuntime): void {
    if (spike.emerged) return;
    spike.emerged = true;
    this.scene.tweens.add({
      targets: spike.img,
      scaleY: 1,
      duration: TIMING.spikeEmergeMs,
      ease: "Back.easeOut",
    });
    // lethality runs on the scene clock (game time), not the tween: it
    // pauses with the scene and stays fair if rendering hiccups
    this.scene.time.delayedCall(TIMING.spikeEmergeMs, () => {
      spike.lethal = true;
    });
  }

  private buildFaller(x: number, y: number, built: BuiltLevel): void {
    const img = this.scene.physics.add
      .image(x * TILE + TILE / 2, y * TILE + TILE / 2, TEX.tile)
      .setDepth(DEPTH.tiles);
    const body = img.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);
    built.fallerGroup.add(img);
    built.fallers.set(img, { img, state: "idle" });
  }

  private buildFakeFloors(grid: string[], built: BuiltLevel): void {
    // Flood-fill contiguous K cells so the whole fake patch collapses at once.
    const seen = new Set<string>();
    let nextGroup = 1;
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] !== "K" || seen.has(`${x},${y}`)) continue;
        const groupId = nextGroup++;
        const members: StaticImage[] = [];
        const stack: TilePos[] = [{ x, y }];
        seen.add(`${x},${y}`);
        while (stack.length) {
          const cur = stack.pop() as TilePos;
          const tile = this.addStaticTile(built.fakes, cur.x, cur.y, TEX.tile);
          built.fakeGroupIds.set(tile, groupId);
          members.push(tile);
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => {
            const nx = cur.x + ox;
            const ny = cur.y + oy;
            const key = `${nx},${ny}`;
            if (grid[ny]?.[nx] === "K" && !seen.has(key)) {
              seen.add(key);
              stack.push({ x: nx, y: ny });
            }
          });
        }
        built.fakeGroups.set(groupId, members);
      }
    }
  }

  /** Crumbles an entire fake-floor patch. */
  collapseFakeGroup(groupId: number, built: BuiltLevel): void {
    const members = built.fakeGroups.get(groupId);
    if (!members) return;
    built.fakeGroups.delete(groupId);
    members.forEach((tile, i) => {
      tile.body.enable = false;
      this.scene.tweens.add({
        targets: tile,
        alpha: 0,
        y: tile.y + 14,
        angle: Phaser.Math.Between(-14, 14),
        duration: 260,
        delay: i * 14,
        ease: "Quad.easeIn",
        onComplete: () => tile.destroy(),
      });
    });
  }

  revealInvisible(tile: Phaser.GameObjects.GameObject): void {
    const img = tile as StaticImage;
    if (img.alpha < INVISIBLE_REVEALED_ALPHA) {
      this.scene.tweens.add({ targets: img, alpha: INVISIBLE_REVEALED_ALPHA, duration: 180 });
    }
  }

  /** Wobble, then let a falling platform go. Returns false if already going. */
  triggerFaller(runtime: FallerRuntime): boolean {
    if (runtime.state !== "idle") return false;
    runtime.state = "wobbling";
    this.scene.tweens.add({
      targets: runtime.img,
      x: runtime.img.x + 2,
      duration: 50,
      yoyo: true,
      repeat: Math.floor(TIMING.fallWobbleMs / 100),
      onComplete: () => {
        runtime.state = "falling";
        const body = runtime.img.body as Phaser.Physics.Arcade.Body;
        body.setGravityY(PHYSICS.gravityY * 0.9);
        this.scene.tweens.add({
          targets: runtime.img,
          alpha: 0,
          delay: TIMING.fallFadeMs,
          duration: 350,
          onComplete: () => runtime.img.destroy(),
        });
      },
    });
    return true;
  }

  private buildDoor(x: number, y: number, fake: boolean): DoorRuntime {
    const img = this.scene.add
      .image(x * TILE + TILE / 2, (y + 1) * TILE, TEX.door)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.door);
    const extraTop = fake ? TILE * 2 : 0; // fake doors can't be jumped over
    return {
      img,
      enterRect: new Phaser.Geom.Rectangle(
        x * TILE + (TILE - 22) / 2,
        (y + 1) * TILE - DOOR_SIZE.h - extraTop,
        22,
        DOOR_SIZE.h + extraTop
      ),
      fake,
      consumed: false,
    };
  }

  /** Pop the real exit into existence (after a fake exit vanishes). */
  revealRealDoor(at: TilePos, built: BuiltLevel): void {
    const door = this.buildDoor(at.x, at.y, false);
    door.img.setScale(0);
    this.scene.tweens.add({
      targets: door.img,
      scaleX: 1,
      scaleY: 1,
      duration: 320,
      ease: "Back.easeOut",
    });
    built.doors.push(door);
  }

  private buildCheckpoint(x: number, y: number, built: BuiltLevel): void {
    const img = this.scene.add
      .image(x * TILE + TILE / 2 - 6, (y + 1) * TILE, TEX.checkpoint)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.checkpoint);
    built.checkpoints.push({
      img,
      rect: new Phaser.Geom.Rectangle(x * TILE - 8, (y - 1) * TILE, TILE + 16, TILE * 2),
      tile: { x, y },
      active: false,
    });
  }

  activateCheckpoint(cp: CheckpointRuntime): void {
    cp.active = true;
    cp.img.setTexture(TEX.checkpointActive);
    this.scene.tweens.add({
      targets: cp.img,
      scaleY: 1.15,
      duration: 110,
      yoyo: true,
      ease: "Quad.easeOut",
    });
  }

  private buildMover(m: MoverConfig, built: BuiltLevel): void {
    const w = m.widthTiles * TILE;
    const img = this.scene.physics.add
      .image(m.x * TILE + w / 2, m.y * TILE + 10, TEX.mover)
      .setDepth(DEPTH.mover);
    img.setDisplaySize(w, 20);
    const body = img.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);
    body.setSize(w, 20);
    this.scene.tweens.add({
      targets: img,
      x: img.x + m.dx * TILE,
      y: img.y + m.dy * TILE,
      duration: m.durationMs,
      delay: m.delayMs ?? 0,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    built.movers.push({ img, prevX: img.x, prevY: img.y });
  }

  private buildCrusher(
    c: { x: number; y: number; widthTiles: number; dropTiles: number; mode: "cycle" | "trigger"; periodMs?: number; offsetMs?: number; triggerPad?: number },
    built: BuiltLevel
  ): void {
    const w = c.widthTiles * TILE;
    const h = TILE + 12;
    const img = this.scene.add
      .image(c.x * TILE, c.y * TILE, TEX.crusher)
      .setOrigin(0, 0)
      .setDepth(DEPTH.hazard);
    img.setDisplaySize(w, h);
    const restY = c.y * TILE;
    const dropY = restY + c.dropTiles * TILE;
    const pad = c.triggerPad ?? 26;
    const runtime: CrusherRuntime = {
      img,
      restY,
      dropY,
      mode: c.mode,
      zone: new Phaser.Geom.Rectangle(
        c.x * TILE - pad,
        restY,
        w + pad * 2,
        dropY - restY + h
      ),
      state: "armed",
    };
    built.crushers.push(runtime);
    if (c.mode === "cycle") {
      const period = c.periodMs ?? 2200;
      this.scene.tweens.chain({
        targets: img,
        loop: -1,
        tweens: [
          {
            y: dropY,
            duration: TIMING.crusherSlamMs,
            ease: "Quad.easeIn",
            delay: c.offsetMs ?? 0,
          },
          { y: dropY, duration: TIMING.crusherHoldMs },
          { y: restY, duration: TIMING.crusherRiseMs, ease: "Sine.easeInOut" },
          {
            y: restY,
            duration: Math.max(
              period - TIMING.crusherSlamMs - TIMING.crusherHoldMs - TIMING.crusherRiseMs,
              100
            ),
          },
        ],
      });
    }
  }

  /** Slam a trigger-mode crusher once; it re-arms after rising. */
  slamCrusher(cr: CrusherRuntime): void {
    if (cr.state !== "armed") return;
    cr.state = "slamming";
    this.scene.tweens.chain({
      targets: cr.img,
      tweens: [
        { y: cr.dropY, duration: TIMING.crusherSlamMs, ease: "Quad.easeIn" },
        { y: cr.dropY, duration: TIMING.crusherHoldMs },
        { y: cr.restY, duration: TIMING.crusherRiseMs, ease: "Sine.easeInOut" },
      ],
      onComplete: () => {
        cr.state = "armed";
      },
    });
  }

  private buildTimedSpikes(
    at: TilePos[],
    periodMs: number,
    offsetMs: number,
    upMs: number,
    built: BuiltLevel
  ): void {
    const runtime: TimedSpikeRuntime = {
      imgs: at.map((t) =>
        this.scene.add
          .image(t.x * TILE + TILE / 2, (t.y + 1) * TILE, TEX.spike)
          .setOrigin(0.5, 1)
          .setDepth(DEPTH.hazard)
          .setScale(1, 0)
      ),
      killRects: at.map((t) => this.spikeKillRect(t.x, t.y, "up")),
      lethal: false,
    };
    built.timedSpikes.push(runtime);
    const cycle = () => {
      this.scene.tweens.add({
        targets: runtime.imgs,
        scaleY: 1,
        duration: TIMING.spikeEmergeMs,
        ease: "Back.easeOut",
      });
      // same emerge grace period as hidden spikes, on the scene clock
      this.scene.time.delayedCall(TIMING.spikeEmergeMs, () => {
        runtime.lethal = true;
      });
      this.scene.time.delayedCall(upMs, () => {
        runtime.lethal = false;
        this.scene.tweens.add({
          targets: runtime.imgs,
          scaleY: 0,
          duration: 160,
          ease: "Quad.easeIn",
        });
      });
    };
    this.scene.time.addEvent({ delay: periodMs, loop: true, startAt: periodMs - offsetMs, callback: cycle });
  }

  /** Remove specific tiles (trapdoors) with a crumble animation. */
  removeTiles(at: TilePos[], built: BuiltLevel): void {
    at.forEach((t, i) => {
      const tile = built.removableTiles.get(`${t.x},${t.y}`);
      if (!tile) return;
      built.removableTiles.delete(`${t.x},${t.y}`);
      tile.body.enable = false;
      this.scene.tweens.add({
        targets: tile,
        alpha: 0,
        y: tile.y + 16,
        angle: Phaser.Math.Between(-10, 10),
        duration: 240,
        delay: i * 20,
        ease: "Quad.easeIn",
        onComplete: () => tile.destroy(),
      });
    });
  }

  /** Slide a wall up out of the floor (its body activates once risen). */
  raiseWall(at: TilePos[], built: BuiltLevel): void {
    at.forEach((t) => {
      const img = this.scene.add
        .image(t.x * TILE + TILE / 2, (t.y + 1) * TILE, TEX.tile)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.tiles)
        .setScale(1, 0.05);
      this.scene.tweens.add({
        targets: img,
        scaleY: 1,
        duration: 220,
        ease: "Quad.easeOut",
        onComplete: () => {
          // At scale 1 the image exactly covers its tile, so the static
          // body created here lands in the right place automatically.
          built.solids.add(img);
        },
      });
    });
  }
}
