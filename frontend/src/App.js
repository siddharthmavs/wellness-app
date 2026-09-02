import React, { useEffect } from "react";
import "@/App.css";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { Toaster } from "sonner";
import { toast } from "sonner";

import { useAuthStore, useThemeStore } from "./store";
import { api } from "./lib/api";

import { Navbar } from "./components/Navbar";
import { BottomNav } from "./components/BottomNav";
import { MusicPlayer } from "./components/MusicPlayer";
import { InkDefs } from "./components/HandDrawn";
import { startNotificationScheduler } from "./notifications/notificationScheduler";

/* =========================================================
   AUTH
========================================================= */

import Login from "./pages/Login";
import Signup from "./pages/Signup";

/* =========================================================
   DASHBOARD
========================================================= */

import Dashboard from "./pages/Dashboard/Dashboard";

/* =========================================================
   MAIN PAGES
========================================================= */

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

/* =========================================================
   SETTINGS
========================================================= */

import Settings from "./pages/Settings/Settings";

/* ---------------- General Settings ---------------- */

import NotificationsSettings from "./pages/Settings/General/NotificationsSettings";
import AppearanceSettings from "./pages/Settings/General/AppearanceSettings";
import SoundSettings from "./pages/Settings/General/SoundSettings";
import AccessibilitySettings from "./pages/Settings/General/AccessibilitySettings";

/* ---------------- Wellness Settings ---------------- */

import WaterSettings from "./pages/Settings/Wellness/WaterSettings";
import EyeCareSettings from "./pages/Settings/Wellness/EyeCareSettings";
import MoveResetSettings from "./pages/Settings/Wellness/MoveResetSettings";
import BreathingSettings from "./pages/Settings/Wellness/BreathingSettings";

/* ---------------- Admin Settings ---------------- */

import OrganizationSettings from "./pages/Settings/Admin/OrganizationSettings";
import WellnessDefaults from "./pages/Settings/Admin/WellnessDefaults";
import RewardsSettings from "./pages/Settings/Admin/RewardsSettings";
/* =========================================================
   PRIVATE LAYOUT
========================================================= */

const PrivateLayout = ({
  children,
  adminOnly = false,
}) => {
  const { token, user } = useAuthStore();

  /* Not logged in */
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  /* Admin-only pages */
  if (adminOnly && user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-white paper-grain relative">

      <Navbar />

      <div className="relative z-10">
        {children}
      </div>

      <BottomNav />

      <MusicPlayer />

    </div>
  );
};

/* =========================================================
   APP
========================================================= */

