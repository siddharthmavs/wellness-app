import Phaser from "phaser";
import { RK } from "../config/constants";

/**
 * Unifies keyboard (arrows / WASD / space) and the touch controls that the
 * HUD scene writes into the game registry. Keyboard objects are scene-owned,
 * so everything is cleaned up automatically on scene shutdown.
 */
export class InputSystem {
  private scene: Phaser.Scene;
  private keys: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
  } | null = null;

  private prevJumpHeld = false;
  private jumpPressedFlag = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = {
        left: kb.addKey(K.LEFT),
        right: kb.addKey(K.RIGHT),
        up: kb.addKey(K.UP),
        a: kb.addKey(K.A),
        d: kb.addKey(K.D),
        w: kb.addKey(K.W),
        space: kb.addKey(K.SPACE),
      };
    }
  }

  /** Call once per frame before reading the getters. */
  update(): void {
    const held = this.jumpHeld;
    this.jumpPressedFlag = held && !this.prevJumpHeld;
    this.prevJumpHeld = held;
  }

  get left(): boolean {
    return (
      Boolean(this.keys && (this.keys.left.isDown || this.keys.a.isDown)) ||
      Boolean(this.scene.registry.get(RK.touchLeft))
    );
  }

  get right(): boolean {
    return (
      Boolean(this.keys && (this.keys.right.isDown || this.keys.d.isDown)) ||
      Boolean(this.scene.registry.get(RK.touchRight))
    );
  }

  get jumpHeld(): boolean {
    return (
      Boolean(
        this.keys && (this.keys.space.isDown || this.keys.up.isDown || this.keys.w.isDown)
      ) || Boolean(this.scene.registry.get(RK.touchJump))
    );
  }

  /** True only on the frame the jump input went down. */
  get jumpPressed(): boolean {
    return this.jumpPressedFlag;
  }
}
