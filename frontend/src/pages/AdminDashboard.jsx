import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalInput, BrutalTag } from "../components/brutal";
import { toast } from "sonner";
import { Users, Trophy, Bell, BarChart3, MessageSquare, Trash2, Gift, BookOpen, Zap, Settings2, Megaphone, Pencil, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LineChart, Line, Tooltip } from "recharts";

const TABS = [
  { id: "users", label: "USERS", icon: Users, color: "yellow" },
  { id: "challenges", label: "CHALLENGES", icon: Trophy, color: "pink" },
  { id: "reminders", label: "REMINDERS", icon: Bell, color: "cyan" },
  { id: "analytics", label: "ANALYTICS", icon: BarChart3, color: "green" },
  { id: "feedback", label: "FEEDBACK", icon: MessageSquare, color: "yellow" },
  { id: "rewards", label: "REWARDS", icon: Gift, color: "pink" },
  { id: "quizzes", label: "QUIZZES", icon: BookOpen, color: "cyan" },
  { id: "points", label: "POINTS", icon: Zap, color: "yellow" },
  { id: "gamification", label: "GAMIFY", icon: Settings2, color: "green" },
  { id: "announcements", label: "ANNOUNCE", icon: Megaphone, color: "pink" },
  { id: "teams", label: "TEAMS", icon: Users, color: "cyan" },
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
        <h1 className="font-display font-black text-5xl md:text-6xl uppercase leading-none">⚡ ADMIN ZONE</h1>
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
      {tab === "points" && <PointsConfigTab />}
      {tab === "gamification" && <GamificationTab />}
      {tab === "announcements" && <AnnouncementsTab />}
      {tab === "teams" && <TeamsTab />}
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

// ─── QUIZ MANAGEMENT ───────────────────────────────────────────────────────
const DEPARTMENTS = ["Engineering", "Design", "Marketing", "HR", "Product", "Management", "General"];

const QuizzesTab = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ department: "General", title: "", questions: [] });

  const load = async () => { const { data } = await api.get("/admin/quizzes"); setQuizzes(data); };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing("new"); setForm({ department: "General", title: "", questions: [] }); };
  const startEdit = (q) => { setEditing(q.id); setForm({ department: q.department, title: q.title, questions: q.questions.map((x) => ({ ...x, options: [...x.options] })) }); };
  const addQuestion = () => setForm((f) => ({ ...f, questions: [...f.questions, { q: "", options: ["", ""], answer: 0 }] }));
  const removeQuestion = (qi) => setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== qi) }));
  const updateQ = (qi, field, val) => setForm((f) => ({ ...f, questions: f.questions.map((q, i) => i === qi ? { ...q, [field]: val } : q) }));
  const updateOption = (qi, oi, val) => setForm((f) => ({ ...f, questions: f.questions.map((q, i) => i !== qi ? q : { ...q, options: q.options.map((o, j) => j === oi ? val : o) }) }));
  const addOption = (qi) => setForm((f) => ({ ...f, questions: f.questions.map((q, i) => i === qi ? { ...q, options: [...q.options, ""] } : q) }));

  const save = async () => {
    if (!form.questions.length) { toast.error("Add at least one question"); return; }
    try {
      if (editing === "new") { await api.post("/admin/quizzes", form); toast.success("🧠 Quiz created!"); }
      else { await api.put(`/admin/quizzes/${editing}`, form); toast.success("✅ Quiz updated!"); }
      setEditing(null); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
  };
  const del = async (id) => { await api.delete(`/admin/quizzes/${id}`); toast("🗑️ Deleted"); load(); };

  return (
    <div className="grid md:grid-cols-2 gap-6" data-testid="quizzes-tab">
      <BrutalCard color="white" hover={false}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-black text-2xl uppercase">🧠 Custom Quizzes</h3>
          <BrutalButton color="yellow" onClick={startNew}>+ NEW</BrutalButton>
        </div>
        <div className="space-y-2">
          {quizzes.map((q) => (
            <div key={q.id} className="border-[3px] border-black p-3 flex items-center justify-between bg-white">
              <div>
                <div className="font-black uppercase text-sm">{q.title}</div>
                <div className="text-xs font-bold">{q.department} · {q.questions?.length || 0} Qs</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(q)} className="bg-brutal-cyan border-[2px] border-black p-1.5"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => del(q.id)} className="bg-brutal-pink border-[2px] border-black p-1.5"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
          {!quizzes.length && <p className="text-sm font-bold uppercase py-4">No custom quizzes. Built-ins still active.</p>}
        </div>
      </BrutalCard>

      {editing !== null ? (
        <BrutalCard color="cyan" hover={false}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-black text-2xl uppercase">{editing === "new" ? "➕ New Quiz" : "✏️ Edit Quiz"}</h3>
            <button onClick={() => setEditing(null)} className="border-[3px] border-black p-1"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2">
            <select className="w-full border-[3px] border-black px-3 py-2 font-bold uppercase" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <BrutalInput placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {form.questions.map((q, qi) => (
                <div key={qi} className="border-[3px] border-black bg-white p-3">
                  <div className="flex gap-2 mb-2">
                    <span className="bg-black text-white font-black text-xs px-2 py-1">Q{qi + 1}</span>
                    <input className="flex-1 border-[2px] border-black px-2 py-1 font-bold text-sm" placeholder="Question" value={q.q} onChange={(e) => updateQ(qi, "q", e.target.value)} />
                    <button onClick={() => removeQuestion(qi)} className="bg-brutal-pink border-[2px] border-black p-1"><X className="w-3 h-3" /></button>
                  </div>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2 mb-1">
                      <input type="radio" name={`ans-${qi}`} checked={q.answer === oi} onChange={() => updateQ(qi, "answer", oi)} className="w-4 h-4 accent-black" />
                      <input className="flex-1 border-[2px] border-black px-2 py-1 text-sm font-bold" placeholder={`Option ${oi + 1}`} value={opt} onChange={(e) => updateOption(qi, oi, e.target.value)} />
                    </div>
                  ))}
                  <button onClick={() => addOption(qi)} className="text-xs font-black uppercase underline">+ option</button>
                </div>
              ))}
            </div>
            <BrutalButton color="yellow" onClick={addQuestion} className="w-full">+ ADD QUESTION</BrutalButton>
            <BrutalButton color="green" onClick={save} className="w-full">💾 SAVE QUIZ</BrutalButton>
          </div>
        </BrutalCard>
      ) : (
        <div className="border-[4px] border-dashed border-black flex items-center justify-center p-12">
          <p className="font-display font-black text-xl uppercase text-center">Select to edit<br /><span className="text-sm">or create a new one</span></p>
        </div>
      )}
    </div>
  );
};

