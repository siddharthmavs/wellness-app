import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BrutalButton, BrutalCard, BrutalBadge } from "../components/brutal";
import { EyeCareTimer } from "../components/EyeCareTimer";
import { WellnessPopup } from "../components/WellnessPopup";
import WeeklyInsightsCard from "../components/WeeklyInsightsCard";
import { useAuthStore } from "../store";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Droplet, Eye, StretchHorizontal, Wind, Sparkles } from "lucide-react";

const ACTIONS = [
  { type: "water", label: "💧 Drink Water", sub: "Hey legend, hydrate!", icon: Droplet, color: "cyan", pts: 10 },
  { type: "eye_care", label: "👀 Eye Break", sub: "Your eyes, tired bro", icon: Eye, color: "yellow", pts: 15 },
  { type: "stand", label: "🧍 Stand Up", sub: "Becoming a chair?", icon: StretchHorizontal, color: "pink", pts: 10 },
  { type: "breathing", label: "🌬️ Breathe", sub: "Reset the brain", icon: Wind, color: "green", pts: 20 },
];

export default function Dashboard() {
  const { user, setUser } = useAuthStore();
  const [notif, setNotif] = useState(null);
  const [challenges, setChallenges] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [insight, setInsight] = useState("");

  const loadChallenges = async () => {
    const { data } = await api.get("/challenges");
    setChallenges(data);
  };

  useEffect(() => {
    loadChallenges();
    // auto-show a wellness notification after 6s
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/notifications/random");
        setNotif(data);
      } catch {}
    }, 6000);
    return () => clearTimeout(t);
  }, []);

  const doAction = async (type) => {
    try {
      const { data } = await api.post("/activities", { type });
      setUser({ ...user, points: data.points, level: data.level, wellness_score: data.wellness_score, streak: data.streak });
      toast.success(`🔥 +${ACTIONS.find(a => a.type === type)?.pts || 5} pts`);
      loadChallenges();
    } catch (e) { toast.error("Oops"); }
  };

  const handleYes = async () => {
    if (notif) await doAction(notif.type);
    setNotif(null);
  };

  const handleIgnore = () => {
    setNotif(null);
    toast("😤 snoozed, bad move");
  };

  const showNotif = async () => {
    const { data } = await api.get("/notifications/random");
    setNotif(data);
  };

  const getInsight = async () => {
    setAiLoading(true);
    try {
      const { data } = await api.post("/ai/mood-insight", {});
      setInsight(data.insight);
    } catch { setInsight("AI took a nap. Try again."); }
    finally { setAiLoading(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <WellnessPopup notif={notif} onYes={handleYes} onIgnore={handleIgnore} />

      {/* Hero row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="md:col-span-2 bg-brutal-yellow border-[4px] border-black shadow-brutal-lg p-6 md:p-8 rounded-[4px] -rotate-1"
          data-testid="hero-card"
        >
          <div className="text-xs font-black uppercase tracking-widest mb-2">Yo, {user?.name?.split(" ")[0] || "Legend"}</div>
          <h1 className="font-display font-black text-4xl md:text-6xl uppercase leading-none mb-4">
            FEELING<br/>BRUTAL<br/>TODAY? 💪
          </h1>
          <div className="flex gap-3 flex-wrap">
            <BrutalBadge color="pink">🔥 {user?.streak || 0} day streak</BrutalBadge>
            <BrutalBadge color="green">⚡ {user?.points || 0} pts</BrutalBadge>
            <BrutalBadge color="cyan">🎮 Lvl {user?.level || 1}</BrutalBadge>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: -20, opacity: 0, rotate: 2 }} animate={{ y: 0, opacity: 1, rotate: 1 }}
          className="bg-brutal-pink text-white border-[4px] border-black shadow-brutal-lg p-6 rounded-[4px]"
          data-testid="wellness-score-card"
        >
          <div className="text-xs font-black uppercase tracking-widest mb-2">Wellness Score</div>
          <div className="font-display font-black text-7xl leading-none">{user?.wellness_score || 50}<span className="text-2xl">/100</span></div>
          <div className="mt-4 h-5 bg-white border-[3px] border-black">
            <div className="h-full bg-brutal-green border-r-[3px] border-black" style={{ width: `${user?.wellness_score || 50}%` }} />
          </div>
          <p className="mt-3 text-xs font-bold uppercase">Keep grinding, champ</p>
        </motion.div>
      </div>

      {/* Quick actions */}
      <h2 className="font-display font-black text-3xl uppercase mb-4">⚡ Quick Wins</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {ACTIONS.map((a, i) => (
          <motion.button
            key={a.type}
            data-testid={`action-${a.type}`}
            onClick={() => doAction(a.type)}
            whileHover={{ scale: 1.03, rotate: i % 2 ? 1 : -1 }}
            whileTap={{ scale: 0.95, x: 4, y: 4, boxShadow: "0px 0px 0px 0px rgba(0,0,0,1)" }}
            className={`bg-brutal-${a.color} border-[4px] border-black shadow-brutal-lg rounded-[4px] p-5 text-left`}
          >
            <a.icon className="w-7 h-7 mb-2" />
            <div className="font-display font-black text-xl uppercase leading-tight">{a.label}</div>
            <div className="text-xs font-bold mt-1">{a.sub}</div>
            <div className="mt-3 bg-black text-white px-2 py-0.5 inline-block font-black text-xs">+{a.pts} PTS</div>
          </motion.button>
        ))}
      </div>

      {/* Bottom row: Eye care + Insights + Challenges + AI insight */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EyeCareTimer onBreakComplete={() => doAction("eye_care")} />
        <WeeklyInsightsCard />

        <div className="bg-white border-[4px] border-black shadow-brutal-lg rounded-[4px] p-5" data-testid="challenges-card">
          <h3 className="font-display font-black uppercase text-xl mb-3">🎯 Today's Challenges</h3>
          <div className="space-y-2">
            {challenges.map((c) => (
              <div key={c.id} className="border-[3px] border-black p-3 rounded-[2px] flex items-center justify-between gap-2 bg-brutal-yellow/30">
                <div>
                  <div className="font-black text-sm uppercase">{c.title}</div>
                  <div className="text-xs font-bold">{c.progress}/{c.target} done</div>
                </div>
                {c.done ? <BrutalBadge color="green">✅ DONE +{c.reward}</BrutalBadge> : <BrutalBadge color="pink">+{c.reward} PTS</BrutalBadge>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-brutal-cyan border-[4px] border-black shadow-brutal-lg rounded-[4px] p-5" data-testid="ai-insight-card">
          <h3 className="font-display font-black uppercase text-xl mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5" /> AI Vibe Check</h3>
          <p className="text-sm font-semibold min-h-[80px]">
            {insight || "Tap below for a brutally honest take on your recent moods."}
          </p>
          <BrutalButton data-testid="ai-insight-btn" color="black" onClick={getInsight} disabled={aiLoading} className="mt-3 w-full">
            {aiLoading ? "🧠 Thinking..." : "🔮 GET INSIGHT"}
          </BrutalButton>
        </div>
      </div>

      {/* Trigger popup manually */}
      <div className="mt-8 flex gap-3 flex-wrap">
        <BrutalButton data-testid="trigger-notif-btn" color="pink" onClick={showNotif}>
          🚨 SHOW WELLNESS ALERT
        </BrutalButton>
      </div>
    </div>
  );
}
