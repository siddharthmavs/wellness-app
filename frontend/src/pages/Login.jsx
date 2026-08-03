import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BrutalButton, BrutalInput } from "../components/brutal";
import { CompanionMascot } from "../components/CompanionMascot";
import { IconCloud, IconLeaf, IconSparkle } from "../components/HandDrawn";
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
 toast.success("Welcome back ");
 nav("/");
 } catch (err) {
 toast.error(err.response?.data?.detail || "Login failed");
 } finally { setLoading(false); }
 };

 return (
 <div
 className="min-h-screen flex items-center justify-center p-6 paper-grain relative overflow-hidden"
 style={{ background: "transparent" }}
 >
 {/* Cozy background illustrations */}
 <div className="absolute top-8 left-8 opacity-40 floaty-1 pointer-events-none"><IconCloud size={72} /></div>
 <div className="absolute top-20 right-16 opacity-40 floaty-2 pointer-events-none"><IconLeaf size={56} /></div>
 <div className="absolute bottom-16 left-20 opacity-40 floaty-3 pointer-events-none"><IconLeaf size={64} /></div>
 <div className="absolute bottom-24 right-8 opacity-35 floaty-1 pointer-events-none"><IconSparkle size={64} /></div>

 <div className="max-w-5xl w-full grid md:grid-cols-2 gap-8 items-center relative z-10">
 {/* Left: cozy room illustration */}
 <motion.div
 initial={{ opacity: 0, x: -20 }}
 animate={{ opacity: 1, x: 0 }}
 transition={{ duration: 0.6 }}
 className="hidden md:flex flex-col items-center text-center"
 >
 <div className="relative">
 <CompanionMascot state="happy" size={220} />
 <div className="absolute -top-4 -right-4 floaty-2 pointer-events-none"><IconSparkle size={48} /></div>
 </div>
 <h1 className="font-display text-4xl mt-4" style={{ color: "var(--cozy-primary-dark)" }}>
 A little corner of calm
 </h1>
 <p className="font-hand text-lg mt-2" style={{ color: "var(--cozy-muted)" }}>
 your daily ritual for wellbeing
 </p>
 <div className="flex gap-4 mt-6 text-cozy-muted text-sm">
 <span> Grow habits</span>
 <span> Meet companion</span>
 <span> Community</span>
 </div>
 </motion.div>

 {/* Right: login card */}
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.5, delay: 0.1 }}
 className="bg-cozy-surface shadow-cozy-lg p-8 md:p-10"
 style={{ borderRadius: 32, border: "1px solid var(--cozy-border)" }}
 >
 <h2 className="font-display text-3xl mb-1" style={{ color: "var(--cozy-text)" }}>
 Welcome back
 </h2>
 <p className="text-sm mb-6" style={{ color: "var(--cozy-muted)" }}>
 Sign in to continue your journey
 </p>
 <form onSubmit={submit} className="space-y-4">
 <div>
 <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cozy-muted)" }}>
 Email
 </label>
 <BrutalInput
 data-testid="login-email"
 type="email"
 required
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 placeholder="you@example.com"
 />
 </div>
 <div>
 <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--cozy-muted)" }}>
 Password
 </label>
 <BrutalInput
 data-testid="login-password"
 type="password"
 required
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 placeholder="••••••••"
 />
 </div>
 <BrutalButton data-testid="login-submit" type="submit" color="primary" size="lg" className="w-full" disabled={loading}>
 {loading ? "One sec..." : "Enter garden "}
 </BrutalButton>
 </form>
 <p className="text-center mt-5 text-sm" style={{ color: "var(--cozy-muted)" }}>
 New here? <Link className="font-semibold text-cozy-primary-dark underline" to="/signup" data-testid="link-signup">Create an account</Link>
 </p>
 <div className="mt-4 p-3 text-xs font-medium" style={{ background: "var(--cozy-bg)", borderRadius: 16, color: "var(--cozy-muted)" }}>
 Try demo: <b>alex@demo.com</b> / demo1234 · <b>admin@demo.com</b> / demo1234
 </div>
 </motion.div>
 </div>
 </div>
 );
}
