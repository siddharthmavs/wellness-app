import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalTag } from "../components/brutal";
import { Crown, Trophy, Medal } from "lucide-react";

const PERIODS = [
  { id: "daily", label: "📅 Today" },
  { id: "weekly", label: "🗓️ Week" },
  { id: "monthly", label: "📆 Month" },
  { id: "all", label: "🏆 All-time" },
];

const MEDALS = [
  { color: "bg-brutal-yellow", icon: Crown, label: "🥇" },
  { color: "bg-brutal-cyan", icon: Trophy, label: "🥈" },
  { color: "bg-brutal-pink", icon: Medal, label: "🥉" },
];

export default function Leaderboard() {
  const [period, setPeriod] = useState("all");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get(`/leaderboard?period=${period}`).then(({ data }) => setUsers(data));
  }, [period]);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ y: -20, opacity: 0, rotate: -2 }} animate={{ y: 0, opacity: 1, rotate: -1 }}
        className="bg-black text-brutal-yellow border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block rounded-[4px]"
      >
        <h1 className="font-display font-black text-5xl md:text-6xl uppercase leading-none">🏆 TOP DOGS</h1>
        <p className="text-xs uppercase tracking-widest mt-2">who's winning the wellness game</p>
      </motion.div>

      <div className="flex gap-2 mb-6 flex-wrap" data-testid="leaderboard-filters">
        {PERIODS.map((p) => (
          <BrutalTag key={p.id} active={period === p.id} color="yellow" onClick={() => setPeriod(p.id)}>
            {p.label}
          </BrutalTag>
        ))}
      </div>

      <div className="space-y-4" data-testid="leaderboard-list">
        {users.map((u, i) => {
          const medal = MEDALS[i];
          const tilt = i % 2 === 0 ? -1 : 1;
          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, x: -20, rotate: tilt - 1 }}
              animate={{ opacity: 1, x: 0, rotate: tilt }}
              whileHover={{ rotate: 0, scale: 1.01 }}
              transition={{ delay: i * 0.04 }}
              data-testid={`leaderboard-row-${i}`}
              className={`flex items-center gap-4 p-4 border-[4px] border-black shadow-brutal-lg rounded-[4px] ${medal ? medal.color : "bg-white"}`}
            >
              <div className="font-display font-black text-4xl md:text-5xl w-14 text-center">
                {medal ? medal.label : `#${i + 1}`}
              </div>
              <img src={u.avatar} alt={u.name} className="w-14 h-14 border-[3px] border-black bg-white" />
              <div className="flex-1 min-w-0">
                <div className="font-display font-black text-xl md:text-2xl uppercase truncate">{u.name}</div>
                <div className="text-xs font-bold uppercase">{u.department} · 🔥 {u.streak || 0} streak</div>
              </div>
              <div className="text-right">
                <div className="font-display font-black text-3xl leading-none">{u.points}</div>
                <div className="text-xs font-bold uppercase">points</div>
              </div>
            </motion.div>
          );
        })}
        {users.length === 0 && (
          <div className="text-center py-10 font-bold uppercase">No data for this period. Go earn some points, champ.</div>
        )}
      </div>
    </div>
  );
}
