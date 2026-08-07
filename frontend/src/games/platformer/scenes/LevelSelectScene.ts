import Phaser from "phaser";
import { DEPTH, FONTS, GAME_TITLE, hexStr, Palette, SCENES, VIEW } from "../config/constants";
import { LEVELS } from "../levels";
import { currentPalette, getSystems } from "../systems/context";
import { formatTime } from "../systems/SaveManager";
import { buildTextures } from "../systems/TextureFactory";
import { GameSceneData } from "./GameScene";

const GRID = { cols: 4, cardW: 196, cardH: 116, gapX: 24, gapY: 26, top: 168 } as const;

/**
 * Level picker: keyboard-navigable cards with per-level stats, plus the
 * quick settings row. Everything is text/vector-drawn.
 */
export class LevelSelectScene extends Phaser.Scene {
  private palette!: Palette;
  private focusIndex = 0;
  private focusRing!: Phaser.GameObjects.Graphics;
  private cardPositions: { x: number; y: number }[] = [];

  constructor() {
    super(SCENES.select);
  }

  create(): void {
    this.palette = currentPalette(this);
    buildTextures(this, this.palette); // rebuild if the palette changed
    this.cameras.main.setBackgroundColor(this.palette.bg);
    this.cardPositions = [];

    this.createHeader();
    LEVELS.forEach((level, i) => this.createCard(i));
    this.focusRing = this.add.graphics().setDepth(DEPTH.hud);
    this.focusIndex = Math.min(
      getSystems(this).save.unlockedLevel - 1,
      LEVELS.length - 1
    );
    this.drawFocusRing();
    this.createSettingsRow();
    this.bindKeys();
  }

  private createHeader(): void {
    const p = this.palette;
    const { save } = getSystems(this);
    const completed = LEVELS.filter((l) => save.statsFor(l.id).completed).length;
    this.add
      .text(VIEW.width / 2, 62, GAME_TITLE, {
        fontFamily: FONTS.display,
        fontSize: "52px",
        fontStyle: "bold",
        color: p.text,
      })
      .setOrigin(0.5);
    this.add
      .text(
        VIEW.width / 2,
        112,
        `Reach the door. Trust nothing.   •   ${completed}/${LEVELS.length} complete`,
        {
          fontFamily: FONTS.body,
          fontSize: "15px",
          color: p.textDim,
        }
      )
      .setOrigin(0.5);
  }

  private cardXY(index: number): { x: number; y: number } {
    const col = index % GRID.cols;
    const row = Math.floor(index / GRID.cols);
    const totalW = GRID.cols * GRID.cardW + (GRID.cols - 1) * GRID.gapX;
    const startX = (VIEW.width - totalW) / 2;
    return {
      x: startX + col * (GRID.cardW + GRID.gapX),
      y: GRID.top + row * (GRID.cardH + GRID.gapY),
    };
  }

  private createCard(index: number): void {
    const level = LEVELS[index];
    const { save, audio } = getSystems(this);
    const p = this.palette;
    const unlocked = save.isUnlocked(level.id);
    const stats = save.statsFor(level.id);
    const { x, y } = this.cardXY(index);
    this.cardPositions.push({ x, y });

    const gr = this.add.graphics();
    gr.fillStyle(p.panel, unlocked ? 1 : 0.45);
    gr.fillRoundedRect(x, y, GRID.cardW, GRID.cardH, 12);
    gr.lineStyle(2, unlocked ? p.panelLine : p.bgDecor, 1);
    gr.strokeRoundedRect(x, y, GRID.cardW, GRID.cardH, 12);

    const alpha = unlocked ? 1 : 0.45;
    this.add
      .text(x + 14, y + 10, `${level.id}`, {
        fontFamily: FONTS.display,
        fontSize: "30px",
        fontStyle: "bold",
        color: unlocked ? hexStr(p.focus) : p.textDim,
      })
      .setAlpha(alpha);
    this.add
      .text(x + 14, y + 48, unlocked ? level.name : "Locked", {
        fontFamily: FONTS.display,
        fontSize: "15px",
        fontStyle: "bold",
        color: p.text,
      })
      .setAlpha(alpha);
    const detail = unlocked
      ? stats.completed
        ? `★ ${formatTime(stats.bestTimeMs)}  •  ${stats.attempts} tries`
        : stats.attempts > 0
          ? `${stats.attempts} tries — unbeaten`
          : "Not played yet"
      : "Finish the previous level";
    this.add
      .text(x + 14, y + 74, detail, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: p.textDim,
      })
      .setAlpha(alpha);
    if (!unlocked) {
      this.add
        .text(x + GRID.cardW - 16, y + 12, "🔒", { fontSize: "16px" })
        .setOrigin(1, 0)
        .setAlpha(0.8);
    }