// ─── POINTS CONFIG ─────────────────────────────────────────────────────────
const POINTS_LABELS = {
  water: "💧 Water Break", eye_care: "👀 Eye Care", stand: "🧍 Stand Up", breathing: "🌬️ Breathing",
  mood: "🎭 Mood Log", post: "📸 Fun Wall Post", quiz_per_correct: "🧠 Quiz / correct answer",
  quiz_perfect_bonus: "🏆 Perfect Quiz Bonus", shoutout_sender: "📣 Shoutout (sender)",
  shoutout_receiver: "📣 Shoutout (receiver)", poll_vote: "📊 Poll Vote",
  buddy_checkin: "👬 Buddy Check-in", plant_checkin: "🌱 Plant Check-in",
  bite_tried: "📚 Learning Bite", fact_react: "💡 Fact Reaction",
  game_score_per_10: "🎮 Game pts / 10 score", game_score_max: "🎮 Game pts cap",
};

const PointsConfigTab = () => {
  const [config, setConfig] = useState({});
  useEffect(() => { api.get("/admin/points-config").then(({ data }) => setConfig(data)); }, []);
  const save = async () => { await api.put("/admin/points-config", config); toast.success("⚡ Points config saved!"); };
  return (
    <BrutalCard color="yellow" hover={false} data-testid="points-tab">
      <h3 className="font-display font-black text-2xl uppercase mb-4">⚡ Points Per Activity</h3>
      <div className="grid md:grid-cols-2 gap-2 mb-4">
        {Object.entries(config).map(([key, val]) => (
          <div key={key} className="flex items-center gap-3 border-[3px] border-black bg-white p-3">
            <label className="flex-1 font-bold text-xs uppercase">{POINTS_LABELS[key] || key}</label>
            <input type="number" value={val}
              onChange={(e) => setConfig({ ...config, [key]: +e.target.value })}
              className="w-16 border-[3px] border-black px-2 py-1 font-black text-center" />
          </div>
        ))}
      </div>
      <BrutalButton color="green" onClick={save} data-testid="save-points">💾 SAVE POINTS CONFIG</BrutalButton>
    </BrutalCard>
  );
};

