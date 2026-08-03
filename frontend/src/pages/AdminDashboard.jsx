import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalInput, BrutalTag } from "../components/brutal";
import { toast } from "sonner";
import { Users, Trophy, Bell, BarChart3, MessageSquare, Trash2, Gift, Brain, Settings, Megaphone, Shuffle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LineChart, Line, Tooltip } from "recharts";

const TABS = [
  { id: "users", label: "USERS", icon: Users, color: "yellow" },
  { id: "challenges", label: "CHALLENGES", icon: Trophy, color: "pink" },
  { id: "reminders", label: "REMINDERS", icon: Bell, color: "cyan" },
  { id: "analytics", label: "ANALYTICS", icon: BarChart3, color: "green" },
  { id: "feedback", label: "FEEDBACK", icon: MessageSquare, color: "yellow" },
  { id: "rewards", label: "REWARDS", icon: Gift, color: "pink" },
  { id: "quizzes", label: "QUIZZES", icon: Brain, color: "cyan" },
  { id: "points", label: "POINTS", icon: Settings, color: "green" },
  { id: "teams", label: "GAME TEAMS", icon: Shuffle, color: "yellow" },
  { id: "announcements", label: "ANNOUNCEMENTS", icon: Megaphone, color: "pink" },
];

const PALETTE = ["#FFE600", "#00E5FF", "#FF4D6D", "#00C853"];

export default function AdminDashboard() {
  const [tab, setTab] = useState("users");
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: -1, opacity: 1 }}
        className="bg-black text-brutal-yellow border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
        data-testid="admin-header"
      >
        <h1 className="font-display font-black text-5xl md:text-6xl uppercase leading-none">Admin Zone</h1>
        <p className="text-xs uppercase tracking-widest mt-2">control center · don't break stuff</p>
      </motion.div>

      <div className="flex gap-2 mb-6 flex-wrap" data-testid="admin-tabs">
        {TABS.map((t) => (
          <BrutalTag key={t.id} active={tab === t.id} color={t.color} onClick={() => setTab(t.id)}>
            <t.icon className="inline w-4 h-4 mr-1" /> {t.label}
          </BrutalTag>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "challenges" && <ChallengesTab />}
      {tab === "reminders" && <RemindersTab />}
      {tab === "analytics" && <AnalyticsTab />}
      {tab === "feedback" && <FeedbackTab />}
      {tab === "rewards" && <RewardsTab />}
      {tab === "quizzes" && <QuizzesTab />}
      {tab === "points" && <PointsTab />}
      {tab === "teams" && <TeamsTab />}
      {tab === "announcements" && <AnnouncementsTab />}
    </div>
  );
}

const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const load = async () => { const { data } = await api.get("/admin/users"); setUsers(data); };
  useEffect(() => { load(); }, []);

  const setRole = async (u, role) => {
    await api.patch(`/admin/users/${u.id}`, { role });
    toast.success(`Role updated for ${u.name}`);
    load();
  };

  const del = async (u) => {
    if (!window.confirm(`Yeet ${u.name}?`)) return;
    await api.delete(`/admin/users/${u.id}`);
    toast("👋 Bye");
    load();
  };

  return (
    <BrutalCard color="white" hover={false} data-testid="users-tab">
      <h2 className="font-display font-black text-2xl uppercase mb-4">👥 Users ({users.length})</h2>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 border-[3px] border-black p-3 bg-white shadow-brutal-sm">
            <img src={u.avatar} className="w-10 h-10 border-[2px] border-black" alt="" />
            <div className="flex-1">
              <div className="font-black uppercase">{u.name}</div>
              <div className="text-xs font-bold">{u.email} · {u.department} · ⚡ {u.points}</div>
            </div>
            <select
              data-testid={`role-${u.id}`}
              value={u.role || "employee"}
              onChange={(e) => setRole(u, e.target.value)}
              className="border-[3px] border-black px-2 py-1 font-black text-xs uppercase"
            >
              <option value="employee">Employee</option>
              <option value="team_lead">Team Lead</option>
              <option value="admin">Admin</option>
            </select>
            <button
              data-testid={`delete-${u.id}`}
              onClick={() => del(u)}
              className="bg-brutal-pink border-[3px] border-black p-2 shadow-brutal-sm"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </BrutalCard>
  );
};

