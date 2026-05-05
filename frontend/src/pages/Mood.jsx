import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalInput, BrutalTag } from "../components/brutal";
import { EmptyState } from "../components/Skeleton";
import { toast } from "sonner";

const MOODS = [
  { emoji: "🔥", label: "Lit", color: "bg-brutal-yellow" },
  { emoji: "😌", label: "Zen", color: "bg-brutal-green" },
  { emoji: "😐", label: "Meh", color: "bg-brutal-cyan" },
  { emoji: "😤", label: "Stressed", color: "bg-brutal-pink" },
  { emoji: "😴", label: "Tired", color: "bg-white" },
  { emoji: "🥳", label: "Hyped", color: "bg-brutal-yellow" },
  { emoji: "🤯", label: "Overload", color: "bg-brutal-pink" },
  { emoji: "🧊", label: "Cold", color: "bg-brutal-cyan" },
];

const PRODUCTIVITY = [
  { id: "High", label: "🚀 High", color: "green" },
  { id: "Med", label: "🌤️ Medium", color: "yellow" },
  { id: "Low", label: "🐢 Low", color: "pink" },
];

export default function Mood() {
  const [selected, setSelected] = useState(null);
  const [productivity, setProductivity] = useState(null);
  const [note, setNote] = useState("");
  const [logs, setLogs] = useState([]);

  const load = async () => {
    const { data } = await api.get("/mood/me");
    setLogs(data);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!selected) { toast.error("Pick a vibe first"); return; }
    await api.post("/mood", { emoji: selected.emoji, label: selected.label, note, productivity });
    await api.post("/activities", { type: "mood" });
    toast.success(`🎭 Logged ${selected.emoji}`);
    setSelected(null); setNote(""); setProductivity(null);
    load();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: -1, opacity: 1 }}
        className="bg-brutal-cyan border-[4px] border-black shadow-brutal-lg p-6 mb-8 inline-block"
      >
        <h1 className="font-display font-black text-5xl uppercase leading-none">🎭 VIBE CHECK</h1>
        <p className="text-xs uppercase tracking-widest mt-2">how we feeling today?</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="mood-picker">
        {MOODS.map((m, i) => (
          <motion.button
            key={m.label}
            data-testid={`mood-${m.label.toLowerCase()}`}
            onClick={() => setSelected(m)}
            whileHover={{ scale: 1.05, rotate: i % 2 ? -2 : 2 }}
            whileTap={{ scale: 0.95 }}
            className={`${m.color} border-[4px] border-black shadow-brutal ${selected?.label === m.label ? "ring-4 ring-black shadow-brutal-xl" : ""} p-5 rounded-[4px]`}
          >
            <div className="text-5xl mb-2">{m.emoji}</div>
            <div className="font-black uppercase">{m.label}</div>
          </motion.button>
        ))}
      </div>

      <BrutalCard color="white" className="mb-8" hover={false}>
        <div className="text-xs font-black uppercase mb-2">📊 Productivity today</div>
        <div className="flex gap-2 flex-wrap mb-4" data-testid="productivity-picker">
          {PRODUCTIVITY.map((p) => (
            <BrutalTag key={p.id} active={productivity === p.id} color={p.color} onClick={() => setProductivity(p.id)}>
              {p.label}
            </BrutalTag>
          ))}
        </div>
        <label className="font-bold uppercase text-xs tracking-wider block mb-1">Note (optional)</label>
        <BrutalInput
          data-testid="mood-note"
          placeholder="What's eating you, champ?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <BrutalButton data-testid="mood-submit" color="green" className="mt-4" onClick={submit}>
          LOCK IT IN →
        </BrutalButton>
      </BrutalCard>

      <h2 className="font-display font-black text-2xl uppercase mb-3">Past Vibes</h2>
      {logs.length === 0 ? (
        <EmptyState emoji="🌫️" title="No vibes logged" subtitle="Drop an emoji and write the page." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="mood-history">
          {logs.map((l) => (
            <div key={l.id} className="bg-white border-[3px] border-black shadow-brutal p-3 rounded-[2px]">
              <div className="text-3xl">{l.emoji}</div>
              <div className="font-black text-sm uppercase">{l.label}</div>
              {l.productivity && (
                <div className="mt-1 inline-block bg-brutal-yellow border-[2px] border-black px-1.5 py-0.5 font-black text-[10px] uppercase">
                  {PRODUCTIVITY.find(p => p.id === l.productivity)?.label || l.productivity}
                </div>
              )}
              <div className="text-[10px] text-gray-600 mt-1">{new Date(l.created_at).toLocaleString()}</div>
              {l.note && <div className="text-xs mt-1 font-medium">"{l.note}"</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
