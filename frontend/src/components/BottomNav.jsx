import React from "react";
import { NavLink } from "react-router-dom";
import { Home, Trophy, MessageSquare, Smile, User } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/leaderboard", label: "Journey", icon: Trophy },
  { to: "/funwall", label: "Community", icon: MessageSquare },
  { to: "/mood", label: "Mood", icon: Smile },
  { to: "/profile", label: "Me", icon: User },
];

export const BottomNav = () => (
  <nav
    data-testid="bottom-nav"
    className="md:hidden fixed bottom-3 left-3 right-3 z-30 grid grid-cols-5"
    style={{
      background: "var(--cozy-surface)",
      border: "1px solid var(--cozy-border)",
      borderRadius: 999,
      boxShadow: "var(--shadow-cozy-lg)",
      padding: 4,
    }}
  >
    {ITEMS.map((it) => (
      <NavLink
        key={it.to}
        to={it.to}
        end={it.to === "/"}
        data-testid={`bnav-${it.label.toLowerCase()}`}
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 rounded-full font-semibold text-[10px] transition ${
            isActive ? "bg-cozy-primary text-white" : "text-cozy-text"
          }`
        }
      >
        <it.icon className="w-5 h-5 mb-0.5" />
        {it.label}
      </NavLink>
    ))}
  </nav>
);
