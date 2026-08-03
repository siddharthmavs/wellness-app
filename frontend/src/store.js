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
