import Phaser from "phaser";
import { SCENES } from "../config/constants";
import { currentPalette, getSystems } from "../systems/context";
import { buildTextures } from "../systems/TextureFactory";

/** Generates all procedural textures, unlocks audio, then hands off. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    buildTextures(this, currentPalette(this));
    getSystems(this).audio.unlock();
    this.scene.start(SCENES.select);
  }
}