function App() {
  const { token, setUser } = useAuthStore();

  const applyTheme = useThemeStore(
    (state) => state.apply
  );

  /* =======================================================
     APPLY THEME
  ======================================================= */

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  /* =======================================================
     LOAD CURRENT USER
  ======================================================= */

  useEffect(() => {
    if (!token) return;

    api
      .get("/auth/me")
      .then(({ data }) => {
        setUser(data);
      })
      .catch(() => {});
  }, [token, setUser]);

  /* =======================================================
     WELLNESS NOTIFICATION SCHEDULER
  ======================================================= */

  useEffect(() => {
    if (!token) return undefined;

    return startNotificationScheduler((notification) => {
      toast(notification.title, {
        description: notification.message,
        duration: 10000,
      });
    });
  }, [token]);

  /* =======================================================
     ROUTES
  ======================================================= */

  return (
    <div className="App">

      <BrowserRouter>

        {/* =================================================
            TOASTER
        ================================================= */}
          <Toaster
            position="bottom-right"
            closeButton={true}
            toastOptions={{
              className:
                "!bg-white !border-[3px] !border-black " +
                "!shadow-brutal !rounded-[2px] " +
                "!font-black !uppercase !text-base !p-4 !min-w-[300px]",
            }}
          />

        {/* =================================================
            APPLICATION ROUTES
        ================================================= */}

        <Routes>

          {/* =================================================
              AUTH
          ================================================= */}

          <Route
            path="/login"
            element={
              token ? (
                <Navigate to="/" replace />
              ) : (
                <Login />
              )
            }
          />

          <Route
            path="/signup"
            element={
              token ? (
                <Navigate to="/" replace />
              ) : (
                <Signup />
              )
            }
          />

          {/* =================================================
              DASHBOARD
          ================================================= */}

          <Route
            path="/"
            element={
              <PrivateLayout>
                <Dashboard />
              </PrivateLayout>
            }
          />

          {/* =================================================
              MAIN PAGES
          ================================================= */}

          <Route
            path="/leaderboard"
            element={
              <PrivateLayout>
                <Leaderboard />
              </PrivateLayout>
            }
          />

          <Route
            path="/mood"
            element={
              <PrivateLayout>
                <Mood />
              </PrivateLayout>
            }
          />

          <Route
            path="/funwall"
            element={
              <PrivateLayout>
                <FunWall />
              </PrivateLayout>
            }
          />

          <Route
            path="/shoutouts"
            element={
              <PrivateLayout>
                <Shoutouts />
              </PrivateLayout>
            }
          />

          <Route
            path="/help"
            element={
              <PrivateLayout>
                <HelpBoard />
              </PrivateLayout>
            }
          />

          <Route
            path="/music"
            element={
              <PrivateLayout>
                <Music />
              </PrivateLayout>
            }
          />

          <Route
            path="/polls"
            element={
              <PrivateLayout>
                <Polls />
              </PrivateLayout>
            }
          />

          <Route
            path="/games"
            element={
              <PrivateLayout>
                <Games />
              </PrivateLayout>
            }
          />

          <Route
            path="/quiz"
            element={
              <PrivateLayout>
                <Quiz />
              </PrivateLayout>
            }
          />

          <Route
            path="/learn"
            element={
              <PrivateLayout>
                <Learn />
              </PrivateLayout>
            }
          />

          <Route
            path="/events"
            element={
              <PrivateLayout>
                <Events />
              </PrivateLayout>
            }
          />

          <Route
            path="/teams"
            element={
              <PrivateLayout>
                <GameTeams />
              </PrivateLayout>
            }
          />

          <Route
            path="/profile"
            element={
              <PrivateLayout>
                <Profile />
              </PrivateLayout>
            }
          />

          {/* =================================================
              SETTINGS HOME
          ================================================= */}

          <Route
            path="/settings"
            element={
              <PrivateLayout>
                <Settings />
              </PrivateLayout>
            }
          />

          {/* =================================================
              GENERAL SETTINGS
          ================================================= */}

          <Route
            path="/settings/notifications"
            element={
              <PrivateLayout>
                <NotificationsSettings />
              </PrivateLayout>
            }
          />

          <Route
            path="/settings/appearance"
            element={
              <PrivateLayout>
                <AppearanceSettings />
              </PrivateLayout>
            }
          />

          <Route
            path="/settings/sound"
            element={
              <PrivateLayout>
                <SoundSettings />
              </PrivateLayout>
            }
          />

          <Route
            path="/settings/accessibility"
            element={
              <PrivateLayout>
                <AccessibilitySettings />
              </PrivateLayout>
            }
          />

          {/* =================================================
              WELLNESS SETTINGS
          ================================================= */}

          <Route
            path="/settings/water"
            element={
              <PrivateLayout>
                <WaterSettings />
              </PrivateLayout>
            }
          />

          <Route
            path="/settings/eye-care"
            element={
              <PrivateLayout>
                <EyeCareSettings />
              </PrivateLayout>
            }
          />

          <Route
            path="/settings/move-reset"
            element={
              <PrivateLayout>
                <MoveResetSettings />
              </PrivateLayout>
            }
          />

          <Route
            path="/settings/breathe"
            element={
              <PrivateLayout>
                <BreathingSettings />
              </PrivateLayout>
            }
          />

          {/* =================================================
              ADMIN
          ================================================= */}

          <Route
            path="/admin"
            element={
              <PrivateLayout adminOnly>
                <AdminDashboard />
              </PrivateLayout>
            }
          />
          {/* =================================================
              ADMIN SETTINGS
          ================================================= */}

          <Route
            path="/settings/admin/organization"
            element={
              <PrivateLayout adminOnly>
                <OrganizationSettings />
              </PrivateLayout>
            }
          />

          <Route
            path="/settings/admin/wellness-defaults"
            element={
              <PrivateLayout adminOnly>
                <WellnessDefaults />
              </PrivateLayout>
            }
          />

          <Route
            path="/settings/admin/rewards"
            element={
              <PrivateLayout adminOnly>
                <RewardsSettings />
              </PrivateLayout>
            }
          />
          
          {/* =================================================
              FALLBACK
          ================================================= */}

          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>

      </BrowserRouter>

    </div>
  );
}

export default App;