    const hit = this.add
      .rectangle(x + GRID.cardW / 2, y + GRID.cardH / 2, GRID.cardW, GRID.cardH, 0, 0)
      .setInteractive({ useHandCursor: unlocked });
    hit.on("pointerover", () => {
      this.focusIndex = index;
      this.drawFocusRing();
    });
    hit.on("pointerdown", () => {
      if (!unlocked) return;
      audio.play("click");
      this.startLevel(level.id);
    });
  }

  private drawFocusRing(): void {
    const { x, y } = this.cardPositions[this.focusIndex];
    this.focusRing.clear();
    this.focusRing.lineStyle(3, this.palette.focus, 1);
    this.focusRing.strokeRoundedRect(x - 3, y - 3, GRID.cardW + 6, GRID.cardH + 6, 14);
  }

  private moveFocus(delta: number): void {
    const next = Phaser.Math.Clamp(this.focusIndex + delta, 0, LEVELS.length - 1);
    if (next !== this.focusIndex) {
      this.focusIndex = next;
      this.drawFocusRing();
      getSystems(this).audio.play("click");
    }
  }

  private bindKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on("keydown-LEFT", () => this.moveFocus(-1));
    kb.on("keydown-RIGHT", () => this.moveFocus(1));
    kb.on("keydown-UP", () => this.moveFocus(-GRID.cols));
    kb.on("keydown-DOWN", () => this.moveFocus(GRID.cols));
    kb.on("keydown-ENTER", () => this.startFocused());
    kb.on("keydown-SPACE", () => this.startFocused());
  }

  private startFocused(): void {
    const level = LEVELS[this.focusIndex];
    if (!getSystems(this).save.isUnlocked(level.id)) return;
    getSystems(this).audio.play("click");
    this.startLevel(level.id);
  }

  private startLevel(levelId: number): void {
    this.scene.start(SCENES.game, {
      levelId,
      elapsedMs: 0,
      attempts: 0,
    } satisfies GameSceneData);
  }

  private createSettingsRow(): void {
    const { save, audio } = getSystems(this);
    const p = this.palette;
    const y = VIEW.height - 44;
    const mk = (
      x: number,
      label: () => string,
      onClick: () => void
    ): Phaser.GameObjects.Text => {
      const btn = this.add
        .text(x, y, label(), {
          fontFamily: FONTS.body,
          fontSize: "13px",
          fontStyle: "bold",
          color: p.text,
          backgroundColor: hexStr(p.panel),
          padding: { x: 12, y: 7 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerover", () => btn.setColor(hexStr(p.focus)));
      btn.on("pointerout", () => btn.setColor(p.text));
      btn.on("pointerdown", () => {
        audio.play("click");
        onClick();
        btn.setText(label());
      });
      return btn;
    };

    mk(
      VIEW.width / 2 - 170,
      () => `SOUND: ${audio.soundEnabled ? "ON" : "OFF"}`,
      () => {
        audio.setSound(!audio.soundEnabled);
        save.updateSettings({ sound: audio.soundEnabled });
      }
    );
    mk(
      VIEW.width / 2,
      () => `MUSIC: ${audio.musicEnabled ? "ON" : "OFF"}`,
      () => {
        audio.setMusic(!audio.musicEnabled);
        save.updateSettings({ music: audio.musicEnabled });
      }
    );
    mk(
      VIEW.width / 2 + 170,
      () => `HIGH CONTRAST: ${save.settings.highContrast ? "ON" : "OFF"}`,
      () => {
        save.updateSettings({ highContrast: !save.settings.highContrast });
        this.scene.restart();
      }
    );
  }
}
