import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { BrutalButton, BrutalCard, BrutalInput } from "../components/brutal";
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
      toast.success("🎉 Welcome to chaos");
      nav("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Signup failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen brutal-dots flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="mb-6 bg-brutal-pink text-white border-[4px] border-black shadow-brutal-lg p-5 inline-block -rotate-2">
          <h1 className="font-display font-black text-4xl uppercase leading-none">JOIN THE CHAOS</h1>
          <p className="text-xs mt-2 uppercase tracking-widest">👀 wellness but make it spicy</p>
        </div>

        <BrutalCard color="white" tilt={-1}>
          <h2 className="font-display font-black text-3xl uppercase mb-4">Make Account</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="font-bold uppercase text-xs tracking-wider block mb-1">Name</label>
              <BrutalInput data-testid="signup-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="font-bold uppercase text-xs tracking-wider block mb-1">Email</label>
              <BrutalInput data-testid="signup-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="font-bold uppercase text-xs tracking-wider block mb-1">Password</label>
              <BrutalInput data-testid="signup-password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="font-bold uppercase text-xs tracking-wider block mb-1">Department</label>
              <BrutalInput data-testid="signup-dept" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <BrutalButton data-testid="signup-submit" type="submit" color="green" size="lg" className="w-full" disabled={loading}>
              {loading ? "..." : "LET'S GO →"}
            </BrutalButton>
          </form>
          <p className="text-center mt-4 text-sm font-semibold">
            Got one? <Link className="underline font-black uppercase" to="/login" data-testid="link-login">Sign in</Link>
          </p>
        </BrutalCard>
      </div>
    </div>
  );
}
