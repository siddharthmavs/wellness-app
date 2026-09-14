import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { BrutalButton, BrutalInput } from "../components/brutal";
import { CompanionMascot } from "../components/CompanionMascot";
import { IconLeaf, IconSparkle } from "../components/HandDrawn";
import { useAuthStore } from "../store";
import { api } from "../lib/api";
import { toast } from "sonner";

export default function AcceptInvite() {
 const { token } = useParams();
 const nav = useNavigate();
 const setAuth = useAuthStore((s) => s.setAuth);

 const [preview, setPreview] = useState(null);
 const [error, setError] = useState("");
 const [loadingPreview, setLoadingPreview] = useState(true);
 const [form, setForm] = useState({ name: "", password: "" });
 const [submitting, setSubmitting] = useState(false);

 useEffect(() => {
 let cancelled = false;
 api.get(`/invitations/${token}`)
 .then(({ data }) => {
 if (cancelled) return;
 setPreview(data);
 setForm((f) => ({ ...f, name: data.name || "" }));
 })
 .catch((err) => {
 if (cancelled) return;
 setError(err.response?.data?.detail || "This invitation link is invalid or has expired.");
 })
 .finally(() => !cancelled && setLoadingPreview(false));
 return () => { cancelled = true; };
 }, [token]);

 const submit = async (e) => {
 e.preventDefault();
 setSubmitting(true);
 try {
 const { data } = await api.post("/auth/accept-invite", { token, ...form });
 setAuth(data.token, data.user);
 toast.success("Welcome to the garden ");
 nav("/");
 } catch (err) {
 toast.error(err.response?.data?.detail || "Could not accept invitation");
 } finally { setSubmitting(false); }
 };

 return (
 <div className="min-h-screen flex items-center justify-center p-6 paper-grain relative overflow-hidden"
 style={{ background: "transparent" }}>
 <div className="absolute top-8 left-8 opacity-40 floaty-1 pointer-events-none"><IconSparkle size={56} /></div>
 <div className="absolute bottom-16 right-14 opacity-40 floaty-2 pointer-events-none"><IconLeaf size={72} /></div>

 <div className="max-w-md w-full relative z-10">
 <div className="text-center mb-6">
 <div className="flex justify-center"><CompanionMascot state="idle" size={140} /></div>
 <h1 className="font-display text-4xl mt-2" style={{ color: "var(--cozy-primary-dark)" }}>
 {preview?.org_name ? `Join ${preview.org_name}` : "You're invited"}
 </h1>
 <p className="font-hand text-lg mt-1" style={{ color: "var(--cozy-muted)" }}>
 set your password to finish joining
 </p>
 </div>

 <div className="bg-cozy-surface shadow-cozy-lg p-8" style={{ borderRadius: 28, border: "1px solid var(--cozy-border)" }}>
 {loadingPreview ? (
 <p className="text-center text-sm" style={{ color: "var(--cozy-muted)" }}>Checking your invitation...</p>
 ) : error ? (
 <div className="text-center space-y-4">
 <p className="text-sm font-semibold" style={{ color: "var(--cozy-danger, #d9534f)" }}>{error}</p>
 <p className="text-sm" style={{ color: "var(--cozy-muted)" }}>
 Ask your admin to resend the invitation, or <Link className="font-semibold text-cozy-primary-dark underline" to="/login">sign in</Link> if you already have an account.
 </p>
 </div>
 ) : (
 <form onSubmit={submit} className="space-y-4">
 <div>
 <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cozy-muted)" }}>Work email</label>
 <BrutalInput value={preview?.email || ""} disabled />
 </div>
 <div>
 <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cozy-muted)" }}>Your name</label>
 <BrutalInput data-testid="invite-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="What can we call you?" />
 </div>
 <div>
 <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cozy-muted)" }}>Create a password</label>
 <BrutalInput data-testid="invite-password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" />
 </div>
 <BrutalButton data-testid="invite-submit" type="submit" color="primary" size="lg" className="w-full" disabled={submitting}>
 {submitting ? "One sec..." : "Join the garden "}
 </BrutalButton>
 </form>
 )}
 <p className="text-center mt-5 text-sm" style={{ color: "var(--cozy-muted)" }}>
 Already have an account? <Link className="font-semibold text-cozy-primary-dark underline" to="/login">Sign in</Link>
 </p>
 </div>
 </div>
 </div>
 );
}
