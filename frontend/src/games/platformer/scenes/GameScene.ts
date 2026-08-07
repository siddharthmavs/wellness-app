import Phaser from "phaser";
import { DEPTH, EV, PHYSICS, SCENES, TILE, TIMING } from "../config/constants";
import { Player } from "../entities/Player";
import { LEVELS, levelById } from "../levels";
import { LevelConfig, TilePos } from "../levels/types";
import { currentPalette, getSystems } from "../systems/context";
import { InputSystem } from "../systems/InputSystem";
import { BuiltLevel, DoorRuntime, LevelBuilder } from "../systems/LevelBuilder";
import { buildTextures, SAW_RADIUS, TEX } from "../systems/TextureFactory";
import { TrapSystem } from "../systems/TrapSystem";

export interface GameSceneData {
  levelId: number;
  spawn?: TilePos;
  elapsedMs?: number;
  attempts?: number;
  /** false for palette/settings restarts that shouldn't count as a try */
  countAttempt?: boolean;
}

export interface WinPayload {
  levelId: number;
  timeMs: number;
  bestTimeMs: number | null;
  isBest: boolean;
  hasNext: boolean;
  attempts: number;
}

type Phase = "playing" | "dying" | "won";

let runCounter = 0;

/**
 * The gameplay scene: builds the level, owns the player, runs collision /
 * hazard / trap checks, and restarts itself on death (quick respawn at the
 * last checkpoint). All game state lives here — React never touches it.
 */
export class GameScene extends Phaser.Scene {
  levelId = 1;
  levelName = "";
  hint: string | undefined;
  attempts = 0;
  elapsedMs = 0;
  phase: Phase = "playing";
  /** changes on every (re)build so the HUD can detect restarts */
  runId = 0;
  /** true on fresh level entry — the HUD shows the hint once */
  freshRun = true;

  private level!: LevelConfig;
  private builder!: LevelBuilder;
  private built!: BuiltLevel;
  private player!: Player;
  private inputSys!: InputSystem;
  private traps!: TrapSystem;
  private activeCheckpoint: TilePos | null = null;
  private gravityFlipped = false;
  private dustEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private burstEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private confettiEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private scratchRect = new Phaser.Geom.Rectangle();
  private scratchCircle = new Phaser.Geom.Circle();

  constructor() {
    super(SCENES.game);
  }

  init(data: GameSceneData): void {
    this.levelId = data.levelId ?? 1;
    this.elapsedMs = data.elapsedMs ?? 0;
    this.attempts = (data.attempts ?? 0) + (data.countAttempt === false ? 0 : 1);
    this.activeCheckpoint = data.spawn ?? null;
    this.freshRun = !data.spawn && (data.countAttempt ?? true) && (data.attempts ?? 0) === 0;
    this.phase = "playing";
    this.gravityFlipped = false;
    this.runId = ++runCounter;
  }

