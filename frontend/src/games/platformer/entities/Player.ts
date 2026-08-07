import Phaser from "phaser";
import { DEPTH, PHYSICS } from "../config/constants";
import { InputSystem } from "../systems/InputSystem";
import { ANIM, PLAYER_FRAME, TEX } from "../systems/TextureFactory";

export type PlayerState = "alive" | "dead" | "won";

/**
 * The stickman. Movement is tuned for tight, forgiving platforming:
 * acceleration-based horizontal motion, variable jump height, coyote time
 * and a jump buffer.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  /** Typed accessor: the player always has a dynamic Arcade body. */
  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  lifeState: PlayerState = "alive";
  /** +1 normal gravity, -1 flipped (walking on the ceiling). */
  gravityDir: 1 | -1 = 1;

  private inputSys: InputSystem;
  private coyoteUntil = 0;
  private jumpBufferedUntil = 0;
  private wasOnGround = false;
  private lastFallSpeed = 0;
  private onJump: () => void;
  private onLand: (hard: boolean) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    inputSys: InputSystem,
    callbacks: { onJump: () => void; onLand: (hard: boolean) => void }
  ) {
    super(scene, x, y, TEX.player, "idle-0");
    this.inputSys = inputSys;
    this.onJump = callbacks.onJump;
    this.onLand = callbacks.onLand;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.player);
    this.arcadeBody.setSize(14, 27);
    this.arcadeBody.setOffset((PLAYER_FRAME.w - 14) / 2, PLAYER_FRAME.h - 27);
    this.arcadeBody.setMaxVelocityY(PHYSICS.maxFallSpeed);
    // world gravity is 0; each body owns its gravity so it can be flipped
    this.arcadeBody.setGravityY(PHYSICS.gravityY);
    this.setCollideWorldBounds(true);
    this.play(ANIM.idle);
  }

  get onGround(): boolean {
    return this.gravityDir === 1 ? this.arcadeBody.blocked.down : this.arcadeBody.blocked.up;
  }

  setGravityFlipped(flipped: boolean): void {
    this.gravityDir = flipped ? -1 : 1;
    this.setFlipY(flipped);
    this.arcadeBody.setGravityY(PHYSICS.gravityY * this.gravityDir);
    this.arcadeBody.setOffset((PLAYER_FRAME.w - 14) / 2, flipped ? 0 : PLAYER_FRAME.h - 27);
  }

  update(time: number): void {
    if (this.lifeState !== "alive") {
      if (this.lifeState === "won") this.setVelocityX(0);
      return;
    }
    this.inputSys.update();

    const { left, right, jumpHeld, jumpPressed } = this.inputSys;
    const accel = this.onGround ? PHYSICS.groundAccel : PHYSICS.airAccel;

    if (left && !right) {
      this.setAccelerationX(-accel);
      this.setFlipX(true);
    } else if (right && !left) {
      this.setAccelerationX(accel);
      this.setFlipX(false);
    } else {
      this.setAccelerationX(0);
      // quick, smooth stop
      this.setVelocityX(this.arcadeBody.velocity.x * 0.8);
      if (Math.abs(this.arcadeBody.velocity.x) < 8) this.setVelocityX(0);
    }
    this.arcadeBody.velocity.x = Phaser.Math.Clamp(
      this.arcadeBody.velocity.x,
      -PHYSICS.runSpeed,
      PHYSICS.runSpeed
    );

    // --- jumping: coyote time + input buffer ---
    if (this.onGround) this.coyoteUntil = time + PHYSICS.coyoteMs;
    if (jumpPressed) this.jumpBufferedUntil = time + PHYSICS.jumpBufferMs;

    if (time < this.jumpBufferedUntil && time < this.coyoteUntil) {
      this.jumpBufferedUntil = 0;
      this.coyoteUntil = 0;
      this.setVelocityY(-PHYSICS.jumpVelocity * this.gravityDir);
      this.onJump();
    }

    // variable jump height: cut the jump short when the button is released
    const rising = this.gravityDir === 1 ? this.arcadeBody.velocity.y < 0 : this.arcadeBody.velocity.y > 0;
    if (!jumpHeld && rising) {
      this.setVelocityY(this.arcadeBody.velocity.y * PHYSICS.jumpCutFactor);
    }

    // --- landing detection ---
    const fallVel = this.arcadeBody.velocity.y * this.gravityDir;
    if (!this.onGround) this.lastFallSpeed = Math.max(fallVel, 0);
    if (this.onGround && !this.wasOnGround) {
      const hard = this.lastFallSpeed > PHYSICS.hardLandSpeed;
      this.onLand(hard);
      this.squash();
      this.lastFallSpeed = 0;
    }
    this.wasOnGround = this.onGround;

    this.updateAnimation();
  }

  private updateAnimation(): void {
    if (this.onGround) {
      const moving = Math.abs(this.arcadeBody.velocity.x) > 20;
      this.play(moving ? ANIM.run : ANIM.idle, true);
    } else {
      const rising = this.arcadeBody.velocity.y * this.gravityDir < -40;
      this.play(rising ? ANIM.jump : ANIM.fall, true);
    }
  }

  private squash(): void {
    this.scene.tweens.add({
      targets: this,
      scaleY: 0.85,
      scaleX: 1.12,
      duration: 60,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => this.setScale(1),
    });
  }

  /** Freeze physics and hide for the particle-burst death. */
  kill(): void {
    if (this.lifeState !== "alive") return;
    this.lifeState = "dead";
    this.arcadeBody.stop();
    this.arcadeBody.setEnable(false);
    this.setVisible(false);
  }

  /** Victory: stop physics and celebrate. */
  win(): void {
    if (this.lifeState !== "alive") return;
    this.lifeState = "won";
    this.arcadeBody.stop();
    this.arcadeBody.setAllowGravity(false);
    this.setAccelerationX(0);
    this.play(ANIM.win, true);
  }
}
