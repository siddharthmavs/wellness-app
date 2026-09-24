import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuthStore } from "../store";
import { BrutalCard, BrutalBadge } from "../components/brutal";
import { RewardsSection } from "../components/RewardsSection";
import { BookmarkX } from "lucide-react";
import { toast } from "sonner";

const MODULES = [
 { key: "water", label: "Water", unit: "ml" },
 { key: "eye_break", label: "Eye Break", unit: "breaks" },
 { key: "move_reset", label: "Move & Reset", unit: "resets" },
 { key: "breathing", label: "Breathing", unit: "sessions" },
];

const TX_LABEL = {
 water_goal: "Water goal",
 eye_break_goal: "Eye break goal",
 move_reset_goal: "Move & Reset goal",
 breathing_goal: "Breathing goal",
};

export default function Me() {
 const { user } = useAuthStore();
 const [dashboard, setDashboard] = useState(null);
 const [rewards, setRewards] = useState(null);
 const [history, setHistory] = useState([]);
 const [loading, setLoading] = useState(true);
 const [saved, setSaved] = useState([]);

 useEffect(() => {
 let cancelled = false;
 Promise.all([
 api.get("/dashboard"),
 api.get("/rewards"),
 api.get("/rewards/history?limit=25"),
 ]).then(([d, r, h]) => {
 if (cancelled) return;
 setDashboard(d.data);
 setRewards(r.data);
 setHistory(h.data.items || []);
 }).finally(() => !cancelled && setLoading(false));
 api.get("/saved-items").then(({ data }) => !cancelled && setSaved(data)).catch(() => {});
 return () => { cancelled = true; };
 }, []);

 const unsave = async (item) => {
 try {
 await api.delete(`/saved-items/${item.kind}/${encodeURIComponent(item.item_id)}`);
 setSaved((list) => list.filter((i) => !(i.kind === item.kind && i.item_id === item.item_id)));
 toast.success("Removed from saved");
 } catch (err) {
 toast.error(err.response?.data?.message || "Couldn't remove that item");
 }
 };

 if (!user) return null;

 return (
 <div className="max-w-5xl mx-auto px-4 md:px-6 py-8" data-testid="me-page">
 <motion.div
 initial={{ rotate: -1, opacity: 0 }} animate={{ rotate: -1, opacity: 1 }}
 className="bg-brutal-yellow border-[4px] border-black shadow-brutal-lg p-6 mb-6 rounded-[4px]"
 >
 <div className="flex items-center justify-between flex-wrap gap-3">
 <div>
 <h1 className="font-display font-black text-4xl uppercase leading-none">Me</h1>
 <p className="text-xs font-bold uppercase mt-1 opacity-70">Your personal progress &amp; earned rewards</p>
 </div>
 <Link to="/settings/profile" className="border-[3px] border-black bg-white px-4 py-2 font-black uppercase text-xs shadow-brutal-sm">
 Edit Profile
 </Link>
 </div>
 </motion.div>

 {/* XP / Level */}
 <BrutalCard color="white" hover={false} className="mb-6" data-testid="me-xp-card">
 <div className="flex items-center justify-between mb-2">
 <h3 className="font-display font-black text-2xl uppercase">Level {rewards?.level ?? user.level ?? 1}</h3>
 <BrutalBadge color="pink">{rewards?.coins ?? 0} coins</BrutalBadge>
 </div>
 <div className="h-8 border-[3px] border-black bg-white">
 <div
 className="h-full bg-brutal-cyan border-r-[3px] border-black transition-all"
 style={{ width: `${rewards ? Math.min(100, (rewards.xp_into_level / Math.max(1, rewards.level_threshold)) * 100) : 0}%` }}
 />
 </div>
 <p className="text-xs font-bold uppercase mt-2">
 {rewards ? `${rewards.xp} total XP · ${rewards.xp_to_next_level} XP to next level` : "Loading..."}
 </p>
 </BrutalCard>

 {/* Today's progress */}
 <h2 className="font-display font-black text-2xl uppercase mb-3">Today's Wellness Progress</h2>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="me-today-progress">
 {MODULES.map((m) => {
 const d = dashboard?.[m.key];
 return (
 <div key={m.key} className="bg-white border-[3px] border-black p-3 text-center rounded-[2px] shadow-brutal-sm">
 <div className="font-display font-black text-2xl">{d ? Math.round(d.progress) : 0}%</div>
 <div className="text-[10px] font-bold uppercase mt-1">{m.label}</div>
 {d?.completed && <div className="text-[9px] font-black uppercase mt-1 text-brutal-green">DONE</div>}
 </div>
 );
 })}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
 <div className="bg-brutal-green border-[3px] border-black p-4 text-center rounded-[2px]">
 <div className="font-display font-black text-3xl">{dashboard?.modules_completed ?? 0}/{dashboard?.modules_total ?? 4}</div>
 <div className="text-[10px] font-bold uppercase">Rituals Completed Today</div>
 </div>
 <div className="bg-brutal-pink text-white border-[3px] border-black p-4 text-center rounded-[2px]">
 <div className="font-display font-black text-3xl">{dashboard?.streak ?? 0}</div>
 <div className="text-[10px] font-bold uppercase">Current Streak</div>
 </div>
 <div className="bg-brutal-cyan border-[3px] border-black p-4 text-center rounded-[2px]">
 <div className="font-display font-black text-3xl">{dashboard?.activities_today ?? 0}</div>
 <div className="text-[10px] font-bold uppercase">Activities Today</div>
 </div>
 </div>

 {/* Saved facts & tips (QA #8) */}
 <h2 className="font-display font-black text-2xl uppercase mb-3">Saved Facts &amp; Tips</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8" data-testid="me-saved-items">
 {saved.map((item) => (
 <div key={`${item.kind}-${item.item_id}`} className="relative bg-white border-[3px] border-black shadow-brutal-sm p-4 pr-12 rounded-[2px]">
 <div className="text-[10px] font-black uppercase opacity-60">{item.kind === "fact" ? `Fact · ${item.title}` : "Wellness tip"}</div>
 {item.kind === "tip" && <div className="font-display font-black text-xl mt-1">{item.title}</div>}
 <p className="text-sm font-medium mt-1">{item.text}</p>
 {item.example && <p className="text-xs italic mt-1 opacity-70">"{item.example}"</p>}
 <button
 type="button"
 onClick={() => unsave(item)}
 aria-label={`Remove "${item.kind === "tip" ? item.title : item.text.slice(0, 40)}" from saved`}
 title="Remove from saved"
 className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-black/5"
 >
 <BookmarkX className="w-4 h-4" aria-hidden="true" />
 </button>
 </div>
 ))}
 {saved.length === 0 && (
 <div className="text-sm font-bold uppercase md:col-span-2">Nothing saved yet — tap the bookmark on a daily fact or tip to keep it here.</div>
 )}
 </div>

 <RewardsSection />

 {/* Personal reward history */}
 <h2 className="font-display font-black text-2xl uppercase mb-3">Personal Reward History</h2>
 <div className="space-y-2 mb-8" data-testid="me-reward-history">
 {history.map((h) => (
 <div key={h.id} className="flex items-center justify-between bg-white border-[3px] border-black shadow-brutal-sm p-3 rounded-[2px]">
 <div className="font-black uppercase text-sm">{TX_LABEL[h.type] || h.type}</div>
 <div className="text-xs font-bold">{new Date(h.created_at).toLocaleString()}</div>
 <div className="flex gap-2">
 <BrutalBadge color="green">+{h.xp} XP</BrutalBadge>
 {h.coins > 0 && <BrutalBadge color="pink">+{h.coins} coins</BrutalBadge>}
 </div>
 </div>
 ))}
 {!loading && history.length === 0 && (
 <div className="text-sm font-bold uppercase">No rewards earned yet — complete a wellness goal to earn your first XP.</div>
 )}
 </div>
 </div>
 );
}
