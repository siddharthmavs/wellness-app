import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BrutalButton, BrutalCard, BrutalInput } from "../components/brutal";
import { useAuthStore } from "../store";
import { api } from "../lib/api";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("alex@demo.com");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAuth(data.token, data.user);
      toast.success("🔥 Locked in");
      nav("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen brutal-dots flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <motion.div
          initial={{ y: -30, opacity: 0, rotate: -3 }}
          animate={{ y: 0, opacity: 1, rotate: -2 }}
          className="mb-6 bg-black text-brutal-yellow border-[4px] border-black shadow-brutal-lg p-5 inline-block"
        >
          <h1 className="font-display font-black text-4xl uppercase leading-none">
            BRUTAL<br/>WELLNESS
          </h1>
          <p className="text-xs mt-2 uppercase tracking-widest">👊 Get in loser, we're lifting</p>
        </motion.div>

        <BrutalCard color="white" tilt={1}>
          <h2 className="font-display font-black text-3xl uppercase mb-4">Enter the Zone</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="font-bold uppercase text-xs tracking-wider block mb-1">Email</label>
              <BrutalInput
                data-testid="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="font-bold uppercase text-xs tracking-wider block mb-1">Password</label>
              <BrutalInput
                data-testid="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <BrutalButton data-testid="login-submit" type="submit" color="yellow" size="lg" className="w-full" disabled={loading}>
              {loading ? "LOADING..." : "ENTER THE ZONE →"}
            </BrutalButton>
          </form>
          <p className="text-center mt-4 text-sm font-semibold">
            New here? <Link className="underline font-black uppercase" to="/signup" data-testid="link-signup">Make an account</Link>
          </p>
          <div className="mt-4 bg-brutal-cyan border-[3px] border-black p-3 text-xs font-bold">
            🧪 DEMO: alex@demo.com / demo1234
          </div>
        </BrutalCard>
      </div>
    </div>
  );
}