// ─── GAMIFICATION SETTINGS ─────────────────────────────────────────────────
const GamificationTab = () => {
  const [config, setConfig] = useState({ level_threshold: 200, streak_gap_hours: 36, wellness_score_increment: 2 });
  useEffect(() => { api.get("/admin/game-config").then(({ data }) => setConfig(data)); }, []);
  const save = async () => { await api.put("/admin/game-config", config); toast.success("🎮 Gamification saved!"); };
  return (
    <BrutalCard color="green" hover={false} data-testid="gamification-tab">
      <h3 className="font-display font-black text-2xl uppercase mb-4 text-white">🎮 Gamification Settings</h3>
      <div className="space-y-4 max-w-md">
        {[
          { key: "level_threshold", label: "⬆️ Points per Level", desc: "Points needed to advance one level" },
          { key: "streak_gap_hours", label: "🔥 Streak Reset Gap (hrs)", desc: "Inactivity hours before streak resets" },
          { key: "wellness_score_increment", label: "💪 Wellness Score / Activity", desc: "Wellness points added per logged activity" },
        ].map(({ key, label, desc }) => (
          <div key={key} className="border-[3px] border-black bg-white p-4">
            <label className="font-black uppercase text-sm block mb-1">{label}</label>
            <p className="text-xs font-bold text-gray-500 mb-2">{desc}</p>
            <input type="number" value={config[key] ?? ""} onChange={(e) => setConfig({ ...config, [key]: +e.target.value })}
              className="w-full border-[3px] border-black px-3 py-2 font-black text-2xl" />
          </div>
        ))}
        <BrutalButton color="yellow" onClick={save} data-testid="save-gamification">💾 SAVE SETTINGS</BrutalButton>
      </div>
    </BrutalCard>
  );
};

// ─── ANNOUNCEMENTS (PUSH NOTIFICATIONS) ────────────────────────────────────
const KIND_STYLES = { info: "bg-brutal-cyan", alert: "bg-brutal-pink", party: "bg-brutal-yellow" };

