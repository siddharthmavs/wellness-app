import Phaser from "phaser";
import { DEPTH, EV, FONTS, GAME_TITLE, hexStr, Palette, RK, SCENES, VIEW } from "../config/constants";
import { currentPalette, getSystems } from "../systems/context";
import { formatTime } from "../systems/SaveManager";
import { GameScene, WinPayload } from "./GameScene";

const BTN_STYLE_PAD = { x: 14, y: 8 };

/**
 * Minimal HUD rendered in its own scene above the game: level info,
 * attempts, timer, pause/settings, win overlay, toasts and mobile touch
 * controls. Uses only text and vector graphics (no generated textures), so
 * palette rebuilds never affect it. It reads game state directly from the
 * GameScene each frame — no cross-scene event ordering problems.
 */
export class HudScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private palette!: Palette;
  private levelText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private muteBtn!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private winOverlay!: Phaser.GameObjects.Container;
  private toastText!: Phaser.GameObjects.Text;
  private lastRunId = -1;
  private paused = false;

  constructor() {
    super(SCENES.hud);
  }

  create(): void {
    this.gameScene = this.scene.get(SCENES.game) as GameScene;
    this.palette = currentPalette(this);
    this.paused = false;
    this.lastRunId = -1;

    this.createTopBar();
    this.createToast();
    this.pauseOverlay = this.createPauseOverlay();
    this.winOverlay = this.createWinOverlay();
    if (this.sys.game.device.input.touch) this.createTouchControls();

    this.input.keyboard?.on("keydown-ESC", () => this.togglePause());
    this.input.keyboard?.on("keydown-M", () => this.toggleSound());

    const onWin = (payload: WinPayload) => this.showWinOverlay(payload);
    const onCheckpoint = () => this.showToast("Checkpoint!");
    const onFakeExit = () => this.showToast("Nope. Not that one.");
    this.game.events.on(EV.levelWin, onWin);
    this.game.events.on(EV.checkpoint, onCheckpoint);
    this.game.events.on(EV.fakeExit, onFakeExit);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(EV.levelWin, onWin);
      this.game.events.off(EV.checkpoint, onCheckpoint);
      this.game.events.off(EV.fakeExit, onFakeExit);
      this.clearTouchFlags();
    });
  }

  update(): void {
    if (!this.gameScene.scene.isActive() && !this.paused) {
      // game scene may be restarting this frame; skip the read
      return;
    }
    if (this.gameScene.runId !== this.lastRunId) {
      this.lastRunId = this.gameScene.runId;
      this.levelText.setText(
        `LEVEL ${this.gameScene.levelId} — ${this.gameScene.levelName.toUpperCase()}`
      );
      this.winOverlay.setVisible(false);
      if (this.gameScene.freshRun && this.gameScene.hint) {
        this.showToast(this.gameScene.hint, 2600);
      }
    }
    this.statsText.setText(
      `⏱ ${formatTime(this.gameScene.elapsedMs)}    ✖ ${this.gameScene.attempts}`
    );
  }

  /* ---------------------------- top bar ---------------------------- */

  private createTopBar(): void {
    const p = this.palette;
    this.levelText = this.add
      .text(16, 12, "", {
        fontFamily: FONTS.display,
        fontSize: "17px",
        fontStyle: "bold",
        color: p.text,
      })
      .setDepth(DEPTH.hud);
    this.statsText = this.add
      .text(16, 36, "", {
        fontFamily: FONTS.body,
        fontSize: "14px",
        color: p.textDim,
      })
      .setDepth(DEPTH.hud);

    const mkIcon = (x: number, label: string, onClick: () => void): Phaser.GameObjects.Text =>
      this.add
        .text(x, 14, label, {
          fontFamily: FONTS.body,
          fontSize: "16px",
          color: p.text,
          backgroundColor: hexStr(p.panel),
          padding: { x: 10, y: 6 },
        })
        .setDepth(DEPTH.hud)
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          getSystems(this).audio.play("click");
          onClick();
        });

    mkIcon(VIEW.width - 16, "❚❚", () => this.togglePause());
    mkIcon(VIEW.width - 72, "↺", () => {
      this.hideOverlays();
      this.gameScene.restartLevel();
    });
    this.muteBtn = mkIcon(VIEW.width - 122, this.soundLabel(), () => this.toggleSound());
  }

  private soundLabel(): string {
    return getSystems(this).audio.soundEnabled ? "♪" : "∅";
  }

  private toggleSound(): void {
    const { audio, save } = getSystems(this);
    const next = !audio.soundEnabled;
    audio.setSound(next);
    save.updateSettings({ sound: next });
    this.muteBtn.setText(this.soundLabel());
  }

  /* ---------------------------- overlays --------------------------- */

  private makePanel(width: number, height: number): Phaser.GameObjects.Graphics {
    const p = this.palette;
    const gr = this.add.graphics();
    gr.fillStyle(p.panel, 0.97);
    gr.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    gr.lineStyle(2, p.panelLine, 0.9);
    gr.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
    return gr;
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    small = false
  ): Phaser.GameObjects.Text {
    const p = this.palette;
    const btn = this.add
      .text(x, y, label, {
        fontFamily: FONTS.display,
        fontSize: small ? "14px" : "18px",
        fontStyle: "bold",
        color: p.text,
        backgroundColor: hexStr(p.panel),
        padding: BTN_STYLE_PAD,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setColor(hexStr(this.palette.focus)));
    btn.on("pointerout", () => btn.setColor(this.palette.text));
    btn.on("pointerdown", () => {
      getSystems(this).audio.play("click");
      onClick();
    });
    return btn;
  }

  private dimmer(): Phaser.GameObjects.Rectangle {
    return this.add
      .rectangle(VIEW.width / 2, VIEW.height / 2, VIEW.width, VIEW.height, 0x000000, 0.55)
      .setInteractive(); // swallow clicks behind the panel
  }

  private createPauseOverlay(): Phaser.GameObjects.Container {
    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    const container = this.add.container(0, 0).setDepth(DEPTH.overlay).setVisible(false);
    const dim = this.dimmer();
    const panel = this.makePanel(430, 400).setPosition(cx, cy);
    const title = this.add
      .text(cx, cy - 162, "PAUSED", {
        fontFamily: FONTS.display,
        fontSize: "30px",
        fontStyle: "bold",
        color: this.palette.text,
      })
      .setOrigin(0.5);

    const resume = this.makeButton(cx, cy - 104, "RESUME", () => this.togglePause());
    const restart = this.makeButton(cx, cy - 56, "RESTART LEVEL", () => {
      this.togglePause();
      this.gameScene.restartLevel();
    });
    const select = this.makeButton(cx, cy - 8, "LEVEL SELECT", () => this.goToLevelSelect());

    const { save } = getSystems(this);
    const toggles: Phaser.GameObjects.Text[] = [];
    const mkToggle = (
      y: number,
      label: string,
      value: () => boolean,
      apply: (next: boolean) => void
    ) => {
      const btn = this.makeButton(
        cx,
        y,
        "",
        () => {
          apply(!value());
          btn.setText(`${label}: ${value() ? "ON" : "OFF"}`);
        },
        true
      );
      btn.setText(`${label}: ${value() ? "ON" : "OFF"}`);
      toggles.push(btn);
      return btn;
    };

    const soundToggle = mkToggle(
      cy + 44,
      "SOUND",
      () => getSystems(this).audio.soundEnabled,
      (next) => {
        getSystems(this).audio.setSound(next);
        save.updateSettings({ sound: next });
        this.muteBtn.setText(this.soundLabel());
      }
    );
    const musicToggle = mkToggle(
      cy + 88,
      "MUSIC",
      () => getSystems(this).audio.musicEnabled,
      (next) => {
        getSystems(this).audio.setMusic(next);
        save.updateSettings({ music: next });
      }
    );
    const contrastToggle = mkToggle(
      cy + 132,
      "HIGH CONTRAST",
      () => save.settings.highContrast,
      (next) => {
        save.updateSettings({ highContrast: next });
        this.applyPaletteChange();
      }
    );

    const help = this.add
      .text(cx, cy + 176, "Move: ← → / A D   Jump: Space / W / ↑   Restart: R", {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: this.palette.textDim,
      })
      .setOrigin(0.5);

    container.add([dim, panel, title, resume, restart, select, soundToggle, musicToggle, contrastToggle, help]);
    return container;
  }

  private createWinOverlay(): Phaser.GameObjects.Container {
    return this.add.container(0, 0).setDepth(DEPTH.overlay).setVisible(false);
  }

  private showWinOverlay(payload: WinPayload): void {
    this.winOverlay.removeAll(true);
    const cx = VIEW.width / 2;
    const cy = VIEW.height / 2;
    const p = this.palette;

    const dim = this.dimmer();
    const panel = this.makePanel(440, 320).setPosition(cx, cy);
    const title = this.add
      .text(cx, cy - 118, "LEVEL COMPLETE!", {
        fontFamily: FONTS.display,
        fontSize: "30px",
        fontStyle: "bold",
        color: p.text,
      })
      .setOrigin(0.5);
    const time = this.add
      .text(cx, cy - 66, `Time  ${formatTime(payload.timeMs)}`, {
        fontFamily: FONTS.body,
        fontSize: "18px",
        color: p.text,
      })
      .setOrigin(0.5);
    const bestLabel = payload.isBest
      ? "★ New best time!"
      : `Best  ${formatTime(payload.bestTimeMs)}`;
    const best = this.add
      .text(cx, cy - 36, `${bestLabel}    •    Attempts ${payload.attempts}`, {
        fontFamily: FONTS.body,
        fontSize: "14px",
        color: payload.isBest ? hexStr(p.focus) : p.textDim,
      })
      .setOrigin(0.5);

    const items: Phaser.GameObjects.GameObject[] = [dim, panel, title, time, best];
    if (payload.hasNext) {
      items.push(
        this.makeButton(cx, cy + 26, "NEXT LEVEL  →", () => {
          this.winOverlay.setVisible(false);
          this.gameScene.startLevel(payload.levelId + 1);
        })
      );
    } else {
      items.push(
        this.add
          .text(cx, cy + 26, `You finished ${GAME_TITLE}! 🎉`, {
            fontFamily: FONTS.display,
            fontSize: "18px",
            fontStyle: "bold",
            color: hexStr(p.focus),
          })
          .setOrigin(0.5)
      );
    }
    items.push(
      this.makeButton(cx, cy + 78, "REPLAY", () => {
        this.winOverlay.setVisible(false);
        this.gameScene.startLevel(payload.levelId);
      }),
      this.makeButton(cx, cy + 126, "LEVEL SELECT", () => this.goToLevelSelect())
    );
    this.winOverlay.add(items);
    this.winOverlay.setVisible(true);
  }

  private hideOverlays(): void {
    if (this.paused) this.togglePause();
    this.winOverlay.setVisible(false);
  }

  private togglePause(): void {
    if (this.winOverlay.visible) return;
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    if (this.paused) this.scene.pause(SCENES.game);
    else this.scene.resume(SCENES.game);
  }

  private goToLevelSelect(): void {
    this.scene.stop(SCENES.game);
    this.scene.start(SCENES.select);
    this.scene.stop();
  }

  /** Palette changed (high contrast): rebuild game in place + re-theme HUD. */
  private applyPaletteChange(): void {
    if (this.paused) {
      this.paused = false;
      this.scene.resume(SCENES.game);
    }
    this.gameScene.rebuildInPlace();
    this.scene.restart();
  }

  /* ----------------------------- toast ----------------------------- */

  private createToast(): void {
    this.toastText = this.add
      .text(VIEW.width / 2, 96, "", {
        fontFamily: FONTS.display,
        fontSize: "17px",
        fontStyle: "bold",
        color: this.palette.text,
        backgroundColor: hexStr(this.palette.panel),
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.hud)
      .setAlpha(0);
  }

  private showToast(message: string, holdMs = 1400): void {
    this.toastText.setText(message);
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setAlpha(0).setY(88);
    this.tweens.chain({
      targets: this.toastText,
      tweens: [
        { alpha: 1, y: 96, duration: 180, ease: "Quad.easeOut" },
        { alpha: 1, duration: holdMs },
        { alpha: 0, duration: 260 },
      ],
    });
  }

  /* ------------------------- touch controls ------------------------ */

  private createTouchControls(): void {
    this.input.addPointer(3);
    const p = this.palette;
    const y = VIEW.height - 64;
    const mkPad = (x: number, glyph: string, key: string) => {
      const zone = this.add
        .circle(x, y, 44, p.panel, 0.35)
        .setStrokeStyle(2, p.panelLine, 0.5)
        .setDepth(DEPTH.hud)
        .setScrollFactor(0)
        .setInteractive();
      this.add
        .text(x, y, glyph, {
          fontFamily: FONTS.display,
          fontSize: "22px",
          color: p.text,
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.hud)
        .setAlpha(0.8);
      zone.on("pointerdown", () => this.registry.set(key, true));
      zone.on("pointerup", () => this.registry.set(key, false));
      zone.on("pointerout", () => this.registry.set(key, false));
    };
    mkPad(72, "◀", RK.touchLeft);
    mkPad(178, "▶", RK.touchRight);
    mkPad(VIEW.width - 84, "▲", RK.touchJump);
  }

  private clearTouchFlags(): void {
    this.registry.set(RK.touchLeft, false);
    this.registry.set(RK.touchRight, false);
    this.registry.set(RK.touchJump, false);
  }
}
