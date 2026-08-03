import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalInput, BrutalTag } from "../components/brutal";
import { EmptyState } from "../components/Skeleton";
import { MOOD_ICONS } from "../components/HandDrawn";
import { toast } from "sonner";

const MOODS = [
  { key: "Lit", label: "Lit" },
  { key: "Zen", label: "Zen" },
  { key: "Meh", label: "Meh" },
  { key: "Stressed", label: "Stressed" },
  { key: "Tired", label: "Tired" },
  { key: "Hyped", label: "Hyped" },
  { key: "Overload", label: "Overload" },
  { key: "Cold", label: "Cold" },
];

const PRODUCTIVITY = [
  { id: "High", label: "High" },
  { id: "Med", label: "Medium" },
  { id: "Low", label: "Low" },
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
    await api.post("/mood", { emoji: selected.key, label: selected.label, note, productivity });
    await api.post("/activities", { type: "mood" });
    toast.success(`Logged ${selected.label}`);
    setSelected(null); setNote(""); setProductivity(null);
    load();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: -1, opacity: 1 }}
        className="mb-8 inline-block px-6 py-4"
        style={{ background: "var(--cozy-secondary)", borderRadius: 20, boxShadow: "var(--shadow-cozy)" }}
      >
        <h1 className="font-display text-5xl leading-none">Vibe check</h1>
        <p className="font-hand text-lg mt-2" style={{ color: "var(--cozy-muted)" }}>how are we feeling today?</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8" data-testid="mood-picker">
        {MOODS.map((m, i) => {
          const Icon = MOOD_ICONS[m.key];
          const isSelected = selected?.key === m.key;
          return (
            <motion.button
              key={m.key}
              data-testid={`mood-${m.label.toLowerCase()}`}
              onClick={() => setSelected(m)}
              whileHover={{ y: -3, rotate: i % 2 ? -1.5 : 1.5 }}
              whileTap={{ scale: 0.97 }}
              className="p-5 flex flex-col items-center gap-2 text-center"
              style={{
                background: "var(--cozy-surface)",
                borderRadius: 22,
                border: isSelected ? "2px solid var(--cozy-primary)" : "1px solid var(--cozy-border)",
                boxShadow: isSelected ? "var(--shadow-cozy-lg)" : "var(--shadow-cozy)",
              }}
            >
              <Icon size={68} />
              <div className="font-display text-lg" style={{ color: "var(--cozy-text)" }}>{m.label}</div>
            </motion.button>
          );
        })}
      </div>

      <BrutalCard color="white" className="mb-8" hover={false}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--cozy-muted)" }}>Productivity today</div>
        <div className="flex gap-2 flex-wrap mb-4" data-testid="productivity-picker">
          {PRODUCTIVITY.map((p) => (
            <BrutalTag key={p.id} active={productivity === p.id} color="primary" onClick={() => setProductivity(p.id)}>{p.label}</BrutalTag>
          ))}
        </div>
        <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cozy-muted)" }}>Note (optional)</label>
        <BrutalInput data-testid="mood-note" placeholder="What's on your mind?" value={note} onChange={(e) => setNote(e.target.value)} />
        <BrutalButton data-testid="mood-submit" color="primary" className="mt-4" onClick={submit}>Log it</BrutalButton>
      </BrutalCard>

      <h2 className="font-display text-2xl mb-4" style={{ color: "var(--cozy-text)" }}>Past vibes</h2>
      {logs.length === 0 ? (
        <EmptyState title="No vibes logged" subtitle="Drop a mood above." />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="mood-history">
          {logs.map((l) => {
            const Icon = MOOD_ICONS[l.label] || MOOD_ICONS.Meh;
            return (
              <div key={l.id} className="p-4 flex flex-col items-center gap-1 text-center" style={{ background: "var(--cozy-surface)", borderRadius: 20, boxShadow: "var(--shadow-cozy)" }}>
                <Icon size={44} />
                <div className="font-display text-base">{l.label}</div>
                {l.productivity && (
                  <div className="washi-tag text-[10px]">{l.productivity}</div>
                )}
                <div className="text-[10px]" style={{ color: "var(--cozy-muted)" }}>{new Date(l.created_at).toLocaleDateString()}</div>
                {l.note && <div className="font-hand text-sm mt-1">"{l.note}"</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