const ChallengesTab = () => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: "", reward: 30, target: 3, type: "water", scope: "daily" });
  const load = async () => { const { data } = await api.get("/admin/challenges"); setItems(data); };
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.title) { toast.error("title plz"); return; }
    await api.post("/admin/challenges", form);
    toast.success("📣 Challenge created");
    setForm({ title: "", reward: 30, target: 3, type: "water", scope: "daily" });
    load();
  };
  const del = async (id) => { await api.delete(`/admin/challenges/${id}`); load(); };
  return (
    <div className="grid md:grid-cols-2 gap-6" data-testid="challenges-tab">
      <BrutalCard color="yellow" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">➕ New Challenge</h3>
        <div className="space-y-3">
          <BrutalInput data-testid="ch-title" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <BrutalInput type="number" placeholder="Reward" value={form.reward} onChange={(e) => setForm({ ...form, reward: +e.target.value })} />
            <BrutalInput type="number" placeholder="Target" value={form.target} onChange={(e) => setForm({ ...form, target: +e.target.value })} />
          </div>
          <select className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="water">Water</option>
            <option value="eye_care">Eye Care</option>
            <option value="stand">Stand</option>
            <option value="breathing">Breathing</option>
            <option value="mood">Mood</option>
          </select>
          <select className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <BrutalButton data-testid="ch-create" color="green" onClick={create} className="w-full">CREATE 🚀</BrutalButton>
        </div>
      </BrutalCard>

      <BrutalCard color="white" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">📋 Custom Challenges</h3>
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="border-[3px] border-black p-3 flex items-center justify-between">
              <div>
                <div className="font-black uppercase text-sm">{c.title}</div>
                <div className="text-xs font-bold">{c.scope} · {c.type} · target {c.target} · reward +{c.reward}</div>
              </div>
              <button onClick={() => del(c.id)} className="bg-brutal-pink border-[2px] border-black p-1.5"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {items.length === 0 && <div className="text-sm font-bold uppercase">No custom challenges yet.</div>}
        </div>
      </BrutalCard>
    </div>
  );
};

const RemindersTab = () => {
  const [cfg, setCfg] = useState({ water_interval_min: 60, eye_care_interval_min: 20, stand_interval_min: 90, enabled: true });
  useEffect(() => { api.get("/admin/reminders").then(({ data }) => setCfg(data)); }, []);
  const save = async () => {
    await api.put("/admin/reminders", cfg);
    toast.success("⚙️ Saved");
  };
  return (
    <BrutalCard color="cyan" hover={false} data-testid="reminders-tab">
      <h3 className="font-display font-black text-2xl uppercase mb-3">⏰ Reminder Config</h3>
      <div className="space-y-3 max-w-md">
        <div>
          <label className="font-bold uppercase text-xs">💧 Water (minutes)</label>
          <BrutalInput type="number" value={cfg.water_interval_min} onChange={(e) => setCfg({ ...cfg, water_interval_min: +e.target.value })} />
        </div>
        <div>
          <label className="font-bold uppercase text-xs">👀 Eye Care (minutes)</label>
          <BrutalInput type="number" value={cfg.eye_care_interval_min} onChange={(e) => setCfg({ ...cfg, eye_care_interval_min: +e.target.value })} />
        </div>
        <div>
          <label className="font-bold uppercase text-xs">🧍 Stand (minutes)</label>
          <BrutalInput type="number" value={cfg.stand_interval_min} onChange={(e) => setCfg({ ...cfg, stand_interval_min: +e.target.value })} />
        </div>
        <label className="flex items-center gap-2 font-bold uppercase">
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="w-5 h-5 border-[3px] border-black" />
          Enabled
        </label>
        <BrutalButton data-testid="save-reminders" color="green" onClick={save}>💾 SAVE</BrutalButton>
      </div>
    </BrutalCard>
  );
};