const AnnouncementsTab = () => {
  const [form, setForm] = useState({ title: "", message: "", kind: "info", target: "all", target_user_ids: [] });
  const [users, setUsers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  const load = async () => {
    const [u, a] = await Promise.all([api.get("/admin/users"), api.get("/admin/announcements")]);
    setUsers(u.data); setAnnouncements(a.data);
  };
  useEffect(() => { load(); }, []);

  const send = async () => {
    if (!form.title || !form.message) { toast.error("Title + message required"); return; }
    if (form.target === "specific" && !form.target_user_ids.length) { toast.error("Pick at least one user"); return; }
    await api.post("/admin/announcements", form);
    toast.success("📣 Announcement sent!");
    setForm({ title: "", message: "", kind: "info", target: "all", target_user_ids: [] });
    load();
  };

  const toggleUser = (uid) => {
    const ids = form.target_user_ids.includes(uid)
      ? form.target_user_ids.filter((id) => id !== uid)
      : [...form.target_user_ids, uid];
    setForm({ ...form, target_user_ids: ids });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6" data-testid="announcements-tab">
      <BrutalCard color="pink" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3 text-white">📣 Send Announcement</h3>
        <div className="space-y-3">
          <BrutalInput data-testid="ann-title" placeholder="Headline" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea
            data-testid="ann-message" rows={3} placeholder="Your message here..."
            value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full border-[3px] border-black px-3 py-2 font-bold resize-none"
          />
          <div>
            <p className="font-black uppercase text-xs text-white mb-1">Type</p>
            <div className="flex gap-2">
              {[["info", "ℹ️ Info"], ["alert", "⚠️ Alert"], ["party", "🎉 Party"]].map(([k, lbl]) => (
                <button key={k} onClick={() => setForm({ ...form, kind: k })}
                  className={`border-[3px] border-black px-3 py-1 font-black text-xs uppercase ${form.kind === k ? "bg-black text-white" : "bg-white"}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-black uppercase text-xs text-white mb-1">Recipients</p>
            <div className="flex gap-2">
              {[["all", "🌍 All Users"], ["specific", "🎯 Specific"]].map(([t, lbl]) => (
                <button key={t} onClick={() => setForm({ ...form, target: t, target_user_ids: [] })}
                  className={`border-[3px] border-black px-3 py-1 font-black text-xs uppercase ${form.target === t ? "bg-black text-white" : "bg-white"}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {form.target === "specific" && (
            <div className="border-[3px] border-black bg-white p-2 max-h-48 overflow-y-auto space-y-1">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-brutal-yellow">
                  <input type="checkbox" checked={form.target_user_ids.includes(u.id)} onChange={() => toggleUser(u.id)} className="w-4 h-4 border-[2px] border-black" />
                  <img src={u.avatar} className="w-6 h-6 border border-black" alt="" />
                  <span className="font-bold text-sm">{u.name}</span>
                  <span className="text-xs text-gray-500 font-bold">{u.department}</span>
                </label>
              ))}
            </div>
          )}
          <BrutalButton data-testid="ann-send" color="green" onClick={send} className="w-full">🚀 SEND NOW</BrutalButton>
        </div>
      </BrutalCard>

      <BrutalCard color="white" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">📬 Sent ({announcements.length})</h3>
        <div className="space-y-2 max-h-[520px] overflow-y-auto">
          {announcements.map((a) => (
            <div key={a.id} className={`border-[3px] border-black p-3 ${KIND_STYLES[a.kind] || "bg-white"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-black text-sm uppercase">{a.title}</span>
                <span className="text-xs font-bold ml-auto">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm font-medium">{a.message}</p>
              <p className="text-xs font-bold mt-1">→ {a.recipients.length} recipients · {a.read_by?.length || 0} read</p>
            </div>
          ))}
          {!announcements.length && <p className="text-sm font-bold uppercase">Nothing sent yet.</p>}
        </div>
      </BrutalCard>
    </div>
  );
};

// ─── TEAM MANAGEMENT ───────────────────────────────────────────────────────
const TEAM_COLORS = ["yellow", "cyan", "pink", "green"];
const TEAM_BG = { yellow: "bg-brutal-yellow", cyan: "bg-brutal-cyan", pink: "bg-brutal-pink", green: "bg-brutal-green" };

const TeamsTab = () => {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [pointsLog, setPointsLog] = useState([]);
  const [newTeam, setNewTeam] = useState({ name: "", color: "yellow" });
  const [shuffle, setShuffle] = useState({ num_teams: 4, name_prefix: "Squad" });
  const [pointForm, setPointForm] = useState({ user_id: "", team_id: "", points: 10, reason: "" });
  const [editMembers, setEditMembers] = useState({ teamId: null, selected: [] });

  const load = async () => {
    const [t, u, l] = await Promise.all([api.get("/admin/game-teams"), api.get("/admin/users"), api.get("/admin/points/log")]);
    setTeams(t.data); setUsers(u.data); setPointsLog(l.data.slice(0, 20));
  };
  useEffect(() => { load(); }, []);

  const createTeam = async () => {
    if (!newTeam.name) { toast.error("Name required"); return; }
    await api.post("/admin/game-teams", newTeam);
    toast.success("✅ Team created");
    setNewTeam({ name: "", color: "yellow" }); load();
  };

  const doShuffle = async () => {
    if (!window.confirm(`Shuffle all users into ${shuffle.num_teams} teams? Existing auto-shuffled teams will be replaced.`)) return;
    await api.post("/admin/game-teams/shuffle", shuffle);
    toast.success(`🔀 Shuffled into ${shuffle.num_teams} teams`); load();
  };

  const delTeam = async (id) => { await api.delete(`/admin/game-teams/${id}`); load(); };

  const openMembers = (team) => setEditMembers({ teamId: team.id, selected: [...(team.members || [])] });
  const saveMembers = async () => {
    await api.put(`/admin/game-teams/${editMembers.teamId}/members`, { user_ids: editMembers.selected });
    toast.success("✅ Members updated");
    setEditMembers({ teamId: null, selected: [] }); load();
  };

  const awardPoints = async () => {
    if (!pointForm.points || !pointForm.reason) { toast.error("Points + reason required"); return; }
    if (!pointForm.user_id && !pointForm.team_id) { toast.error("Pick a user or team"); return; }
    await api.post("/admin/points/award", pointForm);
    toast.success(`⚡ +${pointForm.points} awarded!`);
    setPointForm({ user_id: "", team_id: "", points: 10, reason: "" }); load();
  };

  return (
    <div className="space-y-6" data-testid="teams-tab">
      <div className="grid md:grid-cols-2 gap-6">
        <BrutalCard color="yellow" hover={false}>
          <h3 className="font-display font-black text-xl uppercase mb-3">➕ Create Team</h3>
          <div className="space-y-3">
            <BrutalInput data-testid="team-name" placeholder="Team name" value={newTeam.name} onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })} />
            <div className="flex gap-2">
              {TEAM_COLORS.map((c) => (
                <button key={c} onClick={() => setNewTeam({ ...newTeam, color: c })}
                  className={`w-10 h-10 ${TEAM_BG[c]} border-[3px] ${newTeam.color === c ? "border-black shadow-brutal-sm" : "border-transparent"}`} />
              ))}
            </div>
            <BrutalButton data-testid="team-create" color="green" onClick={createTeam} className="w-full">CREATE TEAM</BrutalButton>
          </div>
        </BrutalCard>

        <BrutalCard color="cyan" hover={false}>
          <h3 className="font-display font-black text-xl uppercase mb-3">🔀 Auto Shuffle</h3>
          <div className="space-y-3">
            <div>
              <label className="font-bold uppercase text-xs block mb-1">Number of Teams</label>
              <BrutalInput type="number" min="2" max="8" value={shuffle.num_teams} onChange={(e) => setShuffle({ ...shuffle, num_teams: +e.target.value })} />
            </div>
            <div>
              <label className="font-bold uppercase text-xs block mb-1">Name Prefix</label>
              <BrutalInput placeholder="Squad" value={shuffle.name_prefix} onChange={(e) => setShuffle({ ...shuffle, name_prefix: e.target.value })} />
            </div>
            <BrutalButton data-testid="team-shuffle" color="pink" onClick={doShuffle} className="w-full">🔀 SHUFFLE & ASSIGN</BrutalButton>
          </div>
        </BrutalCard>
      </div>

      <BrutalCard color="white" hover={false}>
        <h3 className="font-display font-black text-2xl uppercase mb-3">🏴 Teams ({teams.length})</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {teams.map((t) => (
            <div key={t.id} className={`border-[4px] border-black p-4 shadow-brutal-sm ${TEAM_BG[t.color] || "bg-white"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-display font-black text-lg uppercase truncate">{t.name}</span>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openMembers(t)} className="bg-white border-[2px] border-black p-1"><Users className="w-3 h-3" /></button>
                  <button onClick={() => delTeam(t.id)} className="bg-brutal-pink border-[2px] border-black p-1"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="font-black text-2xl">⚡ {t.team_points || 0}</div>
              <div className="text-xs font-bold uppercase mb-2">{(t.member_details || []).length} members</div>
              <div className="flex flex-wrap gap-1">
                {(t.member_details || []).slice(0, 4).map((m) => (
                  <img key={m.id} src={m.avatar} className="w-6 h-6 border-[2px] border-black" title={m.name} alt="" />
                ))}
                {(t.member_details || []).length > 4 && (
                  <div className="w-6 h-6 border-[2px] border-black bg-black text-white text-[10px] font-black flex items-center justify-center">
                    +{(t.member_details || []).length - 4}
                  </div>
                )}
              </div>
            </div>
          ))}
          {!teams.length && <p className="col-span-3 text-sm font-bold uppercase text-center py-6">No teams yet. Create one or shuffle!</p>}
        </div>
      </BrutalCard>

      {editMembers.teamId && (
        <BrutalCard color="yellow" hover={false}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-black text-xl uppercase">👥 Assign — {teams.find((t) => t.id === editMembers.teamId)?.name}</h3>
            <button onClick={() => setEditMembers({ teamId: null, selected: [] })} className="border-[3px] border-black p-1"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 max-h-64 overflow-y-auto">
            {users.map((u) => {
              const sel = editMembers.selected.includes(u.id);
              return (
                <label key={u.id} className={`flex items-center gap-2 cursor-pointer border-[3px] border-black p-2 ${sel ? "bg-black text-white" : "bg-white"}`}>
                  <input type="checkbox" checked={sel}
                    onChange={() => setEditMembers((prev) => ({ ...prev, selected: sel ? prev.selected.filter((id) => id !== u.id) : [...prev.selected, u.id] }))}
                    className="hidden" />
                  <img src={u.avatar} className="w-6 h-6 border border-black flex-shrink-0" alt="" />
                  <span className="font-bold text-xs uppercase truncate">{u.name}</span>
                </label>
              );
            })}
          </div>
          <BrutalButton color="green" onClick={saveMembers}>💾 SAVE MEMBERS ({editMembers.selected.length})</BrutalButton>
        </BrutalCard>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <BrutalCard color="green" hover={false}>
          <h3 className="font-display font-black text-xl uppercase mb-3 text-white">⚡ Award Points</h3>
          <div className="space-y-3">
            <div>
              <label className="font-black uppercase text-xs text-white block mb-1">User</label>
              <select data-testid="award-user" value={pointForm.user_id}
                onChange={(e) => setPointForm({ ...pointForm, user_id: e.target.value, team_id: "" })}
                className="w-full border-[3px] border-black px-3 py-2 font-bold uppercase bg-white">
                <option value="">— no user —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.department}</option>)}
              </select>
            </div>
            <div>
              <label className="font-black uppercase text-xs text-white block mb-1">Team</label>
              <select data-testid="award-team" value={pointForm.team_id}
                onChange={(e) => setPointForm({ ...pointForm, team_id: e.target.value, user_id: "" })}
                className="w-full border-[3px] border-black px-3 py-2 font-bold uppercase bg-white">
                <option value="">— no team —</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <BrutalInput data-testid="award-points-input" type="number" placeholder="Points" value={pointForm.points} onChange={(e) => setPointForm({ ...pointForm, points: +e.target.value })} />
            <BrutalInput data-testid="award-reason" placeholder="Reason (e.g. won the hackathon)" value={pointForm.reason} onChange={(e) => setPointForm({ ...pointForm, reason: e.target.value })} />
            <BrutalButton data-testid="award-submit" color="yellow" onClick={awardPoints} className="w-full">⚡ AWARD POINTS</BrutalButton>
          </div>
        </BrutalCard>

        <BrutalCard color="white" hover={false}>
          <h3 className="font-display font-black text-xl uppercase mb-3">📋 Points Log</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {pointsLog.map((l) => (
              <div key={l.id} className="border-[3px] border-black p-2 bg-white">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-brutal-yellow border-[2px] border-black px-2 py-0.5 font-black text-xs">+{l.points}</span>
                  <span className="font-bold text-sm">{l.user_id ? "User" : "Team"}</span>
                  <span className="text-xs font-bold ml-auto">{new Date(l.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs font-medium mt-1">{l.reason}</p>
                <p className="text-[10px] font-bold text-gray-500">by {l.issued_by}</p>
              </div>
            ))}
            {!pointsLog.length && <p className="text-sm font-bold uppercase">No points awarded yet.</p>}
          </div>
        </BrutalCard>
      </div>
    </div>
  );
};
