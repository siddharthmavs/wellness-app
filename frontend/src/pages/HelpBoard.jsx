import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalInput, BrutalTag } from "../components/brutal";
import { Heart, ImagePlus, MessageCircle } from "lucide-react";
import { useAuthStore } from "../store";
import { toast } from "sonner";

const CATS = ["All", "Housing", "Travel", "Buy-Sell", "Recommendations", "General"];
const ICONS = { Housing: "🏠", Travel: "🚗", "Buy-Sell": "🛒", Recommendations: "🍽️", General: "💬" };

export default function HelpBoard() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState({ category: "Housing", title: "", content: "", image: "" });
  const [comments, setComments] = useState({});
  const fileRef = useRef();

  const load = async () => {
    const { data } = await api.get(`/help${filter !== "All" ? `?category=${filter}` : ""}`);
    setPosts(data);
  };
  useEffect(() => { load(); }, [filter]);

  const onFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error("Under 2MB plz"); return; }
    const r = new FileReader(); r.onload = () => setForm({ ...form, image: r.result }); r.readAsDataURL(f);
  };

  const create = async () => {
    if (!form.title || !form.content) { toast.error("title + content needed"); return; }
    await api.post("/help", form);
    toast.success("📌 Posted");
    setForm({ category: "Housing", title: "", content: "", image: "" });
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const like = async (id) => { await api.post(`/help/${id}/like`); load(); };
  const comment = async (id) => {
    const t = (comments[id] || "").trim(); if (!t) return;
    await api.post(`/help/${id}/comment`, { content: t });
    setComments({ ...comments, [id]: "" });
    load();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ rotate: 2, opacity: 0 }} animate={{ rotate: 1, opacity: 1 }}
        className="bg-brutal-cyan border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
        data-testid="help-header"
      >
        <h1 className="font-display font-black text-5xl uppercase leading-none">🤝 HELP BOARD</h1>
        <p className="text-xs uppercase tracking-widest mt-2">need help? offer help. it's a vibe.</p>
      </motion.div>

      <div className="flex gap-2 mb-6 flex-wrap" data-testid="help-filters">
        {CATS.map((c) => (
          <BrutalTag key={c} active={filter === c} color="yellow" onClick={() => setFilter(c)}>{ICONS[c] || "🌟"} {c}</BrutalTag>
        ))}
      </div>

      <BrutalCard color="white" hover={false} className="mb-6">
        <h3 className="font-display font-black text-xl uppercase mb-3">➕ Post a Request</h3>
        <select className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase mb-3" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATS.filter(c => c !== "All").map((c) => <option key={c} value={c}>{ICONS[c]} {c}</option>)}
        </select>
        <BrutalInput data-testid="help-title" placeholder="Title (e.g. Looking for flat near office)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mb-3" />
        <textarea
          data-testid="help-content"
          placeholder="Details..."
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          rows={3}
          className="w-full border-[3px] border-black px-4 py-3 font-medium resize-none mb-3"
        />
        {form.image && (
          <div className="mb-3 relative inline-block">
            <img src={form.image} alt="" className="max-h-32 border-[3px] border-black" />
            <button onClick={() => setForm({ ...form, image: "" })} className="absolute -top-2 -right-2 bg-brutal-pink border-[3px] border-black w-7 h-7 font-black">×</button>
          </div>
        )}
        <div className="flex gap-2">
          <label className="cursor-pointer bg-brutal-cyan border-[3px] border-black px-4 py-2 font-black text-xs uppercase shadow-brutal-sm flex items-center gap-1">
            <ImagePlus className="w-4 h-4" /> IMAGE
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
          <BrutalButton data-testid="help-submit" color="green" onClick={create}>POST 🚀</BrutalButton>
        </div>
      </BrutalCard>

      <div className="space-y-5" data-testid="help-list">
        {posts.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 20, rotate: i % 2 ? -1 : 1 }}
            animate={{ opacity: 1, y: 0, rotate: i % 2 ? -0.5 : 0.5 }}
            className="bg-white border-[4px] border-black shadow-brutal-lg p-5"
          >
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <img src={p.user_avatar} alt="" className="w-8 h-8 border-[2px] border-black" />
              <span className="font-black uppercase text-sm">{p.user_name}</span>
              <span className="bg-brutal-yellow border-[2px] border-black px-2 py-0.5 font-black text-xs uppercase">{ICONS[p.category]} {p.category}</span>
              <span className="text-[10px] font-bold ml-auto">{new Date(p.created_at).toLocaleString()}</span>
            </div>
            <h3 className="font-display font-black text-2xl uppercase mb-2">{p.title}</h3>
            <p className="font-medium mb-3">{p.content}</p>
            {p.image && <img src={p.image} alt="" className="w-full max-h-72 object-cover border-[3px] border-black mb-3" />}
            <div className="flex gap-2 items-center">
              <button onClick={() => like(p.id)} className={`flex items-center gap-1 border-[3px] border-black px-3 py-1.5 shadow-brutal-sm font-black text-xs uppercase ${p.likes?.includes(user?.id) ? "bg-brutal-pink text-white" : "bg-white"}`}>
                <Heart className="w-4 h-4" fill={p.likes?.includes(user?.id) ? "white" : "none"} /> {p.likes?.length || 0}
              </button>
              <span className="font-black text-xs uppercase flex items-center gap-1"><MessageCircle className="w-4 h-4" /> {p.comments?.length || 0}</span>
            </div>
            {p.comments?.length > 0 && (
              <div className="mt-3 space-y-2 border-t-[3px] border-black pt-3">
                {p.comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <img src={c.user_avatar} alt="" className="w-6 h-6 border-[2px] border-black" />
                    <div className="flex-1 bg-brutal-yellow/40 border-[2px] border-black px-2 py-1">
                      <div className="font-black text-xs uppercase">{c.user_name}</div>
                      <div className="text-sm">{c.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <BrutalInput placeholder="Help out..." value={comments[p.id] || ""} onChange={(e) => setComments({ ...comments, [p.id]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") comment(p.id); }} />
              <BrutalButton color="cyan" size="sm" onClick={() => comment(p.id)}>POST</BrutalButton>
            </div>
          </motion.div>
        ))}
        {posts.length === 0 && <div className="text-sm font-bold uppercase">Nothing here yet. Be a hero.</div>}
      </div>
    </div>
  );
}
