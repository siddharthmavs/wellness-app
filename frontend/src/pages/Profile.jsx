import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store";
import { api } from "../lib/api";
import { BrutalCard, BrutalBadge, BrutalButton, BrutalInput, BrutalTag } from "../components/brutal";
import { BuddyCard, PlantCard } from "../components/BuddyAndPlant";
import { RewardsSection } from "../components/RewardsSection";
import { toast } from "sonner";

const FB_CATEGORIES = ["Wellness", "Social", "Technical", "General"];

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [badges, setBadges] = useState([]);
  const [activities, setActivities] = useState([]);
  const [fb, setFb] = useState({ category: "Wellness", message: "", anonymous: false });

  useEffect(() => {
    api.get("/badges").then(({ data }) => setBadges(data));
    api.get("/activities/me").then(({ data }) => setActivities(data));
  }, []);

  if (!user) return null;
  const progress = ((user.points % 200) / 200) * 100;

  const toggleDnd = async () => {
    const { data } = await api.patch("/users/me", { dnd: !user.dnd });
    setUser(data);
    toast.success(data.dnd ? "🌙 DND ON — silence, fool" : "🔔 DND OFF — back in chaos");
  };

  const sendFeedback = async () => {
    if (!fb.message.trim()) { toast.error("Say something."); return; }
    await api.post("/feedback", fb);
    setFb({ category: "Wellness", message: "", anonymous: false });
    toast.success("📬 Feedback fired");
  };

  const ROLE_COLORS = { admin: "bg-black text-brutal-yellow", team_lead: "bg-brutal-pink text-white", employee: "bg-brutal-cyan" };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: -1, opacity: 1 }}
          className="md:col-span-1 bg-brutal-yellow border-[4px] border-black shadow-brutal-lg p-6 text-center rounded-[4px]"
          data-testid="profile-card"
        >
          <img src={user.avatar} alt={user.name} className="w-28 h-28 mx-auto border-[4px] border-black bg-white mb-3" />
          <h2 className="font-display font-black text-3xl uppercase leading-none">{user.name}</h2>
          <p className="text-xs uppercase font-bold mt-1">{user.department}</p>
          <div className="mt-2">
            <span className={`${ROLE_COLORS[user.role || "employee"]} border-[3px] border-black px-3 py-1 font-black text-xs uppercase shadow-brutal-sm inline-block`} data-testid="role-badge">
              {user.role === "admin" ? "🛡️ ADMIN" : user.role === "team_lead" ? "⚡ TEAM LEAD" : "👤 EMPLOYEE"}
            </span>
          </div>
          <div className="flex gap-2 justify-center mt-3 flex-wrap">
            <BrutalBadge color="pink">🔥 {user.streak} streak</BrutalBadge>
            <BrutalBadge color="green">⚡ {user.points} pts</BrutalBadge>
          </div>
          <button
            data-testid="dnd-toggle"
            onClick={toggleDnd}
            className={`mt-4 w-full border-[3px] border-black px-3 py-2 font-black uppercase text-xs shadow-brutal-sm ${user.dnd ? "bg-black text-white" : "bg-white"}`}
          >
            {user.dnd ? "🌙 DND IS ON" : "🔔 DND IS OFF"}
          </button>
        </motion.div>

        <div className="md:col-span-2 bg-white border-[4px] border-black shadow-brutal-lg p-6 rounded-[4px]">
          <h3 className="font-display font-black text-2xl uppercase mb-3">🎮 Level {user.level}</h3>
          <div className="h-8 border-[3px] border-black bg-white">
            <div className="h-full bg-brutal-cyan border-r-[3px] border-black transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs font-bold uppercase mt-2">{200 - (user.points % 200)} pts to next level</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="bg-brutal-pink text-white border-[3px] border-black p-3 text-center rounded-[2px]">
              <div className="font-display font-black text-3xl">{user.wellness_score}</div>
              <div className="text-[10px] font-bold uppercase">Wellness</div>
            </div>
            <div className="bg-brutal-green border-[3px] border-black p-3 text-center rounded-[2px]">
              <div className="font-display font-black text-3xl">{user.streak}</div>
              <div className="text-[10px] font-bold uppercase">Streak</div>
            </div>
            <div className="bg-brutal-cyan border-[3px] border-black p-3 text-center rounded-[2px]">
              <div className="font-display font-black text-3xl">{activities.length}</div>
              <div className="text-[10px] font-bold uppercase">Activities</div>
            </div>
          </div>
        </div>
      </div>

      <RewardsSection />

      <h2 className="font-display font-black text-3xl uppercase mb-4">🤝 Connections</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        <BuddyCard />
        <PlantCard />
      </div>

      <h2 className="font-display font-black text-3xl uppercase mb-4">🏅 Badges</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10" data-testid="badges-grid">
        {badges.map((b, i) => {
          const earned = user.badges?.includes(b.id);
          return (
            <motion.div
              key={b.id}
              initial={{ rotate: i % 2 ? -2 : 2, opacity: 0 }} animate={{ rotate: i % 2 ? -1 : 1, opacity: 1 }}
              whileHover={{ scale: 1.05, rotate: 0 }}
              className={`border-[4px] border-black shadow-brutal p-4 text-center rounded-[4px] ${earned ? "bg-white" : "bg-gray-100 opacity-50"}`}
              style={{ background: earned ? b.color : undefined }}
              data-testid={`badge-${b.id}`}
            >
              <div className="text-4xl">{b.emoji}</div>
              <div className="font-black uppercase text-sm mt-2">{b.name}</div>
              <div className="text-[10px] font-bold mt-1">{b.desc}</div>
              {!earned && <div className="text-[10px] font-bold uppercase mt-1 text-gray-700">LOCKED</div>}
            </motion.div>
          );
        })}
      </div>

      <BrutalCard color="white" hover={false} className="mb-8" data-testid="feedback-card">
        <h2 className="font-display font-black text-2xl uppercase mb-3">💬 Drop Feedback</h2>
        <div className="flex gap-2 flex-wrap mb-3">
          {FB_CATEGORIES.map((c) => (
            <BrutalTag key={c} active={fb.category === c} color="pink" onClick={() => setFb({ ...fb, category: c })}>{c}</BrutalTag>
          ))}
        </div>
        <textarea
          data-testid="feedback-message"
          placeholder="Tell us what's brewing..."
          value={fb.message}
          onChange={(e) => setFb({ ...fb, message: e.target.value })}
          rows={3}
          className="w-full border-[3px] border-black px-4 py-3 font-medium resize-none mb-3"
        />
        <label className="flex items-center gap-2 font-bold uppercase text-xs mb-3">
          <input type="checkbox" checked={fb.anonymous} onChange={(e) => setFb({ ...fb, anonymous: e.target.checked })} className="w-4 h-4 border-[3px] border-black" />
          🥷 Send anonymously
        </label>
        <BrutalButton data-testid="feedback-submit" color="green" onClick={sendFeedback}>📬 SEND</BrutalButton>
      </BrutalCard>

      <h2 className="font-display font-black text-2xl uppercase mb-3">📊 Recent Activity</h2>
      <div className="space-y-2" data-testid="activities-list">
        {activities.slice(0, 15).map((a) => (
          <div key={a.id} className="flex items-center justify-between bg-white border-[3px] border-black shadow-brutal-sm p-3 rounded-[2px]">
            <div className="font-black uppercase text-sm">{a.type.replace("_", " ")}</div>
            <div className="text-xs font-bold">{new Date(a.created_at).toLocaleString()}</div>
            <BrutalBadge color="green">+{a.points}</BrutalBadge>
          </div>
        ))}
        {activities.length === 0 && <div className="text-sm font-bold uppercase">No activities yet. Go hit some quick wins.</div>}
      </div>
    </div>
  );
}
