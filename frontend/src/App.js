import React, { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuthStore, useThemeStore } from "./store";
import { api } from "./lib/api";
import { Navbar } from "./components/Navbar";
import { BottomNav } from "./components/BottomNav";
import { InkDefs } from "./components/HandDrawn";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";
import Mood from "./pages/Mood";
import FunWall from "./pages/FunWall";
import Profile from "./pages/Profile";
import Shoutouts from "./pages/Shoutouts";
import HelpBoard from "./pages/HelpBoard";
import AdminDashboard from "./pages/AdminDashboard";
import Music from "./pages/Music";
import Polls from "./pages/Polls";
import Games from "./pages/Games";
import Quiz from "./pages/Quiz";
import Learn from "./pages/Learn";
import Events from "./pages/Events";
import GameTeams from "./pages/GameTeams";

const PrivateLayout = ({ children, adminOnly = false }) => {
 const { token, user } = useAuthStore();
 if (!token) return <Navigate to="/login" replace />;
 if (adminOnly && user?.role !== "admin") return <Navigate to="/" replace />;
 return (
 <div className="min-h-screen bg-white paper-grain relative">
 <Navbar />
 <div className="relative z-10">{children}</div>
 <BottomNav />
 </div>
 );
};

function App() {
 const { token, setUser } = useAuthStore();
 const applyTheme = useThemeStore((s) => s.apply);
 useEffect(() => { applyTheme(); }, [applyTheme]);
 useEffect(() => {
 if (token) api.get("/auth/me").then(({ data }) => setUser(data)).catch(() => {});
 }, [token, setUser]);

 return (
 <div className="App">
 <BrowserRouter>
 <Toaster
 position="top-right"
 toastOptions={{
 className: "!bg-white !border-[3px] !border-black !shadow-brutal !rounded-[2px] !font-black !uppercase !text-sm",
 }}
 />
 <Routes>
 <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
 <Route path="/signup" element={token ? <Navigate to="/" replace /> : <Signup />} />
 <Route path="/" element={<PrivateLayout><Dashboard /></PrivateLayout>} />
 <Route path="/leaderboard" element={<PrivateLayout><Leaderboard /></PrivateLayout>} />
 <Route path="/mood" element={<PrivateLayout><Mood /></PrivateLayout>} />
 <Route path="/funwall" element={<PrivateLayout><FunWall /></PrivateLayout>} />
 <Route path="/shoutouts" element={<PrivateLayout><Shoutouts /></PrivateLayout>} />
 <Route path="/help" element={<PrivateLayout><HelpBoard /></PrivateLayout>} />
 <Route path="/music" element={<PrivateLayout><Music /></PrivateLayout>} />
 <Route path="/polls" element={<PrivateLayout><Polls /></PrivateLayout>} />
 <Route path="/games" element={<PrivateLayout><Games /></PrivateLayout>} />
 <Route path="/quiz" element={<PrivateLayout><Quiz /></PrivateLayout>} />
 <Route path="/learn" element={<PrivateLayout><Learn /></PrivateLayout>} />
 <Route path="/events" element={<PrivateLayout><Events /></PrivateLayout>} />
 <Route path="/teams" element={<PrivateLayout><GameTeams /></PrivateLayout>} />
 <Route path="/profile" element={<PrivateLayout><Profile /></PrivateLayout>} />
 <Route path="/admin" element={<PrivateLayout adminOnly><AdminDashboard /></PrivateLayout>} />
 <Route path="*" element={<Navigate to="/" replace />} />
 </Routes>
 </BrowserRouter>
 </div>
 );
}

export default App;