  create(data: GameSceneData): void {
    const systems = getSystems(this);
    const palette = currentPalette(this);
    buildTextures(this, palette); // no-op unless the palette changed

    this.level = levelById(this.levelId);
    this.levelName = this.level.name;
    this.hint = this.level.hint;
    if (data.countAttempt !== false) systems.save.recordAttempt(this.levelId);

    this.cameras.main.setBackgroundColor(palette.bg);
    this.builder = new LevelBuilder(this, palette);
    this.built = this.builder.build(this.level);

    this.physics.world.setBounds(0, 0, this.built.widthPx, this.built.heightPx);
    this.physics.world.setBoundsCollision(true, true, false, false);

    this.createPlayer(data);
    this.createEmitters(palette.player, palette.confetti);
    this.createColliders();

    this.traps = new TrapSystem(this.level.events, this.builder, this.built, {
      flipGravity: () => this.toggleGravity(),
      shake: (intensity) => this.cameras.main.shake(180, intensity),
      onSpikesEmerged: () => systems.audio.play("spike"),
      onTilesRemoved: () => systems.audio.play("collapse"),
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.built.widthPx, this.built.heightPx);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setDeadzone(120, 70);

    this.input.keyboard?.on("keydown-R", () => this.restartLevel());

    if (!this.scene.isActive(SCENES.hud)) this.scene.launch(SCENES.hud);
  }

  /** Full restart from the beginning (R key / HUD button). */
  restartLevel(): void {
    if (this.phase === "won") return;
    this.scene.restart({
      levelId: this.levelId,
      elapsedMs: 0,
      attempts: this.attempts,
    } satisfies GameSceneData);
  }

  /** Restart in place (settings/palette change) without counting a try. */
  rebuildInPlace(): void {
    this.scene.restart({
      levelId: this.levelId,
      spawn: this.activeCheckpoint ?? undefined,
      elapsedMs: this.elapsedMs,
      attempts: this.attempts,
      countAttempt: false,
    } satisfies GameSceneData);
  }

  startLevel(levelId: number): void {
    this.scene.restart({ levelId, elapsedMs: 0, attempts: 0 } satisfies GameSceneData);
  }

  /* ------------------------------------------------------------------ */

  private createPlayer(data: GameSceneData): void {
    const audio = getSystems(this).audio;
    const spawn = data.spawn ?? this.built.spawn;
    this.inputSys = new InputSystem(this);
    this.player = new Player(
      this,
      spawn.x * TILE + TILE / 2,
      (spawn.y + 1) * TILE - 16,
      this.inputSys,
      {
        onJump: () => audio.play("jump"),
        onLand: (hard) => {
          if (hard) {
            audio.play("land");
            this.dustEmitter.explode(6, this.player.x, this.player.getBounds().bottom);
          }
        },
      }
    );
    // returning to an already-activated checkpoint: light its flag silently
    if (data.spawn) {
      this.built.checkpoints
        .filter((cp) => cp.tile.x === data.spawn?.x && cp.tile.y === data.spawn?.y)
        .forEach((cp) => this.builder.activateCheckpoint(cp));
    }
  }

  private createEmitters(playerColor: number, confettiColors: number[]): void {
    this.dustEmitter = this.add
      .particles(0, 0, TEX.dust, {
        speed: { min: 20, max: 80 },
        angle: { min: 210, max: 330 },
        lifespan: { min: 200, max: 420 },
        scale: { start: 1, end: 0 },
        gravityY: 300,
        emitting: false,
      })
      .setDepth(DEPTH.particles);
    this.burstEmitter = this.add
      .particles(0, 0, TEX.particle, {
        speed: { min: 90, max: 280 },
        lifespan: { min: 250, max: 460 },
        scale: { start: 1.1, end: 0 },
        gravityY: 600,
        tint: playerColor,
        emitting: false,
      })
      .setDepth(DEPTH.particles);
    this.confettiEmitter = this.add
      .particles(0, 0, TEX.particle, {
        speed: { min: 60, max: 240 },
        lifespan: { min: 500, max: 950 },
        scale: { start: 1, end: 0 },
        gravityY: 380,
        rotate: { min: 0, max: 360 },
        tint: confettiColors,
        emitting: false,
      })
      .setDepth(DEPTH.particles);
  }

  private createColliders(): void {
    const audio = getSystems(this).audio;
    this.physics.add.collider(this.player, this.built.solids);
    this.physics.add.collider(this.player, this.built.invisibles, (_p, tile) =>
      this.builder.revealInvisible(tile as Phaser.GameObjects.GameObject)
    );
    this.physics.add.collider(this.player, this.built.fakes, (_p, tile) => {
      const groupId = this.built.fakeGroupIds.get(tile as Phaser.GameObjects.GameObject);
      if (groupId !== undefined) {
        this.builder.collapseFakeGroup(groupId, this.built);
        audio.play("collapse");
        this.cameras.main.shake(120, 0.003);
      }
    });
    this.physics.add.collider(this.player, this.built.fallerGroup, (_p, obj) => {
      const runtime = this.built.fallers.get(obj as Phaser.GameObjects.GameObject);
      if (
        runtime &&
        this.player.arcadeBody.touching.down &&
        this.builder.triggerFaller(runtime)
      ) {
        audio.play("collapse");
      }
    });
    // scene restarts destroy groups, so build this fresh every create()
    const moverGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.built.movers.forEach((m) => moverGroup.add(m.img));
    this.physics.add.collider(this.player, moverGroup);
  }

  private toggleGravity(): void {
    this.gravityFlipped = !this.gravityFlipped;
    this.player.setGravityFlipped(this.gravityFlipped);
    getSystems(this).audio.play("poof");
  }

  /* ------------------------------------------------------------------ */

  update(time: number, delta: number): void {
    if (this.phase === "playing") this.elapsedMs += delta;
    this.player.update(time);
    this.updateMovers();
    this.updateSaws(delta);
    if (this.phase !== "playing") return;

    const rect = this.playerRect();
    this.traps.update(rect);
    this.updateHiddenSpikes();
    this.updateCrushers(rect);
    this.checkCheckpoints(rect);
    this.checkDoors(rect);
    if (this.hitsAnythingDeadly(rect) || this.outOfBounds()) this.die();
  }

  private playerRect(): Phaser.Geom.Rectangle {
    const b = this.player.arcadeBody;
    this.scratchRect.setTo(b.x + 2, b.y + 2, b.width - 4, b.height - 4);
    return this.scratchRect;
  }

  private updateMovers(): void {
    for (const m of this.built.movers) {
      const dx = m.img.x - m.prevX;
      const dy = m.img.y - m.prevY;
      m.prevX = m.img.x;
      m.prevY = m.img.y;
      const body = m.img.body as Phaser.Physics.Arcade.Body;
      const riding =
        (this.player.arcadeBody.touching.down && body.touching.up) ||
        (this.player.arcadeBody.touching.up && body.touching.down);
      if (riding && this.player.lifeState === "alive") {
        this.player.x += dx;
        this.player.y += dy;
      }
    }
  }

  private updateSaws(delta: number): void {
    const dt = delta / 1000;
    for (const s of this.built.saws) {
      s.img.rotation += 4 * dt;
      if (s.orbit > 0) {
        s.angle += s.speed * dt;
        s.img.setPosition(
          s.cx + Math.cos(s.angle) * s.orbit,
          s.cy + Math.sin(s.angle) * s.orbit
        );
      }
    }
  }

  private updateHiddenSpikes(): void {
    const px = this.player.x;
    const pBottom = this.player.arcadeBody.bottom;
    for (const spike of this.built.hiddenSpikes) {
      if (spike.emerged) continue;
      const closeX = Math.abs(px - spike.img.x) < 54;
      const closeY = pBottom > spike.killRect.y - 96 && pBottom < spike.killRect.bottom + 40;
      if (closeX && closeY) {
        this.builder.emerge(spike);
        getSystems(this).audio.play("spike");
      }
    }
  }

  private updateCrushers(playerRect: Phaser.Geom.Rectangle): void {
    for (const cr of this.built.crushers) {
      if (
        cr.mode === "trigger" &&
        cr.state === "armed" &&
        Phaser.Geom.Rectangle.Overlaps(cr.zone, playerRect)
      ) {
        this.builder.slamCrusher(cr);
        getSystems(this).audio.play("spike");
      }
    }
  }

  private checkCheckpoints(playerRect: Phaser.Geom.Rectangle): void {
    for (const cp of this.built.checkpoints) {
      if (cp.active || !Phaser.Geom.Rectangle.Overlaps(cp.rect, playerRect)) continue;
      this.builder.activateCheckpoint(cp);
      this.activeCheckpoint = cp.tile;
      getSystems(this).audio.play("checkpoint");
      this.game.events.emit(EV.checkpoint);
    }
  }

  private checkDoors(playerRect: Phaser.Geom.Rectangle): void {
    for (const door of this.built.doors) {
      if (door.consumed || !Phaser.Geom.Rectangle.Overlaps(door.enterRect, playerRect)) {
        continue;
      }
      if (door.fake) this.poofFakeDoor(door);
      else this.win(door);
    }
  }

  private hitsAnythingDeadly(rect: Phaser.Geom.Rectangle): boolean {
    for (const kill of this.built.staticKillRects) {
      if (Phaser.Geom.Rectangle.Overlaps(kill, rect)) return true;
    }
    for (const spike of this.built.hiddenSpikes) {
      if (spike.lethal && Phaser.Geom.Rectangle.Overlaps(spike.killRect, rect)) return true;
    }
    for (const timed of this.built.timedSpikes) {
      if (!timed.lethal) continue;
      for (const kill of timed.killRects) {
        if (Phaser.Geom.Rectangle.Overlaps(kill, rect)) return true;
      }
    }
    for (const saw of this.built.saws) {
      this.scratchCircle.setTo(saw.img.x, saw.img.y, SAW_RADIUS - 2);
      if (Phaser.Geom.Intersects.CircleToRectangle(this.scratchCircle, rect)) return true;
    }
    for (const cr of this.built.crushers) {
      if (cr.img.y <= cr.restY + 4) continue; // resting crushers are safe
      const b = cr.img.getBounds();
      this.scratchRect2.setTo(b.x + 6, b.y + 6, b.width - 12, b.height - 10);
      if (Phaser.Geom.Rectangle.Overlaps(this.scratchRect2, rect)) return true;
    }
    return false;
  }

  private scratchRect2 = new Phaser.Geom.Rectangle();

  private outOfBounds(): boolean {
    return this.player.y > this.built.heightPx + 80 || this.player.y < -80;
  }

  /* ------------------------------------------------------------------ */

  private die(): void {
    if (this.phase !== "playing") return;
    this.phase = "dying";
    const { audio } = getSystems(this);
    audio.play("death");
    this.burstEmitter.explode(18, this.player.x, this.player.y);
    this.cameras.main.shake(150, 0.008);
    this.player.kill();
    this.time.delayedCall(TIMING.deathFreezeMs, () => {
      this.scene.restart({
        levelId: this.levelId,
        spawn: this.activeCheckpoint ?? undefined,
        elapsedMs: this.elapsedMs,
        attempts: this.attempts,
      } satisfies GameSceneData);
    });
  }

  private poofFakeDoor(door: DoorRuntime): void {
    door.consumed = true;
    const { audio } = getSystems(this);
    audio.play("poof");
    this.dustEmitter.explode(14, door.img.x, door.img.y - 28);
    this.cameras.main.shake(120, 0.003);
    this.tweens.add({
      targets: door.img,
      scaleY: 0,
      scaleX: 0.4,
      duration: 200,
      ease: "Quad.easeIn",
      onComplete: () => door.img.destroy(),
    });
    if (this.level.fakeExitReveal) {
      this.builder.revealRealDoor(this.level.fakeExitReveal, this.built);
    }
    this.game.events.emit(EV.fakeExit);
  }

  private win(door: DoorRuntime): void {
    if (this.phase !== "playing") return;
    this.phase = "won";
    door.consumed = true;
    const { audio, save } = getSystems(this);
    const timeMs = Math.round(this.elapsedMs);

    audio.play("door");
    door.img.setTexture(TEX.doorOpen);
    this.player.win();
    this.tweens.add({
      targets: this.player,
      x: door.img.x,
      duration: TIMING.winWalkMs,
      ease: "Sine.easeInOut",
    });
    this.tweens.add({
      targets: this.player,
      alpha: 0,
      scale: 0.7,
      delay: TIMING.winWalkMs,
      duration: TIMING.doorOpenMs,
    });

    const isBest = save.recordCompletion(this.levelId, timeMs, LEVELS.length);
    this.time.delayedCall(TIMING.winWalkMs + 120, () => {
      audio.play("victory");
      this.confettiEmitter.explode(26, door.img.x, door.img.y - 40);
      this.tweens.add({
        targets: door.img,
        scaleX: 1.06,
        duration: 120,
        yoyo: true,
      });
    });
    this.time.delayedCall(TIMING.winWalkMs + 650, () => {
      this.game.events.emit(EV.levelWin, {
        levelId: this.levelId,
        timeMs,
        bestTimeMs: save.statsFor(this.levelId).bestTimeMs,
        isBest,
        hasNext: this.levelId < LEVELS.length,
        attempts: this.attempts,
      } satisfies WinPayload);
    });
  }
}
