import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
 persist(
 (set, get) => ({
 token: null,
 user: null,
 setAuth: (token, user) => set({ token, user }),
 setUser: (user) => set({ user }),
 logout: () => set({ token: null, user: null }),
 }),
 { name: "brutal-auth" }
 )
);

// Music Zone — global player state (persisted so playback survives route changes)
export const useMusicStore = create(
  persist(
    (set, get) => ({
      queue: [],           // array of track objects
      currentIndex: -1,    // index into queue
      playing: false,
      volume: 0.7,
      muted: false,
      setQueue: (queue, currentIndex = 0) => set({ queue, currentIndex, playing: true }),
      playAt: (index) => set({ currentIndex: index, playing: true }),
      togglePlay: () => set((s) => ({ playing: !s.playing })),
      setPlaying: (playing) => set({ playing }),
      next: () => set((s) => {
        if (!s.queue.length) return {};
        return { currentIndex: (s.currentIndex + 1) % s.queue.length, playing: true };
      }),
      prev: () => set((s) => {
        if (!s.queue.length) return {};
        return { currentIndex: (s.currentIndex - 1 + s.queue.length) % s.queue.length, playing: true };
      }),
      setVolume: (volume) => set({ volume }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      updateTrack: (id, patch) => set((s) => ({
        queue: s.queue.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
      removeTrack: (id) => set((s) => {
        const idx = s.queue.findIndex((t) => t.id === id);
        if (idx < 0) return {};
        const newQueue = s.queue.filter((t) => t.id !== id);
        let ci = s.currentIndex;
        if (idx < ci) ci -= 1;
        else if (idx === ci) ci = newQueue.length ? Math.min(ci, newQueue.length - 1) : -1;
        return { queue: newQueue, currentIndex: ci, playing: newQueue.length ? s.playing : false };
      }),
      clear: () => set({ queue: [], currentIndex: -1, playing: false }),
    }),
    { name: "wg-music" }
  )
);

export const useThemeStore = create(
 persist(
 (set, get) => ({
 theme: "light",
 toggle: () => {
 const next = get().theme === "light" ? "dark" : "light";
 set({ theme: next });
 if (typeof document !== "undefined") {
 document.documentElement.classList.toggle("dark", next === "dark");
 }
 },
 apply: () => {
 if (typeof document !== "undefined") {
 document.documentElement.classList.toggle("dark", get().theme === "dark");
 }
 },
 }),
 { name: "brutal-theme" }
 )
);
