import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";

const Stat = ({ label, value, change, color = "yellow" }) => (
 <div className={`bg-brutal-${color} border-[3px] border-black shadow-brutal-sm p-3 rounded-[2px]`}>
 <div className="text-[10px] font-black uppercase">{label}</div>
 <div className="font-display font-black text-3xl leading-none mt-1">{value}</div>
 {typeof change === "number" && (
 <div className={`text-xs font-black mt-1 ${change >= 0 ? "text-black" : "text-black"}`}>
 {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs last week
 </div>
 )}
 </div>
);

export default function WeeklyInsightsCard() {
 const [data, setData] = useState(null);
 useEffect(() => { api.get("/insights/weekly").then(({ data }) => setData(data)).catch(() => {}); }, []);
 if (!data) return null;
 return (
 <motion.div
 initial={{ rotate: -1, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
 className="bg-white border-[4px] border-black shadow-brutal-lg p-5 rounded-[4px]"
 data-testid="weekly-insights"
 >
 <h3 className="font-display font-black uppercase text-xl mb-3"> Weekly Vibe Check</h3>
 <p className="font-bold text-sm mb-4">{data.message}</p>
 <div className="grid grid-cols-2 gap-3">
 <Stat label=" Water hits" value={data.water.this} change={data.water.change_pct} color="cyan" />
 <Stat label=" Eye breaks" value={data.eye_care.this} change={data.eye_care.change_pct} color="yellow" />
 <Stat label=" Points" value={data.points_earned} color="pink" />
 <Stat label=" Streak" value={data.streak} color="green" />
 </div>
 <div className="mt-3 bg-brutal-yellow border-[3px] border-black px-3 py-2 font-black text-xs uppercase">
 Top mood: {data.top_mood}
 </div>
 </motion.div>
 );
}
