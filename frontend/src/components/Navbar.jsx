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

/* =========================================================
   PRIMARY NAVIGATION
========================================================= */

const PRIMARY = [
  {
    to: "/",
    label: "Home",
    icon: Home,
  },
  {
    to: "/leaderboard",
    label: "Journey",
    icon: Trophy,
  },
  {
    to: "/mood",
    label: "Mood",
    icon: Smile,
  },
  {
    to: "/funwall",
    label: "Community",
    icon: MessageSquare,
  },
  {
    to: "/shoutouts",
    label: "Kudos",
    icon: Sparkles,
  },
];

/* =========================================================
   MORE MENU
========================================================= */

const MORE = [
  {
    to: "/help",
    label: "Help",
    icon: HandHelping,
  },
  {
    to: "/music",
    label: "Music",
    icon: Music,
  },
  {
    to: "/polls",
    label: "Polls",
    icon: Vote,
  },
  {
    to: "/games",
    label: "Games",
    icon: Gamepad2,
  },
  {
    to: "/quiz",
    label: "Quiz",
    icon: Brain,
  },
  {
    to: "/learn",
    label: "Learn",
    icon: BookOpen,
  },
  {
    to: "/events",
    label: "Events",
    icon: Cake,
  },
  {
    to: "/teams",
    label: "Teams",
    icon: Swords,
  },
  {
    to: "/profile",
    label: "Me",
    icon: User,
  },
];

/* =========================================================
   NAVBAR
========================================================= */

export const Navbar = () => {
  const { user, logout } = useAuthStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const [moreOpen, setMoreOpen] = useState(false);

  const moreRef = useRef(null);

  /* =======================================================
     CLOSE MORE WHEN CLICKING OUTSIDE
  ======================================================= */

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
      document.addEventListener(
        "mousedown",
        handleOutsideClick
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, [moreOpen]);

  /* =======================================================
     BUILD MORE MENU
  ======================================================= */

  const more = [...MORE];

  if (user?.role === "admin") {
    more.push({
      to: "/admin",
      label: "Admin",
      icon: Shield,
    });
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <header
      data-testid="navbar"
      className="global-navigation sticky top-0 z-40"
      style={{
        background: "var(--navbar-bg)",
        borderBottom: "1px solid var(--cozy-border)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        className="
          max-w-7xl
          mx-auto
          px-4
          md:px-6
          py-3
          flex
          items-center
          gap-3
          md:gap-4
          flex-wrap
        "
      >

        {/* =================================================
            BRAND
        ================================================= */}

        <motion.div
          whileHover={{ scale: 1.04 }}
          className="
            flex
            items-center
            gap-2
            font-display
            font-semibold
            text-lg
            text-cozy-primary-dark
          "
        >
          <span className="text-2xl"></span>

          <span className="hidden sm:inline">
            Wellness Garden
          </span>
        </motion.div>

        {/* =================================================
            PRIMARY NAVIGATION
        ================================================= */}

        <nav
          className="flex gap-1.5 flex-wrap"
          data-testid="nav-links"
        >
          {PRIMARY.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={({ isActive }) =>
                  `
                    navbar-nav-item
                    flex
                    items-center
                    gap-1.5
                    font-semibold
                    text-xs
                    md:text-sm
                    px-3
                    py-2
                    rounded-full
                    transition-all
                    ${
                      isActive
                        ? "bg-cozy-primary text-white shadow-cozy"
                        : "text-cozy-text hover:bg-cozy-secondary/60"
                    }
                  `
                }
              >
                <Icon className="w-4 h-4 shrink-0" />

                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {/* ===============================================
              MORE BUTTON + DROPDOWN
          =============================================== */}

          <div
            ref={moreRef}
            className="relative"
          >
            <button
              type="button"
              data-testid="nav-more-btn"
              onClick={() =>
                setMoreOpen((previous) => !previous)
              }
              className={`
                navbar-more-button
                flex
                items-center
                gap-1.5
                font-semibold
                text-xs
                md:text-sm
                px-3
                py-2
                rounded-full
                transition-all
                ${
                  moreOpen
                    ? "bg-cozy-secondary shadow-cozy"
                    : "text-cozy-text hover:bg-cozy-secondary/60"
                }
              `}
            >
              <MoreHorizontal className="w-4 h-4 shrink-0" />

              <span>More</span>
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
                  className="
                    more-dropdown
                    absolute
                    top-full
                    right-0
                    mt-2
                    z-50
                    p-2
                    grid
                    grid-cols-2
                    gap-1.5
                    min-w-[280px]
                    shadow-cozy-lg
                  "
                  data-testid="nav-more-menu"
                >
                  {more.map((item) => {
                    const Icon = item.icon;

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMoreOpen(false)}
                        data-testid={`nav-${item.label.toLowerCase()}`}
                        className={({ isActive }) =>
                          `
                            more-dropdown-item
                            flex
                            items-center
                            gap-2
                            font-semibold
                            text-xs
                            px-3
                            py-2
                            rounded-full
                            transition
                            ${
                              isActive
                                ? "bg-cozy-primary text-white"
                                : "text-cozy-text hover:bg-cozy-secondary/50"
                            }
                          `
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" />

                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* =================================================
            RIGHT SIDE
        ================================================= */}

        <div className="ml-auto flex items-center gap-2">

          {/* ===============================================
              STREAK + POINTS
          =============================================== */}

          <div
            className="
              hidden
              md:flex
              items-center
              gap-2
              px-3
              py-1
              rounded-full
            "
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

          {/* ===============================================
              NOTIFICATIONS
          =============================================== */}

          <NotificationBell />

          {/* ===============================================
              THEME TOGGLE
          =============================================== */}

          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            data-testid="theme-toggle"
            onClick={toggleTheme}
            className="
              navbar-icon-button
              p-2
              rounded-full
              shadow-cozy
            "
            style={{
              background: "var(--cozy-surface)",
              border: "1px solid var(--cozy-border)",
            }}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </motion.button>

          {/* ===============================================
              SETTINGS
          =============================================== */}

          <motion.button
            whileTap={{ scale: 0.9 }}
            type="button"
            data-testid="settings-btn"
            onClick={() => navigate("/settings")}
            className="
              navbar-icon-button
              p-2
              rounded-full
              shadow-cozy
            "
            style={{
              background: "var(--cozy-surface)",
              border: "1px solid var(--cozy-border)",
            }}
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </motion.button>

          {/* ===============================================
              LOGOUT
          =============================================== */}

          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            data-testid="logout-btn"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="
              navbar-logout
              px-3
              py-2
              rounded-full
              font-semibold
              text-xs
              flex
              items-center
              gap-1
              shadow-cozy
            "
            style={{
              background: "var(--cozy-accent)",
            }}
          >
            <LogOut className="w-4 h-4 shrink-0" />

            <span>Sign out</span>
          </motion.button>
        </div>
      </div>
    </header>
  );
};

