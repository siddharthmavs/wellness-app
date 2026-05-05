import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalInput, BrutalTag, BrutalBadge } from "../components/brutal";
import { useAuthStore } from "../store";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

const CATEGORIES = ["Helpfulness", "Teamwork", "Problem Solving", "Going Extra Mile", "Just Because"];
const REACTS = ["😂", "❤️", "👏", "🔥"];

export default function Shoutouts() {
  const { user } = useAuthStore();
  const [shouts, setShouts] = useState([]);
  const [users, setUsers] = useState([]);
  const [digest, setDigest] = useState([]);
  const [picked, setPicked] = useState([]);
  const [category, setCategory] = useState("Helpfulness");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [s, u, d] = await Promise.all([api.get("/shoutouts"), api.get("/users"), api.get("/shoutouts/digest")]);
    setShouts(s.data); setUsers(u.data.filter((x) => x.id !== user?.id)); setDigest(d.data);
  };

  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!picked.length || !message.trim()) { toast.error("Pick someone + write something"); return; }
    await api.post("/shoutouts", { recipient_ids: picked, category, message });
    toast.success("📣 Shoutout sent");
    setPicked([]); setMessage("");
    load();
  };

  const togglePick = (uid) => {
    setPicked(picked.includes(uid) ? picked.filter((x) => x !== uid) : [...picked, uid]);
  };

  const react = async (sid, emoji) => {
    await api.post(`/shoutouts/${sid}/react`, { emoji });
    load();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: -1, opacity: 1 }}
        className="bg-brutal-yellow border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
        data-testid="shoutouts-header"
      >
        <h1 className="font-display font-black text-5xl uppercase leading-none">📣 SHOUTOUT WALL</h1>
        <p className="text-xs uppercase tracking-widest mt-2">give credit where it's due</p>
      </motion.div>

      {digest.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="shoutout-digest">
          {digest.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ rotate: i % 2 ? -2 : 2, opacity: 0 }} animate={{ rotate: i % 2 ? -1 : 1, opacity: 1 }}
              className={`border-[4px] border-black shadow-brutal-lg p-4 ${["bg-brutal-yellow","bg-brutal-cyan","bg-brutal-pink"][i]}`}
            >
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6" />
                <div>
                  <div className="font-display font-black text-xl uppercase">{u.name}</div>
                  <div className="text-xs font-bold">🎉 {u.shoutouts_received} shoutouts this week</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <BrutalCard color="white" hover={false} className="mb-8" tilt={0}>
        <h2 className="font-display font-black text-2xl uppercase mb-3">✍️ Send Shoutout</h2>
        <div className="text-xs font-bold uppercase mb-2">Pick recipients</div>
        <div className="flex gap-2 flex-wrap mb-3 max-h-32 overflow-y-auto" data-testid="recipient-picker">
          {users.map((u) => (
            <BrutalTag key={u.id} active={picked.includes(u.id)} color="cyan" onClick={() => togglePick(u.id)}>
              @{u.name}
            </BrutalTag>
          ))}
        </div>
        <div className="text-xs font-bold uppercase mb-2">Category</div>
        <div className="flex gap-2 flex-wrap mb-3">
          {CATEGORIES.map((c) => (
            <BrutalTag key={c} active={category === c} color="pink" onClick={() => setCategory(c)}>{c}</BrutalTag>
          ))}
        </div>
        <BrutalInput
          data-testid="shoutout-message"
          placeholder="Tell the world why they're awesome..."
          value={message}
          maxLength={280}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="text-[10px] font-bold mt-1">{message.length}/280</div>
        <BrutalButton data-testid="send-shoutout" color="green" onClick={send} className="mt-3">📣 SEND</BrutalButton>
      </BrutalCard>

      <h2 className="font-display font-black text-2xl uppercase mb-3">🎉 Recent Love</h2>
      <div className="space-y-4" data-testid="shoutout-list">
        {shouts.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 20, rotate: i % 2 ? -1 : 1 }} animate={{ opacity: 1, y: 0, rotate: i % 2 ? -0.5 : 0.5 }}
            className="bg-white border-[4px] border-black shadow-brutal-lg p-5"
          >
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <img src={s.sender_avatar} alt="" className="w-9 h-9 border-[3px] border-black bg-brutal-yellow" />
              <span className="font-black uppercase">{s.sender_name}</span>
              <span className="text-xs font-bold uppercase">→</span>
              {s.recipients.map((r) => (
                <span key={r.id} className="bg-brutal-cyan border-[2px] border-black px-2 py-0.5 font-black text-xs uppercase">@{r.name}</span>
              ))}
              <span className="ml-auto"><BrutalBadge color="pink">{s.category}</BrutalBadge></span>
            </div>
            <div className="font-semibold text-lg mb-3">"{s.message}"</div>
            <div className="flex gap-2 flex-wrap">
              {REACTS.map((e) => {
                const arr = s.reactions?.[e] || [];
                const mine = arr.includes(user?.id);
                return (
                  <button
                    key={e}
                    data-testid={`react-${s.id}-${e}`}
                    onClick={() => react(s.id, e)}
                    className={`border-[3px] border-black px-3 py-1.5 shadow-brutal-sm font-black text-sm flex items-center gap-1 ${mine ? "bg-brutal-yellow" : "bg-white"}`}
                  >
                    {e} {arr.length > 0 && arr.length}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}
        {shouts.length === 0 && <div className="text-sm font-bold uppercase">No shoutouts yet. Be the first to spread love.</div>}
      </div>
    </div>
  );
}
