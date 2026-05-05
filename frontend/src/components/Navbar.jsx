import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store";
import {
  LogOut, Zap, Trophy, Smile, MessageSquare, User, LayoutDashboard,
  Megaphone, HandHelping, Shield, Music, Vote, Gamepad2, Brain,
  BookOpen, Cake, MoreHorizontal,
} from "lucide-react";

const PRIMARY = [
  { to: "/", label: "DASH", icon: LayoutDashboard, color: "bg-brutal-yellow" },
  { to: "/leaderboard", label: "TOP DOGS", icon: Trophy, color: "bg-brutal-pink" },
  { to: "/mood", label: "MOOD", icon: Smile, color: "bg-brutal-cyan" },
  { to: "/funwall", label: "FUN WALL", icon: MessageSquare, color: "bg-brutal-green" },
  { to: "/shoutouts", label: "SHOUTS", icon: Megaphone, color: "bg-brutal-yellow" },
];

const MORE = [
  { to: "/help", label: "HELP", icon: HandHelping, color: "bg-brutal-cyan" },
  { to: "/music", label: "MUSIC", icon: Music, color: "bg-brutal-pink" },
  { to: "/polls", label: "POLLS", icon: Vote, color: "bg-brutal-cyan" },
  { to: "/games", label: "GAMES", icon: Gamepad2, color: "bg-brutal-yellow" },
  { to: "/quiz", label: "QUIZ", icon: Brain, color: "bg-brutal-pink" },
  { to: "/learn", label: "LEARN", icon: BookOpen, color: "bg-brutal-green" },
  { to: "/events", label: "EVENTS", icon: Cake, color: "bg-brutal-yellow" },
  { to: "/profile", label: "ME", icon: User, color: "bg-white" },
];

export const Navbar = () => {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const links = [...PRIMARY];
  const more = [...MORE];
  if (user?.role === "admin") {
    more.push({ to: "/admin", label: "ADMIN", icon: Shield, color: "bg-black text-brutal-yellow" });
  }

  return (
    <header data-testid="navbar" className="sticky top-0 z-40 border-b-[4px] border-black bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3 md:gap-4 flex-wrap">
        <motion.div
          initial={{ rotate: -3 }} animate={{ rotate: -2 }} whileHover={{ rotate: 2, scale: 1.05 }}
          className="bg-black text-brutal-yellow px-3 py-1.5 border-[3px] border-black shadow-brutal-sm font-display font-black text-base md:text-lg uppercase tracking-tighter"
        >
          <Zap className="inline w-4 h-4 mr-1 -mt-1" /> BRUTAL
        </motion.div>

        <nav className="flex gap-1.5 flex-wrap" data-testid="nav-links">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-1 font-black uppercase text-[11px] tracking-wider px-2.5 py-1.5 border-[3px] border-black rounded-[2px] transition-all ${
                  isActive ? `${l.color} shadow-brutal-sm` : "bg-white hover:-translate-y-0.5"
                }`
              }
            >
              <l.icon className="w-3.5 h-3.5" /> {l.label}
            </NavLink>
          ))}
          <div className="relative">
            <button
              data-testid="nav-more-btn"
              onClick={() => setMoreOpen(!moreOpen)}
              className={`flex items-center gap-1 font-black uppercase text-[11px] tracking-wider px-2.5 py-1.5 border-[3px] border-black rounded-[2px] ${moreOpen ? "bg-brutal-yellow shadow-brutal-sm" : "bg-white"}`}
            >
              <MoreHorizontal className="w-3.5 h-3.5" /> MORE
            </button>
            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, rotate: -2 }}
                  animate={{ opacity: 1, y: 0, rotate: -1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full right-0 mt-2 z-50 bg-white border-[4px] border-black shadow-brutal-lg p-2 grid grid-cols-2 gap-1.5 min-w-[260px]"
                  data-testid="nav-more-menu"
                >
                  {more.map((l) => (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      onClick={() => setMoreOpen(false)}
                      data-testid={`nav-${l.label.toLowerCase()}`}
                      className={({ isActive }) =>
                        `flex items-center gap-1 font-black uppercase text-[11px] px-2 py-2 border-[3px] border-black rounded-[2px] ${isActive ? `${l.color}` : "bg-white hover:bg-brutal-yellow"}`
                      }
                    >
                      <l.icon className="w-3.5 h-3.5" /> {l.label}
                    </NavLink>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 bg-brutal-yellow border-[3px] border-black px-3 py-1.5 shadow-brutal-sm">
            <span className="font-black text-xs uppercase">🔥 {user?.streak || 0}</span>
            <span className="font-black text-xs uppercase border-l-2 border-black pl-2">⚡ {user?.points || 0}</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95, x: 2, y: 2 }}
            data-testid="logout-btn"
            onClick={() => { logout(); nav("/login"); }}
            className="bg-brutal-pink border-[3px] border-black px-3 py-2 shadow-brutal-sm font-black uppercase text-xs flex items-center gap-1"
          >
            <LogOut className="w-4 h-4" /> BOUNCE
          </motion.button>
        </div>
      </div>
    </header>
  );
};
