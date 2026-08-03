import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BrutalButton, BrutalInput } from "../components/brutal";
import { CompanionMascot } from "../components/CompanionMascot";
import { useAuthStore } from "../store";
import { api } from "../lib/api";
import { toast } from "sonner";

export default function Signup() {
  const [form, setForm] = useState({ name: "", email: "", password: "", department: "Engineering" });
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setAuth(data.token, data.user);
      toast.success("Welcome to the garden 🌱");
      nav("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Signup failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 paper-grain relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #EEF5E8 0%, #F0EBE0 100%)" }}>
      <div className="absolute top-8 left-8 text-5xl opacity-30 floaty-1">🌸</div>
      <div className="absolute bottom-16 right-14 text-6xl opacity-30 floaty-2">🍃</div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-6">
          <div className="flex justify-center"><CompanionMascot state="idle" size={140} /></div>
          <h1 className="font-display text-4xl mt-2" style={{ color: "var(--cozy-primary-dark)" }}>Start your journey</h1>
          <p className="font-hand text-lg mt-1" style={{ color: "var(--cozy-muted)" }}>your wellness companion awaits</p>
        </div>

        <div className="bg-cozy-surface shadow-cozy-lg p-8" style={{ borderRadius: 28, border: "1px solid var(--cozy-border)" }}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cozy-muted)" }}>Name</label>
              <BrutalInput data-testid="signup-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="What can we call you?" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cozy-muted)" }}>Email</label>
              <BrutalInput data-testid="signup-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cozy-muted)" }}>Password</label>
              <BrutalInput data-testid="signup-password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cozy-muted)" }}>Team</label>
              <BrutalInput data-testid="signup-dept" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <BrutalButton data-testid="signup-submit" type="submit" color="primary" size="lg" className="w-full" disabled={loading}>
              {loading ? "One sec..." : "Plant your seed 🌱"}
            </BrutalButton>
          </form>
          <p className="text-center mt-5 text-sm" style={{ color: "var(--cozy-muted)" }}>
            Already have an account? <Link className="font-semibold text-cozy-primary-dark underline" to="/login" data-testid="link-login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
