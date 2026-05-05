import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Trophy, MessageSquare, Smile, User } from "lucide-react";

const ITEMS = [
  { to: "/", label: "Dash", icon: LayoutDashboard },
  { to: "/leaderboard", label: "Top", icon: Trophy },
  { to: "/funwall", label: "Fun", icon: MessageSquare },
  { to: "/mood", label: "Mood", icon: Smile },
  { to: "/profile", label: "Me", icon: User },
];

export const BottomNav = () => (
  <nav
    data-testid="bottom-nav"
    className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t-[4px] border-black bg-white grid grid-cols-5"
  >
    {ITEMS.map((it) => (
      <NavLink
        key={it.to}
        to={it.to}
        end={it.to === "/"}
        data-testid={`bnav-${it.label.toLowerCase()}`}
        className={({ isActive }) =>
          `flex flex-col items-center justify-center py-2 border-r-[3px] last:border-r-0 border-black font-black uppercase text-[10px] tracking-wider ${
            isActive ? "bg-brutal-yellow" : "bg-white"
          }`
        }
      >
        <it.icon className="w-5 h-5 mb-0.5" />
        {it.label}
      </NavLink>
    ))}
  </nav>
);