const AnalyticsTab = () => {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/admin/analytics").then(({ data }) => setData(data)); }, []);
  if (!data) return <div className="font-bold uppercase">Loading...</div>;
  return (
    <div className="space-y-6" data-testid="analytics-tab">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Users", val: data.total_users, c: "yellow" },
          { label: "DAU", val: data.dau, c: "cyan" },
          { label: "WAU", val: data.wau, c: "pink" },
          { label: "MAU", val: data.mau, c: "green" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ rotate: i % 2 ? -2 : 2, opacity: 0 }}
            animate={{ rotate: i % 2 ? -1 : 1, opacity: 1 }}
            className={`bg-brutal-${s.c} border-[4px] border-black shadow-brutal-lg p-4`}
          >
            <div className="font-display font-black text-5xl">{s.val}</div>
            <div className="text-xs font-black uppercase">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <BrutalCard color="white" hover={false}>
          <h3 className="font-display font-black uppercase text-xl mb-3">📊 7-day Activity Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.trend}>
              <XAxis dataKey="day" tick={{ fill: "#000", fontWeight: 900, fontSize: 10 }} />
              <YAxis tick={{ fill: "#000", fontWeight: 900, fontSize: 10 }} />
              <Tooltip contentStyle={{ border: "3px solid #000", borderRadius: 0, fontWeight: 900 }} />
              <Line type="monotone" dataKey="count" stroke="#000" strokeWidth={4} dot={{ fill: "#FFE600", stroke: "#000", strokeWidth: 3, r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </BrutalCard>

        <BrutalCard color="white" hover={false}>
          <h3 className="font-display font-black uppercase text-xl mb-3">🎭 Mood Spread (week)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.mood_chart}>
              <XAxis dataKey="label" tick={{ fill: "#000", fontWeight: 900, fontSize: 10 }} />
              <YAxis tick={{ fill: "#000", fontWeight: 900, fontSize: 10 }} />
              <Tooltip contentStyle={{ border: "3px solid #000", borderRadius: 0, fontWeight: 900 }} />
              <Bar dataKey="count" stroke="#000" strokeWidth={3}>
                {data.mood_chart.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </BrutalCard>
      </div>

      <BrutalCard color="yellow" hover={false}>
        <h3 className="font-display font-black uppercase text-xl mb-3">📦 Content Counts</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data.counts).map(([k, v]) => (
            <div key={k} className="bg-white border-[3px] border-black p-3 text-center">
              <div className="font-display font-black text-3xl">{v}</div>
              <div className="text-xs font-black uppercase">{k.replace("_", " ")}</div>
            </div>
          ))}
        </div>
      </BrutalCard>
    </div>
  );
};

const FeedbackTab = () => {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/feedback").then(({ data }) => setItems(data)).catch(() => {}); }, []);
  return (
    <BrutalCard color="white" hover={false} data-testid="feedback-tab">
      <h3 className="font-display font-black text-2xl uppercase mb-3">💬 Feedback Inbox ({items.length})</h3>
      <div className="space-y-2">
        {items.map((f) => (
          <div key={f.id} className="border-[3px] border-black p-3 bg-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-brutal-pink text-white border-[2px] border-black px-2 py-0.5 font-black text-xs">{f.category}</span>
              <span className="font-black text-sm">{f.user_name}</span>
              <span className="text-xs ml-auto font-bold">{new Date(f.created_at).toLocaleString()}</span>
            </div>
            <div className="text-sm font-medium">{f.message}</div>
          </div>
        ))}
        {items.length === 0 && <div className="text-sm font-bold uppercase">No feedback yet.</div>}
      </div>
    </BrutalCard>
  );
};

