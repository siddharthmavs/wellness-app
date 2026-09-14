import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store";
import { api, resolveAvatar } from "../lib/api";
import { BrutalCard, BrutalBadge, BrutalButton, BrutalInput, BrutalTag } from "../components/brutal";
import { BuddyCard, PlantCard } from "../components/BuddyAndPlant";
import { RewardsSection } from "../components/RewardsSection";
import { toast } from "sonner";

const FB_CATEGORIES = ["Wellness", "Social", "Technical", "General"];

const emptyEditForm = (user) => ({
 first_name: user.first_name || "",
 last_name: user.last_name || "",
 job_title: user.job_title || "",
 department: user.department || "",
 birthday: user.birthday || "",
 work_anniversary: user.work_anniversary || "",
 bio: user.bio || "",
});

export default function Profile() {
 const { user, setUser } = useAuthStore();
 const [badges, setBadges] = useState([]);
 const [activities, setActivities] = useState([]);
 const [fb, setFb] = useState({ category: "Wellness", message: "", anonymous: false });
 const [editing, setEditing] = useState(false);
 const [editForm, setEditForm] = useState(null);
 const [saving, setSaving] = useState(false);
 const [uploadingAvatar, setUploadingAvatar] = useState(false);
 const avatarInputRef = useRef(null);

 useEffect(() => {
 api.get("/badges").then(({ data }) => setBadges(data));
 api.get("/activities/me").then(({ data }) => setActivities(data));
 }, []);

 if (!user) return null;
 const progress = ((user.points % 200) / 200) * 100;

 const toggleDnd = async () => {
 const { data } = await api.patch("/users/me", { dnd: !user.dnd });
 setUser(data);
 toast.success(data.dnd ? " DND ON — silence, fool" : " DND OFF — back in chaos");
 };

 const startEditing = () => {
 setEditForm(emptyEditForm(user));
 setEditing(true);
 };

 const saveProfile = async () => {
 setSaving(true);
 try {
 const payload = { ...editForm };
 if (!payload.birthday) delete payload.birthday;
 if (!payload.work_anniversary) delete payload.work_anniversary;
 const { data } = await api.patch("/users/me", payload);
 setUser(data);
 setEditing(false);
 toast.success("Profile updated");
 } catch (err) {
 toast.error(err.response?.data?.detail || "Could not save profile");
 } finally {
 setSaving(false);
 }
 };

 const onAvatarChosen = async (e) => {
 const file = e.target.files?.[0];
 e.target.value = "";
 if (!file) return;
 if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
 setUploadingAvatar(true);
 try {
 const fd = new FormData();
 fd.append("file", file);
 const { data } = await api.post("/users/me/avatar", fd, {
 headers: { "Content-Type": "multipart/form-data" },
 });
 setUser({ ...user, avatar: data.avatar });
 toast.success("Profile picture updated");
 } catch (err) {
 toast.error(err.response?.data?.detail || "Upload failed");
 } finally {
 setUploadingAvatar(false);
 }
 };

 const sendFeedback = async () => {
 if (!fb.message.trim()) { toast.error("Say something."); return; }
 await api.post("/feedback", fb);
 setFb({ category: "Wellness", message: "", anonymous: false });
 toast.success(" Feedback fired");
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
 <button
 type="button"
 data-testid="avatar-upload-trigger"
 onClick={() => avatarInputRef.current?.click()}
 disabled={uploadingAvatar}
 className="relative mx-auto block w-28 h-28 mb-3"
 title="Change profile picture"
 >
 <img src={resolveAvatar(user.avatar)} alt={user.name} className="w-28 h-28 border-[4px] border-black bg-white" />
 <span className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/40 text-white text-[10px] font-black uppercase opacity-0 hover:opacity-100 transition">
 {uploadingAvatar ? "..." : "Change"}
 </span>
 </button>
 <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChosen} data-testid="avatar-file-input" />
 <h2 className="font-display font-black text-3xl uppercase leading-none">{user.name}</h2>
 <p className="text-xs uppercase font-bold mt-1">{user.job_title ? `${user.job_title} · ` : ""}{user.department}</p>
 <div className="mt-2">
 <span className={`${ROLE_COLORS[user.role || "employee"]} border-[3px] border-black px-3 py-1 font-black text-xs uppercase shadow-brutal-sm inline-block`} data-testid="role-badge">
 {user.role === "admin" ? " ADMIN" : user.role === "team_lead" ? " TEAM LEAD" : " EMPLOYEE"}
 </span>
 </div>
 <div className="flex gap-2 justify-center mt-3 flex-wrap">
 <BrutalBadge color="pink"> {user.streak} streak</BrutalBadge>
 <BrutalBadge color="green"> {user.points} pts</BrutalBadge>
 </div>
 <button
 data-testid="dnd-toggle"
 onClick={toggleDnd}
 className={`mt-4 w-full border-[3px] border-black px-3 py-2 font-black uppercase text-xs shadow-brutal-sm ${user.dnd ? "bg-black text-white" : "bg-white"}`}
 >
 {user.dnd ? " DND IS ON" : " DND IS OFF"}
 </button>
 <button
 data-testid="edit-profile-toggle"
 onClick={startEditing}
 className="mt-2 w-full border-[3px] border-black bg-white px-3 py-2 font-black uppercase text-xs shadow-brutal-sm"
 >
 Edit Profile
 </button>
 </motion.div>

 <div className="md:col-span-2 bg-white border-[4px] border-black shadow-brutal-lg p-6 rounded-[4px]">
 <h3 className="font-display font-black text-2xl uppercase mb-3"> Level {user.level}</h3>
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

 {editing && editForm && (
 <BrutalCard color="white" hover={false} className="mb-8" data-testid="edit-profile-card">
 <h2 className="font-display font-black text-2xl uppercase mb-4"> Edit Profile</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
 <div>
 <label className="font-black uppercase text-[10px] block mb-1">First Name</label>
 <BrutalInput value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
 </div>
 <div>
 <label className="font-black uppercase text-[10px] block mb-1">Last Name</label>
 <BrutalInput value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
 </div>
 <div>
 <label className="font-black uppercase text-[10px] block mb-1">Job Title</label>
 <BrutalInput value={editForm.job_title} onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })} placeholder="e.g. Software Engineer" />
 </div>
 <div>
 <label className="font-black uppercase text-[10px] block mb-1">Department</label>
 <BrutalInput value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
 </div>
 <div>
 <label className="font-black uppercase text-[10px] block mb-1">Birthday</label>
 <BrutalInput type="date" value={editForm.birthday} onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })} />
 </div>
 <div>
 <label className="font-black uppercase text-[10px] block mb-1">Work Anniversary</label>
 <BrutalInput type="date" value={editForm.work_anniversary} onChange={(e) => setEditForm({ ...editForm, work_anniversary: e.target.value })} />
 </div>
 </div>
 <div className="mb-4">
 <label className="font-black uppercase text-[10px] block mb-1">Bio</label>
 <textarea
 value={editForm.bio}
 onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
 rows={3}
 className="w-full border-[3px] border-black px-4 py-3 font-medium resize-none"
 placeholder="A little about you..."
 />
 </div>
 <div className="flex gap-3">
 <BrutalButton data-testid="save-profile" color="green" onClick={saveProfile} disabled={saving}>{saving ? "SAVING..." : "SAVE"}</BrutalButton>
 <button onClick={() => setEditing(false)} className="border-[3px] border-black bg-white px-4 py-2 font-black uppercase text-xs shadow-brutal-sm">Cancel</button>
 </div>
 </BrutalCard>
 )}

 <RewardsSection />

 <h2 className="font-display font-black text-3xl uppercase mb-4"> Connections</h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
 <BuddyCard />
 <PlantCard />
 </div>

 <h2 className="font-display font-black text-3xl uppercase mb-4"> Badges</h2>
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
 <h2 className="font-display font-black text-2xl uppercase mb-3"> Drop Feedback</h2>
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
 Send anonymously
 </label>
 <BrutalButton data-testid="feedback-submit" color="green" onClick={sendFeedback}> SEND</BrutalButton>
 </BrutalCard>

 <h2 className="font-display font-black text-2xl uppercase mb-3"> Recent Activity</h2>
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
