import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalCard } from "../components/brutal";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [today, setToday] = useState([]);

  useEffect(() => {
    api.get("/events").then(({ data }) => setEvents(data));
    api.get("/events/today").then(({ data }) => setToday(data));
  }, []);

  const upcoming = events
    .map((e) => {
      const md = (e.date || "").slice(5, 10);
      const t = new Date();
      const [m, d] = md.split("-").map(Number);
      let next = new Date(t.getFullYear(), m - 1, d);
      if (next < t) next.setFullYear(t.getFullYear() + 1);
      return { ...e, daysAway: Math.ceil((next - t) / 86400000) };
    })
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, 12);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: -1, opacity: 1 }}
        className="bg-brutal-yellow border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
      >
        <h1 className="font-display font-black text-5xl uppercase leading-none">🎂 CELEBRATIONS</h1>
        <p className="text-xs uppercase tracking-widest mt-2">birthdays · work-anniversaries</p>
      </motion.div>

      {today.length > 0 && (
        <div className="mb-6" data-testid="events-today">
          <h2 className="font-display font-black text-2xl uppercase mb-3">🎉 Today</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {today.map((e, i) => (
              <motion.div
                key={e.id}
                initial={{ rotate: i % 2 ? -2 : 2, scale: 0.9, opacity: 0 }}
                animate={{ rotate: i % 2 ? -1 : 1, scale: 1, opacity: 1 }}
                className={`border-[4px] border-black shadow-brutal-lg p-5 text-center ${e.type === "birthday" ? "bg-brutal-pink text-white" : "bg-brutal-cyan"}`}
              >
                <div className="text-5xl">{e.type === "birthday" ? "🎂" : "🎉"}</div>
                <img src={e.user_avatar} alt="" className="w-16 h-16 mx-auto border-[3px] border-black bg-white my-2" />
                <div className="font-display font-black text-2xl uppercase">{e.user_name}</div>
                <div className="text-xs font-bold uppercase">{e.type === "birthday" ? "HAPPY BIRTHDAY 🎉" : "WORK-AVERSARY 🎉"}</div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-display font-black text-2xl uppercase mb-3">📅 Upcoming</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="events-upcoming">
        {upcoming.map((e, i) => (
          <div key={e.id} className="bg-white border-[4px] border-black shadow-brutal p-4 flex items-center gap-4">
            <img src={e.user_avatar} alt="" className="w-12 h-12 border-[3px] border-black" />
            <div className="flex-1">
              <div className="font-black uppercase text-sm">{e.user_name} · {e.department}</div>
              <div className="text-xs font-bold">{e.type === "birthday" ? "🎂 Birthday" : "🎉 Anniversary"} · {e.date.slice(5, 10)}</div>
            </div>
            <div className="bg-brutal-yellow border-[3px] border-black px-3 py-1 font-black text-xs">in {e.daysAway}d</div>
          </div>
        ))}
        {upcoming.length === 0 && <div className="text-sm font-bold uppercase">No events. Quiet.</div>}
      </div>
    </div>
  );
}
