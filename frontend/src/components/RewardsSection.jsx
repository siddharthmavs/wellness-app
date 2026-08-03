import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalBadge } from "./brutal";
import { toast } from "sonner";
import { Gift, Ticket, Star } from "lucide-react";

const ICON = { coupon: Ticket, points: Star, shoutout: Gift };
const COLOR = { coupon: "bg-brutal-pink text-white", points: "bg-brutal-yellow", shoutout: "bg-brutal-cyan" };

export const RewardsSection = () => {
 const [rewards, setRewards] = useState([]);
 const load = async () => {
 const { data } = await api.get("/rewards/me");
 setRewards(data);
 };
 useEffect(() => { load(); }, []);

 const claim = async (id) => {
 await api.post(`/rewards/${id}/claim`);
 toast.success(" Claimed!");
 load();
 };

 if (rewards.length === 0) return null;
 return (
 <BrutalCard color="white" hover={false} className="mb-8" data-testid="rewards-section">
 <h2 className="font-display font-black text-2xl uppercase mb-3"> Surprise Rewards ({rewards.length})</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {rewards.map((r, i) => {
 const Icon = ICON[r.type] || Gift;
 return (
 <motion.div
 key={r.id}
 initial={{ opacity: 0, scale: 0.9, rotate: i % 2 ? -2 : 2 }}
 animate={{ opacity: 1, scale: 1, rotate: i % 2 ? -1 : 1 }}
 className={`${COLOR[r.type] || "bg-white"} border-[4px] border-black shadow-brutal p-4 flex flex-col`}
 data-testid={`reward-${r.id}`}
 >
 <div className="flex items-center gap-2 mb-2">
 <Icon className="w-5 h-5" />
 <span className="bg-black text-white border-[2px] border-black px-2 py-0.5 font-black text-[10px] uppercase">{r.type}</span>
 <span className="text-[10px] font-bold ml-auto">from {r.issued_by}</span>
 </div>
 <div className="font-black text-sm mb-2">{r.message}</div>
 {r.code && (
 <div className="bg-white text-black border-[3px] border-black px-2 py-1 font-mono font-black text-sm tracking-widest text-center">
 {r.code}
 </div>
 )}
 {r.type === "points" && r.points > 0 && (
 <div className="text-xs font-black uppercase">+{r.points} pts already in your wallet</div>
 )}
 <div className="mt-3 flex justify-between items-center">
 <span className="text-[10px] font-bold uppercase">{new Date(r.created_at).toLocaleDateString()}</span>
 {r.claimed ? (
 <BrutalBadge color="green"> Claimed</BrutalBadge>
 ) : (
 <BrutalButton data-testid={`claim-${r.id}`} color="green" size="sm" onClick={() => claim(r.id)}>CLAIM</BrutalButton>
 )}
 </div>
 </motion.div>
 );
 })}
 </div>
 </BrutalCard>
 );
};