const RewardsTab = () => {
  const [users, setUsers] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [form, setForm] = useState({ user_id: "", type: "coupon", points: 0, message: "", code: "" });

  const load = async () => {
    const [u, r] = await Promise.all([api.get("/admin/users"), api.get("/admin/rewards")]);
    setUsers(u.data);
    setRewards(r.data);
  };
  useEffect(() => { load(); }, []);

  const issue = async () => {
    if (!form.user_id || !form.message) { toast.error("Pick user + add message"); return; }
    await api.post("/admin/rewards", form);
    toast.success("🎁 Reward issued!");
    setForm({ user_id: "", type: "coupon", points: 0, message: "", code: "" });
    load();
  };

  return (
    <div className="grid md:grid-cols-2 gap-6" data-testid="rewards-tab">
      <BrutalCard color="pink" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3 text-white">🎁 Issue Surprise Reward</h3>
        <div className="space-y-3">
          <div>
            <label className="font-black uppercase text-xs text-white block mb-1">Recipient</label>
            <select
              data-testid="reward-user"
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase bg-white"
            >
              <option value="">— pick a legend —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.department}</option>)}
            </select>
          </div>
          <div>
            <label className="font-black uppercase text-xs text-white block mb-1">Type</label>
            <select
              data-testid="reward-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase bg-white"
            >
              <option value="coupon">🎟️ Coupon</option>
              <option value="points">⚡ Bonus Points</option>
              <option value="shoutout">📣 Shoutout</option>
            </select>
          </div>
          {form.type === "points" && (
            <BrutalInput type="number" placeholder="Points to grant" value={form.points} onChange={(e) => setForm({ ...form, points: +e.target.value })} />
          )}
          {form.type === "coupon" && (
            <BrutalInput placeholder="Coupon code (e.g. PIZZA50)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          )}
          <BrutalInput data-testid="reward-message" placeholder="Reason / message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <BrutalButton data-testid="reward-issue" color="green" onClick={issue} className="w-full">🚀 ISSUE</BrutalButton>
        </div>
      </BrutalCard>

      <BrutalCard color="white" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">🏆 Recently Issued</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {rewards.map((r) => (
            <div key={r.id} className="border-[3px] border-black p-3 bg-white">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="bg-brutal-yellow border-[2px] border-black px-2 py-0.5 font-black text-[10px] uppercase">{r.type}</span>
                <span className="font-black text-sm">→ {r.user_name}</span>
                {r.claimed && <span className="bg-brutal-green border-[2px] border-black px-2 py-0.5 font-black text-[10px] uppercase">✅ claimed</span>}
                <span className="text-[10px] font-bold ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              <div className="text-sm font-medium">{r.message}</div>
              {r.code && <div className="text-xs font-mono font-black mt-1">CODE: {r.code}</div>}
            </div>
          ))}
          {rewards.length === 0 && <div className="text-sm font-bold uppercase">No rewards issued yet.</div>}
        </div>
      </BrutalCard>
    </div>
  );
};

const DEPTS = ["Engineering", "Design", "Marketing", "HR", "Product", "Management", "General", "QA"];

