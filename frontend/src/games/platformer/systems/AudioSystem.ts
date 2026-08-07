/**
 * Procedural Web Audio sound system. All sounds are synthesized — tiny,
 * original, and zero asset downloads. One AudioContext for the whole game,
 * closed when the game is destroyed.
 */

type SfxName =
  | "jump"
  | "land"
  | "death"
  | "door"
  | "checkpoint"
  | "victory"
  | "click"
  | "spike"
  | "collapse"
  | "poof";

const SFX_GAIN = 0.5;
const MUSIC_GAIN = 0.16;

/** Gentle pentatonic pool for the generative ambient loop. */
const MUSIC_NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
const MUSIC_STEP_S = 1.05;
const MUSIC_LOOKAHEAD_S = 0.9;
const MUSIC_TICK_MS = 320;

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;
  private soundOn: boolean;
  private musicOn: boolean;
  private destroyed = false;

  constructor(sound: boolean, music: boolean) {
    this.soundOn = sound;
    this.musicOn = music;
  }

  setSound(on: boolean): void {
    this.soundOn = on;
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  get soundEnabled(): boolean {
    return this.soundOn;
  }

  get musicEnabled(): boolean {
    return this.musicOn;
  }

  /** Call from a user-gesture-driven point (scene start) to unlock audio. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === "suspended") void ctx.resume();
    if (this.musicOn) this.startMusic();
  }

  play(name: SfxName): void {
    if (!this.soundOn || this.destroyed) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    switch (name) {
      case "jump":
        this.blip(t, "triangle", 300, 540, 0.09, 0.22);
        break;
      case "land":
        this.blip(t, "sine", 170, 120, 0.07, 0.14);
        break;
      case "death":
        this.blip(t, "sawtooth", 320, 55, 0.26, 0.2);
        this.blip(t + 0.02, "square", 200, 40, 0.22, 0.08);
        break;
      case "door":
        this.blip(t, "triangle", 523, 523, 0.08, 0.16);
        this.blip(t + 0.09, "triangle", 659, 659, 0.08, 0.16);
        break;
      case "checkpoint":
        this.blip(t, "sine", 880, 880, 0.07, 0.16);
        this.blip(t + 0.08, "sine", 1318, 1318, 0.12, 0.14);
        break;
      case "victory":
        [523, 659, 784, 1046].forEach((f, i) =>
          this.blip(t + i * 0.09, "triangle", f, f, 0.12, 0.18)
        );
        break;
      case "click":
        this.blip(t, "square", 640, 640, 0.03, 0.07);
        break;
      case "spike":
        this.blip(t, "square", 150, 210, 0.06, 0.12);
        break;
      case "collapse":
        this.blip(t, "triangle", 220, 70, 0.18, 0.16);
        break;
      case "poof":
        this.blip(t, "sine", 420, 90, 0.12, 0.14);
        break;
    }
  }

  /** Halt the audio clock while the tab is hidden. */
  suspend(): void {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  destroy(): void {
    this.destroyed = true;
    this.stopMusic();
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
      this.sfxBus = null;
      this.musicBus = null;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.destroyed) return null;
    if (this.ctx) return this.ctx;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = SFX_GAIN;
    this.sfxBus.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = MUSIC_GAIN;
    this.musicBus.connect(this.ctx.destination);
    return this.ctx;
  }

  private blip(
    at: number,
    type: OscillatorType,
    fromHz: number,
    toHz: number,
    durationS: number,
    peak: number
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fromHz, at);
    if (toHz !== fromHz) osc.frequency.exponentialRampToValueAtTime(Math.max(toHz, 1), at + durationS);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + durationS);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(at);
    osc.stop(at + durationS + 0.05);
  }

  /**
   * Generative ambient loop: schedules soft pad notes slightly ahead of
   * time using the AudioContext clock. The single interval only exists
   * while music is enabled.
   */
  private startMusic(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.musicTimer !== null || this.destroyed) return;
    this.nextNoteTime = ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), MUSIC_TICK_MS);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    while (this.nextNoteTime < ctx.currentTime + MUSIC_LOOKAHEAD_S) {
      const t = this.nextNoteTime;
      const base = MUSIC_NOTES[this.noteIndex % MUSIC_NOTES.length];
      const freq = this.noteIndex % 4 === 3 ? base / 2 : base;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + 0.35);
      gain.gain.linearRampToValueAtTime(0, t + MUSIC_STEP_S * 1.6);
      osc.connect(gain).connect(this.musicBus);
      osc.start(t);
      osc.stop(t + MUSIC_STEP_S * 1.7);
      // wandering walk over the pentatonic pool keeps it non-repetitive
      this.noteIndex += 1 + (Math.floor(t) % 3 === 0 ? 1 : 0);
      this.nextNoteTime += MUSIC_STEP_S;
    }
  }
}
