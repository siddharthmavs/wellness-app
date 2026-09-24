import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, resolveAvatar } from "../lib/api";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { IconMindBlown, IconKnewIt, IconHmm, IconLightbulb, IconBook, IconSparkle } from "./HandDrawn";

const REACTS = [
 { id: "mind_blown", label: "Mind Blown", Icon: IconMindBlown },
 { id: "knew_it", label: "Knew it", Icon: IconKnewIt },
 { id: "hmm", label: "Hmm", Icon: IconHmm },
];

// Bookmark a fact or tip (QA #8). Saved items are listed on the Me page.
export const SaveToggle = ({ kind, itemId, saved, onChange }) => {
 const [busy, setBusy] = useState(false);
 const toggle = async () => {
 if (busy) return;
 setBusy(true);
 try {
 if (saved) await api.delete(`/saved-items/${kind}/${encodeURIComponent(itemId)}`);
 else await api.put("/saved-items", { kind, item_id: itemId });
 onChange(!saved);
 toast.success(saved ? "Removed from saved" : "Saved — find it on your Me page");
 } catch (err) {
 toast.error(err.response?.data?.message || "Couldn't update your saved items");
 } finally {
 setBusy(false);
 }
 };
 const Icon = saved ? BookmarkCheck : Bookmark;
 return (
 <button
 type="button"
 onClick={toggle}
 disabled={busy}
 aria-pressed={saved}
 aria-label={saved ? "Remove from saved" : "Save for later"}
 title={saved ? "Saved — click to remove" : "Save for later"}
 data-testid={`save-${kind}`}
 className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center transition hover:scale-105"
 style={{ background: "var(--cozy-surface)", color: "var(--cozy-text)", border: "1px solid var(--cozy-border)", boxShadow: "var(--shadow-cozy)" }}
 >
 <Icon className="w-4 h-4" fill={saved ? "currentColor" : "none"} aria-hidden="true" />
 </button>
 );
};

export const DidYouKnowCard = () => {
 const [fact, setFact] = useState(null);
 useEffect(() => { api.get("/facts/today").then(({ data }) => setFact(data)); }, []);
 if (!fact) return null;
 const react = async (r) => {
 const { data } = await api.post("/facts/react", { fact_id: fact.id, reaction: r });
 setFact({ ...fact, reactions: data.reactions });
 toast.success("Noted");
 };
 return (
 <motion.div
 initial={{ rotate: 1, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
 className="relative overflow-hidden p-5 doodle-corner"
 style={{ background: fact.color, borderRadius: 22, boxShadow: "var(--shadow-cozy)", border: "1px solid var(--cozy-border)" }}
 data-testid="did-you-know"
 >
 <div className="absolute -top-2 -right-2 opacity-70 pointer-events-none"><IconLightbulb size={64} /></div>
 <SaveToggle kind="fact" itemId={fact.id} saved={!!fact.saved} onChange={(saved) => setFact((f) => ({ ...f, saved }))} />
 <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--cozy-muted)" }}>Daily Wellness Fact</div>
 <div className="inline-block px-2 py-0.5 font-semibold text-xs rounded-full mb-2" style={{ background: "var(--cozy-surface)", color: "var(--cozy-text)" }}>{fact.category}</div>
 <p className="font-display text-xl leading-snug mt-1 relative z-10">{fact.fact}</p>
 <div className="flex gap-2 flex-wrap mt-3 relative z-10">
 {REACTS.map(({ id, label, Icon }) => (
 <button
 key={id}
 data-testid={`fact-react-${id}`}
 onClick={() => react(id)}
 className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold text-xs"
 style={{ background: "var(--cozy-surface)", border: "1px solid var(--cozy-border)", boxShadow: "var(--shadow-cozy)" }}
 >
 <Icon size={22} />
 <span>{label}{fact.reactions?.[id]?.length > 0 ? ` ${fact.reactions[id].length}` : ""}</span>
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
 className="relative overflow-hidden p-5"
 style={{ background: "var(--cozy-text)", color: "var(--cozy-surface)", borderRadius: 22, boxShadow: "var(--shadow-cozy)" }}
 data-testid="word-of-day"
 >
 <div className="absolute -bottom-4 -right-4 opacity-30 pointer-events-none"><IconBook size={80} /></div>
 <SaveToggle kind="tip" itemId={word.id} saved={!!word.saved} onChange={(saved) => setWord((w) => ({ ...w, saved }))} />
 <div className="text-xs font-semibold uppercase tracking-wider mb-1">Wellness Tip · Reflection</div>
 <div className="font-display text-4xl leading-none mt-2">{word.word}</div>
 <div className="text-xs italic mt-1 opacity-80">/{word.pron}/</div>
 <p className="font-body text-sm mt-3 relative z-10">{word.def}</p>
 <p className="font-hand text-sm italic mt-2 opacity-90">"{word.example}"</p>
 <div className="flex gap-1 flex-wrap mt-3 relative z-10">
 {word.tags?.map(t => (
 <span key={t} className="washi-tag text-[10px]">{t}</span>
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
 className="relative overflow-hidden p-5 doodle-corner"
 style={{ background: "var(--cozy-accent)", color: "var(--cozy-text)", borderRadius: 22, boxShadow: "var(--shadow-cozy)", border: "1px solid var(--cozy-border)" }}
 data-testid="spotlight-card"
 >
 <div className="absolute -bottom-3 -right-3 opacity-60 pointer-events-none"><IconSparkle size={70} /></div>
 <div className="text-xs font-semibold uppercase tracking-wider mb-2">Community Highlight · This Week</div>
 <div className="flex items-center gap-3 relative z-10">
 <img src={resolveAvatar(s.avatar)} alt="" className="w-16 h-16 rounded-full" style={{ border: "2px solid var(--cozy-text)", background: "var(--cozy-surface)" }} />
 <div>
 <div className="font-display text-2xl">{s.name}</div>
 <div className="text-xs font-semibold">{s.department}</div>
 </div>
 </div>
 <ul className="mt-3 text-sm space-y-1 relative z-10 font-body">
 {s.fun_facts?.map((f, i) => <li key={i}>· {f}</li>)}
 </ul>
 <div className="font-hand text-sm italic mt-3 relative z-10">"{s.quote}"</div>
 </motion.div>
 );
};
