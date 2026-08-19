import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore, useThemeStore } from "../store";
import { NotificationBell } from "./NotificationBell";
import { IconSeedling, IconBolt } from "./HandDrawn";

import {
  LogOut,
  Home,
  Trophy,
  Smile,
  MessageSquare,
  User,
  Sparkles,
  HandHelping,
  Shield,
  Music,
  Vote,
  Gamepad2,
  Brain,
  BookOpen,
  Cake,
  MoreHorizontal,
  Sun,
  Moon,
  Swords,
  Settings,
} from "lucide-react";

const PRIMARY = [
  { to: "/", label: "Home", icon: Home },
  { to: "/leaderboard", label: "Journey", icon: Trophy },
  { to: "/mood", label: "Mood", icon: Smile },
  { to: "/funwall", label: "Community", icon: MessageSquare },
  { to: "/shoutouts", label: "Kudos", icon: Sparkles },
];

const MORE = [
  { to: "/help", label: "Help", icon: HandHelping },
  { to: "/music", label: "Music", icon: Music },
  { to: "/polls", label: "Polls", icon: Vote },
  { to: "/games", label: "Games", icon: Gamepad2 },
  { to: "/quiz", label: "Quiz", icon: Brain },
  { to: "/learn", label: "Learn", icon: BookOpen },
  { to: "/events", label: "Events", icon: Cake },
  { to: "/teams", label: "Teams", icon: Swords },
  { to: "/profile", label: "Me", icon: User },
];

export const Navbar = () => {
  const { user, logout } = useAuthStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const nav = useNavigate();

  const [moreOpen, setMoreOpen] = useState(false);

  // Reference for the entire More dropdown area
  const moreRef = useRef(null);

  // Close dropdown when clicking anywhere outside it
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        moreRef.current &&
        !moreRef.current.contains(event.target)
      ) {
        setMoreOpen(false);
      }
    };

    if (moreOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [moreOpen]);

  const more = [...MORE];

  if (user?.role === "admin") {
    more.push({
      to: "/admin",
      label: "Admin",
      icon: Shield,
    });
  }

  return (
    <header
      data-testid="navbar"
      className="sticky top-0 z-40 bg-cozy-surface"
      style={{
        borderBottom: "1px solid var(--cozy-border)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3 md:gap-4 flex-wrap">

        {/* BRAND */}
        <motion.div
          whileHover={{ scale: 1.04 }}
          className="flex items-center gap-2 font-display font-semibold text-lg text-cozy-primary-dark"
        >
          <span className="text-2xl"></span>
          <span className="hidden sm:inline">
            Wellness Garden
          </span>
        </motion.div>

        {/* NAVIGATION */}
        <nav
          className="flex gap-1.5 flex-wrap"
          data-testid="nav-links"
        >
          {PRIMARY.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              data-testid={`nav-${l.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-1.5 font-semibold text-xs md:text-sm px-3 py-2 rounded-full transition-all ${
                  isActive
                    ? "bg-cozy-primary text-white shadow-cozy"
                    : "text-cozy-text hover:bg-cozy-secondary/60"
                }`
              }
            >
              <l.icon className="w-4 h-4" />
              {l.label}
            </NavLink>
          ))}

          {/* MORE DROPDOWN */}
          <div
            ref={moreRef}
            className="relative"
          >
            <button
              type="button"
              data-testid="nav-more-btn"
              onClick={() => setMoreOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 font-semibold text-xs md:text-sm px-3 py-2 rounded-full transition-all ${
                moreOpen
                  ? "bg-cozy-secondary shadow-cozy"
                  : "text-cozy-text hover:bg-cozy-secondary/60"
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
              More
            </button>

            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: -6,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: -6,
                  }}
                  transition={{
                    duration: 0.18,
                  }}
                  className="absolute top-full right-0 mt-2 z-50 bg-cozy-surface shadow-cozy-lg p-2 grid grid-cols-2 gap-1.5 min-w-[280px]"
                  style={{
                    border: "1px solid var(--cozy-border)",
                    borderRadius: 20,
                  }}
                  data-testid="nav-more-menu"
                >
                  {more.map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      onClick={() => setMoreOpen(false)}
                      data-testid={`nav-${l.label.toLowerCase()}`}
                      className={({ isActive }) =>
                        `flex items-center gap-2 font-semibold text-xs px-3 py-2 rounded-full transition ${
                          isActive
                            ? "bg-cozy-primary text-white"
                            : "text-cozy-text hover:bg-cozy-secondary/50"
                        }`
                      }
                    >
                      <l.icon className="w-4 h-4" />
                      {l.label}
                    </NavLink>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* RIGHT SIDE */}
        <div className="ml-auto flex items-center gap-2">

          {/* STREAK + POINTS */}
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full"
            style={{
              background: "var(--cozy-secondary)",
            }}
          >
            <IconSeedling size={20} />

            <span className="font-bold text-xs">
              {user?.streak || 0}
            </span>

            <span className="font-bold text-xs opacity-40">
              ·
            </span>

            <IconBolt size={18} />

            <span className="font-bold text-xs">
              {user?.points || 0}
            </span>
          </div>

          {/* NOTIFICATIONS */}
          <NotificationBell />

          {/* THEME */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            data-testid="theme-toggle"
            onClick={toggleTheme}
            className="p-2 rounded-full shadow-cozy"
            style={{
              background: "var(--cozy-surface)",
              border: "1px solid var(--cozy-border)",
            }}
            title="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </motion.button>

          {/* SETTINGS */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            data-testid="settings-btn"
            onClick={() => nav("/settings")}
            className="p-2 rounded-full shadow-cozy"
            style={{
              background: "var(--cozy-surface)",
              border: "1px solid var(--cozy-border)",
            }}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </motion.button>

          {/* LOGOUT */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            data-testid="logout-btn"
            onClick={() => {
              logout();
              nav("/login");
            }}
            className="px-3 py-2 rounded-full font-semibold text-xs flex items-center gap-1 text-cozy-text shadow-cozy"
            style={{
              background: "var(--cozy-accent)",
            }}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </motion.button>
        </div>
      </div>
    </header>
  );
};