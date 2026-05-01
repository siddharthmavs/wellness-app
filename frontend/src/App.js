import React, { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuthStore } from "./store";
import { api } from "./lib/api";
import { Navbar } from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Leaderboard from "./pages/Leaderboard";
import Mood from "./pages/Mood";
import FunWall from "./pages/FunWall";
import Profile from "./pages/Profile";

const PrivateLayout = ({ children }) => {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      {children}
    </div>
  );
};

function App() {
  const { token, setUser } = useAuthStore();

  useEffect(() => {
    if (token) {
      api.get("/auth/me").then(({ data }) => setUser(data)).catch(() => {});
    }
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
          <Route path="/profile" element={<PrivateLayout><Profile /></PrivateLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
