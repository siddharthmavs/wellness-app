import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { useAuthStore } from "../store";
import { BrutalButton, BrutalCard, BrutalInput, BrutalTag } from "../components/brutal";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useSubmitGuard } from "../lib/useSubmitGuard";

export default function Polls() {
 const [busy, guard] = useSubmitGuard();
 const { user } = useAuthStore();
 const canCreate = user?.role === "admin" || user?.role === "team_lead";
 const [polls, setPolls] = useState([]);
 const [showForm, setShowForm] = useState(false);
 const [form, setForm] = useState({ question: "", options: ["", ""], expires_in_days: 7 });

 const load = async () => {
 const { data } = await api.get("/polls");
 setPolls(data);
 };
 useEffect(() => { load(); }, []);

 const vote = (pid, idx) => guard(`vote-${pid}`, async () => {
 await api.post(`/polls/${pid}/vote`, { option_idx: idx });
 toast.success("Vote saved");
 load();
 });

 const addOpt = () => setForm({ ...form, options: [...form.options, ""] });
 const removeOpt = (i) => setForm({ ...form, options: form.options.filter((_, x) => x !== i) });
 const setOpt = (i, v) => { const o = [...form.options]; o[i] = v; setForm({ ...form, options: o }); };

 const create = () => {
 if (!form.question.trim() || form.options.filter(o => o.trim()).length < 2) {
 toast.error("Q + 2 options minimum");
 return;
 }
 return guard("create", async () => {
 await api.post("/polls", { ...form, options: form.options.filter(o => o.trim()) });
 toast.success("Poll up!");
 setForm({ question: "", options: ["", ""], expires_in_days: 7 });
 setShowForm(false);
 load();
 });
 };

 return (
 <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
 <motion.div
 initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: -1, opacity: 1 }}
 className="bg-brutal-cyan border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
 >
 <h1 className="font-display font-black text-5xl uppercase leading-none"> POLLS</h1>
 <p className="text-xs uppercase tracking-widest mt-2">your voice, our chaos</p>
 </motion.div>

 {canCreate && (
 <div className="mb-6">
 <BrutalButton data-testid="new-poll-btn" color="yellow" onClick={() => setShowForm(!showForm)}>
 {showForm ? " CANCEL" : " NEW POLL"}
 </BrutalButton>
 </div>
 )}

 {showForm && (
 <BrutalCard color="white" hover={false} className="mb-6">
 <h3 className="font-display font-black text-2xl uppercase mb-3">New Poll</h3>
 <BrutalInput data-testid="poll-question" placeholder="What should we order for lunch?" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="mb-3" />
 <div className="space-y-2 mb-3">
 {form.options.map((o, i) => (
 <div key={i} className="flex gap-2">
 <BrutalInput placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
 {form.options.length > 2 && (
 <button onClick={() => removeOpt(i)} className="bg-brutal-pink border-[3px] border-black p-2"><X className="w-4 h-4" /></button>
 )}
 </div>
 ))}
 {form.options.length < 5 && (
 <button onClick={addOpt} className="bg-brutal-yellow border-[3px] border-black px-3 py-1 font-black uppercase text-xs flex items-center gap-1">
 <Plus className="w-4 h-4" /> ADD
 </button>
 )}
 </div>
 <BrutalButton data-testid="poll-create" color="green" onClick={create} disabled={!!busy.create}>{busy.create ? "LAUNCHING..." : "LAUNCH"}</BrutalButton>
 </BrutalCard>
 )}

 <div className="space-y-5" data-testid="polls-list">
 {polls.map((p, i) => {
 const totalVotes = (p.options || []).reduce((s, o) => s + (o.votes?.length || 0), 0);
 const myVoteIdx = (p.options || []).findIndex(o => o.votes?.includes(user?.id));
 const expired = new Date(p.expires_at) < new Date();
 return (
 <motion.div
 key={p.id}
 initial={{ opacity: 0, y: 20, rotate: i % 2 ? -1 : 1 }}
 animate={{ opacity: 1, y: 0, rotate: i % 2 ? -0.5 : 0.5 }}
 className="bg-white border-[4px] border-black shadow-brutal-lg p-5"
 data-testid={`poll-${p.id}`}
 >
 <div className="font-display font-black text-2xl uppercase mb-3">{p.question}</div>
 <div className="text-xs font-bold uppercase mb-3">By {p.creator_name} · {expired ? " closed" : `expires ${new Date(p.expires_at).toLocaleDateString()}`}</div>
 <div className="space-y-2">
 {(p.options || []).map((o, idx) => {
 const votes = o.votes?.length || 0;
 const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
 const mine = myVoteIdx === idx;
 return (
 <button
 key={idx}
 data-testid={`poll-${p.id}-option-${idx}`}
 disabled={expired}
 onClick={() => vote(p.id, idx)}
 className={`w-full text-left border-[3px] border-black p-3 relative overflow-hidden ${mine ? "bg-brutal-yellow shadow-brutal-sm" : "bg-white"} ${expired ? "opacity-70 cursor-not-allowed" : "hover:-translate-y-0.5 transition"}`}
 >
 <div className="absolute inset-y-0 left-0 bg-brutal-cyan/40 -z-0" style={{ width: `${pct}%` }} />
 <div className="relative z-10 flex justify-between font-black text-sm uppercase">
 <span>{mine && " "}{o.text}</span>
 <span>{pct}% ({votes})</span>
 </div>
 </button>
 );
 })}
 </div>
 <div className="text-xs font-bold mt-3">Total votes: {totalVotes}</div>
 </motion.div>
 );
 })}
 {polls.length === 0 && <div className="text-center py-10 font-bold uppercase">No polls. Bored.</div>}
 </div>
 </div>
 );
}
