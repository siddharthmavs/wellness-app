import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalInput, BrutalTag } from "../components/brutal";
import { toast } from "sonner";
import { useAuthStore } from "../store";

export default function GameTeams() {
 const { user } = useAuthStore();
 const [teams, setTeams] = useState([]);

 useEffect(() => {
 api.get("/game-teams").then(({ data }) => setTeams(data));
 }, []);

 const myTeam = teams.find((t) => t.members?.includes(user?.id));
 const MEDAL_LABEL = ["", "", ""];

 return (
 <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
 <motion.div
 initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: -1, opacity: 1 }}
 className="bg-brutal-pink text-white border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
 >
 <h1 className="font-display font-black text-5xl uppercase leading-none"> GAME TEAMS</h1>
 <p className="text-xs uppercase tracking-widest mt-2">office-game battalions</p>
 </motion.div>

 {myTeam && (
 <motion.div
 initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
 className={`bg-brutal-${myTeam.color} border-[4px] border-black shadow-brutal-lg p-5 mb-6`}
 data-testid="my-team"
 >
 <div className="text-xs font-black uppercase tracking-widest"> You're on</div>
 <div className="font-display font-black text-4xl uppercase">{myTeam.name}</div>
 <div className="mt-2 font-black"> {myTeam.team_points} team pts · {myTeam.members?.length || 0} members</div>
 </motion.div>
 )}

 <h2 className="font-display font-black text-2xl uppercase mb-3"> Standings</h2>
 <div className="space-y-3" data-testid="teams-list">
 {teams.map((t, i) => (
 <motion.div
 key={t.id}
 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
 transition={{ delay: i * 0.04 }}
 className={`border-[4px] border-black shadow-brutal-lg p-5 bg-brutal-${t.color} ${myTeam?.id === t.id ? "ring-4 ring-black" : ""}`}
 >
 <div className="flex items-center gap-4 mb-3">
 <div className="font-display font-black text-4xl">{i < 3 ? MEDAL_LABEL[i] : `#${i + 1}`}</div>
 <div className="flex-1">
 <div className="font-display font-black text-2xl uppercase">{t.name}</div>
 <div className="text-xs font-bold uppercase">{t.members?.length || 0} members</div>
 </div>
 <div className="text-right">
 <div className="font-display font-black text-3xl leading-none">{t.team_points}</div>
 <div className="text-[10px] font-bold uppercase">team pts</div>
 </div>
 </div>
 <div className="flex flex-wrap gap-1">
 {(t.member_details || []).map((m) => (
 <div key={m.id} className="flex items-center gap-1 bg-white border-[2px] border-black px-1.5 py-0.5">
 <img src={m.avatar} alt="" className="w-5 h-5 border-[1px] border-black" />
 <span className="font-black text-[10px] uppercase">{m.name}</span>
 </div>
 ))}
 </div>
 </motion.div>
 ))}
 {teams.length === 0 && <div className="text-center font-bold uppercase py-10">No teams yet. Admin needs to shuffle.</div>}
 </div>
 </div>
 );
}
