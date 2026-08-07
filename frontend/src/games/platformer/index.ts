import Phaser from "phaser";
import { GAME_ID, hexStr, paletteFor, RK, SCENES, VIEW } from "./config/constants";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { HudScene } from "./scenes/HudScene";
import { LevelSelectScene } from "./scenes/LevelSelectScene";
import { AudioSystem } from "./systems/AudioSystem";
import { SaveManager } from "./systems/SaveManager";
import { Systems } from "./systems/context";
import { resetTextureCache } from "./systems/TextureFactory";

// CRA inlines process.env.NODE_ENV at build time; no Node types needed
declare const process: { env: { NODE_ENV?: string } };

export interface TrickstepHandle {
  /** Propagate the wellness app's dark-mode toggle into the game. */
  setDarkMode(dark: boolean): void;
  /** Tear down Phaser, WebAudio and all listeners. */
  destroy(): void;
}

/**
 * Boots a self-contained Phaser instance inside `parent`. Everything —
 * canvas, textures, audio context, timers — is released by `destroy()`.
 * Phaser's visibility handler pauses the loop automatically when the
 * browser tab is hidden; we additionally suspend the audio clock.
 */
export function createGame(parent: HTMLElement, options: { darkMode: boolean }): TrickstepHandle {
  const save = new SaveManager();
  const audio = new AudioSystem(save.settings.sound, save.settings.music);
  const palette = paletteFor(options.darkMode, save.settings.highContrast);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    title: GAME_ID,
    backgroundColor: hexStr(palette.bg),
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: VIEW.width,
      height: VIEW.height,
    },
    render: {
      antialias: true,
      roundPixels: true,
      powerPreference: "high-performance",
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 0 } },
    },
    scene: [BootScene, LevelSelectScene, GameScene, HudScene],
  });

  game.registry.set(RK.systems, { audio, save } satisfies Systems);
  game.registry.set(RK.darkMode, options.darkMode);

  if (process.env.NODE_ENV === "development") {
    // debug hook for tests / manual poking; never present in production
    (window as unknown as { __trickstep?: Phaser.Game }).__trickstep = game;
    game.events.once(Phaser.Core.Events.DESTROY, () => {
      delete (window as unknown as { __trickstep?: Phaser.Game }).__trickstep;
    });
  }

  game.events.on(Phaser.Core.Events.HIDDEN, () => audio.suspend());
  game.events.on(Phaser.Core.Events.VISIBLE, () => audio.resume());
  game.events.once(Phaser.Core.Events.DESTROY, () => {
    audio.destroy();
    resetTextureCache();
  });

  return {
    setDarkMode(dark: boolean): void {
      if (game.registry.get(RK.darkMode) === dark) return;
      game.registry.set(RK.darkMode, dark);
      // restart whichever non-gameplay scenes are live so they re-theme;
      // an active level keeps its palette until its next rebuild
      if (game.scene.isActive(SCENES.select)) {
        (game.scene.getScene(SCENES.select) as LevelSelectScene).scene.restart();
      }
      if (game.scene.isActive(SCENES.hud)) {
        (game.scene.getScene(SCENES.hud) as HudScene).scene.restart();
      }
    },
    destroy(): void {
      game.destroy(true);
      // Phaser finishes destroying on its next frame — which never comes
      // if the tab is hidden. Step once manually so teardown (renderer,
      // audio, listeners) completes immediately.
      if (typeof document !== "undefined" && document.hidden) {
        game.loop.step(performance.now());
      }
    },
  };
}
