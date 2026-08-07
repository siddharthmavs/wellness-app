import type Phaser from "phaser";
import { Palette, paletteFor, RK } from "../config/constants";
import { AudioSystem } from "./AudioSystem";
import { SaveManager } from "./SaveManager";

/** Long-lived systems shared by all scenes via the game registry. */
export interface Systems {
  audio: AudioSystem;
  save: SaveManager;
}

export function getSystems(scene: Phaser.Scene): Systems {
  return scene.registry.get(RK.systems) as Systems;
}

export function currentPalette(scene: Phaser.Scene): Palette {
  const dark = Boolean(scene.registry.get(RK.darkMode));
  const { highContrast } = getSystems(scene).save.settings;
  return paletteFor(dark, highContrast);
}
