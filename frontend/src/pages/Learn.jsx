import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalTag } from "../components/brutal";
import { toast } from "sonner";

const DEPTS = ["All", "Engineering", "Design", "Marketing", "HR", "Product", "QA", "General"];

export default function Learn() {
 const [filter, setFilter] = useState("All");
 const [bites, setBites] = useState([]);

 const load = async () => {
 const { data } = await api.get(`/learning-bites${filter !== "All" ? `?department=${filter}` : ""}`);
 setBites(data);
 };

 useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

 const tried = async (id) => {
 const { data } = await api.post(`/learning-bites/${id}/tried`);
 if (data.already) toast("Already tried, legend");
 else toast.success(" +5 pts — Tried it!");
 load();
 };

 return (
 <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
 <motion.div
 initial={{ rotate: 2, opacity: 0 }} animate={{ rotate: 1, opacity: 1 }}
 className="bg-brutal-green border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
 >
 <h1 className="font-display font-black text-5xl uppercase leading-none"> LEARNING BITES</h1>
 <p className="text-xs uppercase tracking-widest mt-2">60-sec brain food</p>
 </motion.div>

 <div className="flex gap-2 mb-6 flex-wrap" data-testid="bites-filter">
 {DEPTS.map((d) => (
 <BrutalTag key={d} active={filter === d} color="yellow" onClick={() => setFilter(d)}>{d}</BrutalTag>
 ))}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="bites-list">
 {bites.map((b, i) => (
 <motion.div
 key={b.id}
 initial={{ opacity: 0, y: 20, rotate: i % 2 ? -1 : 1 }} animate={{ opacity: 1, y: 0, rotate: i % 2 ? -0.5 : 0.5 }}
 className="bg-white border-[4px] border-black shadow-brutal-lg p-5 flex flex-col"
 >
 <div className="flex items-center gap-2 mb-2">
 <span className="bg-brutal-cyan border-[2px] border-black px-2 py-0.5 font-black text-xs uppercase">{b.department}</span>
 <span className="text-xs font-bold ml-auto"> {b.tried_count} tried</span>
 </div>
 <h3 className="font-display font-black text-xl uppercase mb-2">{b.title}</h3>
 <p className="text-sm font-medium flex-1">{b.body}</p>
 <BrutalButton data-testid={`bite-tried-${b.id}`} color="green" onClick={() => tried(b.id)} className="mt-3 self-start">
 TRIED IT (+5)
 </BrutalButton>
 </motion.div>
 ))}
 {bites.length === 0 && <div className="text-sm font-bold uppercase">No bites for this filter.</div>}
 </div>
 </div>
 );
}
