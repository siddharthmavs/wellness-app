/**
 * LocalStorage-backed save system. Pure TypeScript with no Phaser
 * dependency so the React shell can read progress without pulling the
 * game bundle in.
 */

export interface LevelStats {
  bestTimeMs: number | null;
  attempts: number;
  completed: boolean;
}

export interface GameSettings {
  sound: boolean;
  music: boolean;
  highContrast: boolean;
}

export interface SaveData {
  version: 1;
  unlockedLevel: number;
  levels: Record<number, LevelStats>;
  settings: GameSettings;
}

const STORAGE_KEY = "wellness.trickstep.save.v1";

const DEFAULT_SAVE: SaveData = {
  version: 1,
  unlockedLevel: 1,
  levels: {},
  settings: { sound: true, music: true, highContrast: false },
};

function readStorage(): SaveData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredCloneSafe(DEFAULT_SAVE);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...structuredCloneSafe(DEFAULT_SAVE),
      ...parsed,
      settings: { ...DEFAULT_SAVE.settings, ...(parsed.settings ?? {}) },
      levels: parsed.levels ?? {},
    };
  } catch {
    return structuredCloneSafe(DEFAULT_SAVE);
  }
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = readStorage();
  }

  get unlockedLevel(): number {
    return this.data.unlockedLevel;
  }

  get settings(): GameSettings {
    return { ...this.data.settings };
  }

  statsFor(levelId: number): LevelStats {
    return (
      this.data.levels[levelId] ?? { bestTimeMs: null, attempts: 0, completed: false }
    );
  }

  isUnlocked(levelId: number): boolean {
    return levelId <= this.data.unlockedLevel;
  }

  recordAttempt(levelId: number): void {
    const stats = this.statsFor(levelId);
    this.data.levels[levelId] = { ...stats, attempts: stats.attempts + 1 };
    this.persist();
  }

  /** Returns true when this run is a new best time. */
  recordCompletion(levelId: number, timeMs: number, totalLevels: number): boolean {
    const stats = this.statsFor(levelId);
    const isBest = stats.bestTimeMs === null || timeMs < stats.bestTimeMs;
    this.data.levels[levelId] = {
      ...stats,
      completed: true,
      bestTimeMs: isBest ? timeMs : stats.bestTimeMs,
    };
    if (levelId >= this.data.unlockedLevel && levelId < totalLevels) {
      this.data.unlockedLevel = levelId + 1;
    }
    this.persist();
    return isBest;
  }

  updateSettings(patch: Partial<GameSettings>): GameSettings {
    this.data.settings = { ...this.data.settings, ...patch };
    this.persist();
    return this.settings;
  }

  private persist(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or unavailable — play on without persistence.
    }
  }
}

/** Lightweight read used by the React games page (no instance kept alive). */
export function peekProgress(): {
  unlockedLevel: number;
  completedCount: number;
  bestTotalMs: number | null;
} {
  const data = readStorage();
  const levels = Object.values(data.levels);
  const completed = levels.filter((l) => l.completed);
  const bestTotal = completed.length
    ? completed.reduce((sum, l) => sum + (l.bestTimeMs ?? 0), 0)
    : null;
  return {
    unlockedLevel: data.unlockedLevel,
    completedCount: completed.length,
    bestTotalMs: bestTotal,
  };
}

export function formatTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "--:--.-";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds * 10) % 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}