const QuizzesTab = () => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ department: "Engineering", title: "", questions: [{ q: "", options: ["", "", ""], answer: 0 }] });

  const load = async () => { const { data } = await api.get("/admin/quizzes"); setItems(data); };
  useEffect(() => { load(); }, []);

  const addQ = () => setForm({ ...form, questions: [...form.questions, { q: "", options: ["", "", ""], answer: 0 }] });
  const setQ = (i, field, val) => {
    const qs = [...form.questions]; qs[i] = { ...qs[i], [field]: val };
    setForm({ ...form, questions: qs });
  };
  const setOpt = (i, j, val) => {
    const qs = [...form.questions]; const opts = [...qs[i].options]; opts[j] = val; qs[i].options = opts;
    setForm({ ...form, questions: qs });
  };
  const create = async () => {
    if (!form.questions.every(q => q.q && q.options.every(o => o))) { toast.error("Fill all fields"); return; }
    await api.post("/admin/quizzes", form);
    toast.success("📚 Quiz created");
    setForm({ department: "Engineering", title: "", questions: [{ q: "", options: ["", "", ""], answer: 0 }] });
    load();
  };
  const del = async (id) => { await api.delete(`/admin/quizzes/${id}`); load(); };

  return (
    <div className="grid lg:grid-cols-2 gap-6" data-testid="quizzes-tab">
      <BrutalCard color="cyan" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">➕ New Custom Quiz</h3>
        <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full border-[3px] border-black px-3 py-3 font-bold uppercase mb-2">
          {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <BrutalInput data-testid="quiz-title" placeholder="Quiz title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mb-3" />
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {form.questions.map((q, i) => (
            <div key={i} className="border-[3px] border-black p-3 bg-white">
              <div className="text-xs font-black uppercase mb-1">Q{i + 1}</div>
              <BrutalInput placeholder="Question text" value={q.q} onChange={(e) => setQ(i, "q", e.target.value)} className="mb-2" />
              {q.options.map((o, j) => (
                <div key={j} className="flex items-center gap-2 mb-1">
                  <input type="radio" checked={q.answer === j} onChange={() => setQ(i, "answer", j)} className="w-5 h-5" />
                  <BrutalInput placeholder={`Option ${String.fromCharCode(65 + j)}`} value={o} onChange={(e) => setOpt(i, j, e.target.value)} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <BrutalButton color="white" onClick={addQ}>+ Q</BrutalButton>
          <BrutalButton data-testid="quiz-create" color="green" onClick={create}>🚀 CREATE</BrutalButton>
        </div>
      </BrutalCard>
      <BrutalCard color="white" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">📋 Custom Quizzes</h3>
        <div className="space-y-2">
          {items.map((q) => (
            <div key={q.id} className="border-[3px] border-black p-3 flex items-center justify-between">
              <div>
                <div className="font-black uppercase">{q.title}</div>
                <div className="text-xs font-bold">{q.department} · {q.questions.length} Qs</div>
              </div>
              <button data-testid={`quiz-delete-${q.id}`} onClick={() => del(q.id)} className="bg-brutal-pink border-[2px] border-black p-1.5"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {items.length === 0 && <div className="text-sm font-bold uppercase">No custom quizzes. Hardcoded ones still active.</div>}
        </div>
      </BrutalCard>
    </div>
  );
};

const PointsTab = () => {
  const [config, setConfig] = useState({});
  const [game, setGame] = useState({});
  const [users, setUsers] = useState([]);
  const [adj, setAdj] = useState({ user_id: "", points: 10, reason: "" });
  const [log, setLog] = useState([]);

  const load = async () => {
    const [pc, gc, u, l] = await Promise.all([
      api.get("/admin/points-config"),
      api.get("/admin/game-config"),
      api.get("/admin/users"),
      api.get("/admin/points/log"),
    ]);
    setConfig(pc.data); setGame(gc.data); setUsers(u.data); setLog(l.data);
  };
  useEffect(() => { load(); }, []);

  const savePoints = async () => {
    await api.put("/admin/points-config", config);
    toast.success("⚡ Points config saved");
  };
  const saveGame = async () => {
    await api.put("/admin/game-config", game);
    toast.success("🎮 Gamification saved");
  };
  const award = async () => {
    if (!adj.user_id || !adj.reason) { toast.error("Pick user + reason"); return; }
    await api.post("/admin/points/award", adj);
    toast.success(`⚡ ${adj.points > 0 ? "+" : ""}${adj.points} → user`);
    setAdj({ user_id: "", points: 10, reason: "" });
    load();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6" data-testid="points-tab">
      <BrutalCard color="green" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">⚡ Point Allocation</h3>
        <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
          {Object.entries(config).map(([k, v]) => (
            <div key={k}>
              <label className="font-bold uppercase text-[10px]">{k}</label>
              <input
                type="number"
                value={v}
                data-testid={`pts-${k}`}
                onChange={(e) => setConfig({ ...config, [k]: +e.target.value })}
                className="w-full border-[3px] border-black px-2 py-1 font-bold bg-white"
              />
            </div>
          ))}
        </div>
        <BrutalButton data-testid="save-points-config" color="black" onClick={savePoints} className="mt-3">💾 SAVE</BrutalButton>
      </BrutalCard>

      <BrutalCard color="yellow" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">🎮 Gamification Settings</h3>
        <div className="space-y-3">
          <div>
            <label className="font-bold uppercase text-xs">Level threshold (pts/level)</label>
            <BrutalInput type="number" value={game.level_threshold || 200} onChange={(e) => setGame({ ...game, level_threshold: +e.target.value })} />
          </div>
          <div>
            <label className="font-bold uppercase text-xs">Streak gap hours</label>
            <BrutalInput type="number" value={game.streak_gap_hours || 36} onChange={(e) => setGame({ ...game, streak_gap_hours: +e.target.value })} />
          </div>
          <div>
            <label className="font-bold uppercase text-xs">Wellness score per action</label>
            <BrutalInput type="number" value={game.wellness_score_increment || 2} onChange={(e) => setGame({ ...game, wellness_score_increment: +e.target.value })} />
          </div>
          <BrutalButton color="black" onClick={saveGame}>💾 SAVE</BrutalButton>
        </div>

        <hr className="my-4 border-[2px] border-black" />
        <h4 className="font-display font-black text-xl uppercase mb-2">🎁 Manual Point Adjustment</h4>
        <select value={adj.user_id} onChange={(e) => setAdj({ ...adj, user_id: e.target.value })} className="w-full border-[3px] border-black px-3 py-2 font-bold uppercase mb-2 bg-white">
          <option value="">— pick user —</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name} · {u.points}pts</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <BrutalInput type="number" value={adj.points} onChange={(e) => setAdj({ ...adj, points: +e.target.value })} placeholder="Points (+/-)" />
          <BrutalInput value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} placeholder="Reason" />
        </div>
        <BrutalButton data-testid="award-points" color="pink" onClick={award}>⚡ AWARD</BrutalButton>

        {log.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-black uppercase mb-2">📋 Audit Log</div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {log.slice(0, 10).map((l) => (
                <div key={l.id} className="text-xs bg-white border-[2px] border-black p-2 flex justify-between">
                  <span className="font-bold">{l.points > 0 ? "+" : ""}{l.points} {l.user_id ? "user" : "team"} · {l.reason}</span>
                  <span className="text-[10px]">{new Date(l.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </BrutalCard>
    </div>
  );
};

const TeamsTab = () => {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", color: "yellow" });
  const [shuffleN, setShuffleN] = useState(4);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [memberPicks, setMemberPicks] = useState([]);

  const load = async () => {
    const [t, u] = await Promise.all([api.get("/admin/game-teams"), api.get("/admin/users")]);
    setTeams(t.data); setUsers(u.data);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) { toast.error("Name plz"); return; }
    await api.post("/admin/game-teams", form);
    toast.success("⚔️ Team created");
    setForm({ name: "", color: "yellow" });
    load();
  };
  const shuffle = async () => {
    if (!window.confirm(`Auto-shuffle into ${shuffleN} teams? This replaces existing auto-shuffled teams.`)) return;
    await api.post("/admin/game-teams/shuffle", { num_teams: shuffleN, name_prefix: "Squad" });
    toast.success("🎲 Shuffled!");
    load();
  };
  const del = async (id) => {
    if (!window.confirm("Delete team?")) return;
    await api.delete(`/admin/game-teams/${id}`);
    load();
  };
  const openMembers = (t) => { setSelectedTeam(t); setMemberPicks(t.members || []); };
  const saveMembers = async () => {
    await api.put(`/admin/game-teams/${selectedTeam.id}/members`, { user_ids: memberPicks });
    toast.success("👥 Updated");
    setSelectedTeam(null);
    load();
  };
  const award = async (tid, pts) => {
    const reason = window.prompt(`Reason for ${pts > 0 ? "+" : ""}${pts} pts?`);
    if (!reason) return;
    await api.post("/admin/points/award", { team_id: tid, points: pts, reason });
    toast.success(`⚡ ${pts > 0 ? "+" : ""}${pts} team pts`);
    load();
  };

  return (
    <div className="space-y-6" data-testid="teams-tab">
      <div className="grid md:grid-cols-2 gap-6">
        <BrutalCard color="yellow" hover={false}>
          <h3 className="font-display font-black text-2xl uppercase mb-3">➕ Create Team</h3>
          <BrutalInput data-testid="team-name" placeholder="Team name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mb-2" />
          <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="w-full border-[3px] border-black px-3 py-2 font-bold uppercase mb-3 bg-white">
            <option value="yellow">Yellow</option>
            <option value="cyan">Cyan</option>
            <option value="pink">Pink</option>
            <option value="green">Green</option>
          </select>
          <BrutalButton data-testid="team-create" color="green" onClick={create}>🚀 CREATE</BrutalButton>
        </BrutalCard>
        <BrutalCard color="pink" hover={false}>
          <h3 className="font-display font-black text-2xl uppercase mb-3 text-white">🎲 Auto-Shuffle</h3>
          <p className="text-white text-sm mb-3 font-bold">Randomly distribute all users into N teams (fair distribution).</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="font-bold uppercase text-xs text-white">Teams (2-8)</label>
              <BrutalInput type="number" min="2" max="8" value={shuffleN} onChange={(e) => setShuffleN(+e.target.value)} />
            </div>
            <BrutalButton data-testid="team-shuffle" color="black" onClick={shuffle}>🎲 SHUFFLE</BrutalButton>
          </div>
        </BrutalCard>
      </div>

      <BrutalCard color="white" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">⚔️ Teams ({teams.length})</h3>
        <div className="space-y-3">
          {teams.map((t) => (
            <div key={t.id} className={`border-[4px] border-black bg-brutal-${t.color} p-4`}>
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <div className="font-display font-black text-xl uppercase flex-1">{t.name}</div>
                <div className="font-display font-black text-2xl">⚡ {t.team_points}</div>
                <button onClick={() => award(t.id, 50)} className="bg-white border-[3px] border-black px-2 py-1 font-black text-xs">+50</button>
                <button onClick={() => award(t.id, -10)} className="bg-white border-[3px] border-black px-2 py-1 font-black text-xs">-10</button>
                <button data-testid={`team-members-${t.id}`} onClick={() => openMembers(t)} className="bg-black text-white border-[3px] border-black px-2 py-1 font-black text-xs">👥 {t.members?.length || 0}</button>
                <button onClick={() => del(t.id)} className="bg-brutal-pink border-[3px] border-black p-1.5"><Trash2 className="w-3 h-3" /></button>
              </div>
              <div className="flex flex-wrap gap-1">
                {(t.member_details || []).map((m) => (
                  <span key={m.id} className="bg-white border-[2px] border-black px-1.5 py-0.5 font-black text-[10px]">{m.name}</span>
                ))}
              </div>
            </div>
          ))}
          {teams.length === 0 && <div className="text-sm font-bold uppercase">No teams. Create or shuffle.</div>}
        </div>
      </BrutalCard>

      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setSelectedTeam(null)}>
          <div className="bg-white border-[4px] border-black shadow-brutal-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-black text-2xl uppercase mb-3">Members of {selectedTeam.name}</h3>
            <div className="grid grid-cols-2 gap-2 mb-4 max-h-96 overflow-y-auto">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 border-[3px] border-black p-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memberPicks.includes(u.id)}
                    onChange={() => setMemberPicks(memberPicks.includes(u.id) ? memberPicks.filter(x => x !== u.id) : [...memberPicks, u.id])}
                    className="w-4 h-4"
                  />
                  <img src={u.avatar} alt="" className="w-7 h-7 border-[2px] border-black" />
                  <span className="font-black uppercase text-xs">{u.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <BrutalButton color="green" onClick={saveMembers}>💾 SAVE</BrutalButton>
              <BrutalButton color="white" onClick={() => setSelectedTeam(null)}>CANCEL</BrutalButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AnnouncementsTab = () => {
  const [form, setForm] = useState({ title: "", message: "", target: "all", target_user_ids: [], kind: "info" });
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);

  const load = async () => {
    const [u, h] = await Promise.all([api.get("/admin/users"), api.get("/admin/announcements")]);
    setUsers(u.data); setHistory(h.data);
  };
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!form.title || !form.message) { toast.error("Title + message needed"); return; }
    if (form.target === "specific" && form.target_user_ids.length === 0) { toast.error("Pick at least 1 user"); return; }
    const body = { ...form, target: form.target === "specific" ? "specific" : "all" };
    await api.post("/admin/announcements", body);
    toast.success(`📣 Sent to ${form.target === "all" ? "everyone" : form.target_user_ids.length + " users"}`);
    setForm({ title: "", message: "", target: "all", target_user_ids: [], kind: "info" });
    load();
  };

  const togglePick = (uid) => {
    setForm({ ...form, target_user_ids: form.target_user_ids.includes(uid) ? form.target_user_ids.filter(x => x !== uid) : [...form.target_user_ids, uid] });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6" data-testid="announcements-tab">
      <BrutalCard color="pink" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3 text-white">📣 Send Announcement</h3>
        <BrutalInput data-testid="ann-title" placeholder="Title (e.g. Pizza party 🍕)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mb-3" />
        <textarea
          data-testid="ann-message"
          placeholder="Message..."
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          rows={4}
          className="w-full border-[3px] border-black px-3 py-2 font-medium resize-none mb-3"
        />
        <div className="grid grid-cols-2 gap-2 mb-3">
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="border-[3px] border-black px-2 py-2 font-bold uppercase bg-white">
            <option value="info">ℹ️ Info</option>
            <option value="alert">🚨 Alert</option>
            <option value="party">🎉 Party</option>
          </select>
          <select data-testid="ann-target" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="border-[3px] border-black px-2 py-2 font-bold uppercase bg-white">
            <option value="all">🌍 Everyone</option>
            <option value="specific">🎯 Specific users</option>
          </select>
        </div>
        {form.target === "specific" && (
          <div className="border-[3px] border-black p-2 mb-3 max-h-40 overflow-y-auto bg-white">
            {users.map(u => (
              <label key={u.id} className="flex items-center gap-2 py-1 cursor-pointer text-black">
                <input type="checkbox" checked={form.target_user_ids.includes(u.id)} onChange={() => togglePick(u.id)} className="w-4 h-4" />
                <span className="font-black text-xs">{u.name}</span>
              </label>
            ))}
          </div>
        )}
        <BrutalButton data-testid="ann-send" color="green" onClick={send} className="w-full">🚀 BLAST</BrutalButton>
      </BrutalCard>

      <BrutalCard color="white" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">📋 History ({history.length})</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {history.map((a) => (
            <div key={a.id} className="border-[3px] border-black p-3 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <span className={`border-[2px] border-black px-1.5 py-0.5 font-black text-[10px] uppercase ${a.kind === "alert" ? "bg-brutal-pink text-white" : a.kind === "party" ? "bg-brutal-yellow" : "bg-brutal-cyan"}`}>{a.kind}</span>
                <span className="font-black text-sm">{a.title}</span>
                <span className="text-[10px] ml-auto font-bold">{a.recipients?.length || 0} ppl · ✅{a.read_by?.length || 0}</span>
              </div>
              <div className="text-sm font-medium">{a.message}</div>
              <div className="text-[10px] font-bold mt-1">{new Date(a.created_at).toLocaleString()}</div>
            </div>
          ))}
          {history.length === 0 && <div className="text-sm font-bold uppercase">No announcements yet.</div>}
        </div>
      </BrutalCard>
    </div>
  );
};

