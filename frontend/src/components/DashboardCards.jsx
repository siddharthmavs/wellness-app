import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { toast } from "sonner";

const REACTS = [
  { id: "mind_blown", label: "🤯 Mind Blown" },
  { id: "knew_it", label: "😏 Knew it" },
  { id: "hmm", label: "🤔 Hmm" },
];

export const DidYouKnowCard = () => {
  const [fact, setFact] = useState(null);
  useEffect(() => { api.get("/facts/today").then(({ data }) => setFact(data)); }, []);
  if (!fact) return null;
  const react = async (r) => {
    const { data } = await api.post("/facts/react", { fact_id: fact.id, reaction: r });
    setFact({ ...fact, reactions: data.reactions });
    toast.success("👀 Noted");
  };
  return (
    <motion.div
      initial={{ rotate: 1, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
      className="border-[4px] border-black shadow-brutal-lg p-5 rounded-[4px]"
      style={{ background: fact.color }}
      data-testid="did-you-know"
    >
      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--cozy-muted)" }}>💡 DAILY WELLNESS FACT</div>
      <div className="inline-block px-2 py-0.5 font-semibold text-xs uppercase mb-2 rounded-full" style={{ background: "var(--cozy-surface)", color: "var(--cozy-text)" }}>{fact.category}</div>
      <p className="font-display text-xl leading-snug mt-1">{fact.fact}</p>
      <div className="flex gap-2 flex-wrap mt-3">
        {REACTS.map(r => (
          <button
            key={r.id}
            data-testid={`fact-react-${r.id}`}
            onClick={() => react(r.id)}
            className="bg-white border-[3px] border-black px-3 py-1 font-black text-xs uppercase shadow-brutal-sm"
          >
            {r.label} {fact.reactions?.[r.id]?.length > 0 && fact.reactions[r.id].length}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

export const WordOfDayCard = () => {
  const [word, setWord] = useState(null);
  useEffect(() => { api.get("/words/today").then(({ data }) => setWord(data)); }, []);
  if (!word) return null;
  return (
    <motion.div
      initial={{ rotate: -1, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
      className="bg-black text-brutal-yellow border-[4px] border-black shadow-brutal-lg p-5 rounded-[4px]"
      data-testid="word-of-day"
    >
      <div className="text-xs font-semibold uppercase tracking-wider mb-1">🌷 WELLNESS TIP · REFLECTION</div>
      <div className="font-display text-4xl leading-none mt-2">{word.word}</div>
      <div className="text-xs italic mt-1 opacity-80">/{word.pron}/</div>
      <p className="font-medium text-sm mt-3">{word.def}</p>
      <p className="text-xs font-bold italic mt-2">"{word.example}"</p>
      <div className="flex gap-1 flex-wrap mt-3">
        {word.tags?.map(t => (
          <span key={t} className="bg-brutal-yellow text-black border-[2px] border-black px-2 py-0.5 font-black text-[10px] uppercase">{t}</span>
        ))}
      </div>
    </motion.div>
  );
};

export const SpotlightCard = () => {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/spotlight/current").then(({ data }) => setS(data)); }, []);
  if (!s) return null;
  return (
    <motion.div
      initial={{ rotate: 1, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
      className="bg-brutal-pink text-white border-[4px] border-black shadow-brutal-lg p-5 rounded-[4px]"
      data-testid="spotlight-card"
    >
      <div className="text-xs font-semibold uppercase tracking-wider mb-2">✨ COMMUNITY HIGHLIGHT · THIS WEEK</div>
      <div className="flex items-center gap-3">
        <img src={s.avatar} alt="" className="w-16 h-16 border-[3px] border-black bg-white" />
        <div>
          <div className="font-display font-black text-2xl uppercase">{s.name}</div>
          <div className="text-xs font-bold uppercase">{s.department}</div>
        </div>
      </div>
      <ul className="mt-3 text-sm font-bold space-y-1">
        {s.fun_facts?.map((f, i) => <li key={i}>· {f}</li>)}
      </ul>
      <div className="bg-white text-black border-[3px] border-black px-3 py-2 mt-3 italic font-bold text-xs">"{s.quote}"</div>
    </motion.div>
  );
};
