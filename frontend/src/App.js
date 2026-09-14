import React, { useEffect } from "react";
import "@/App.css";

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { Toaster, toast } from "sonner";

import { useAuthStore, useThemeStore } from "./store";
import { api } from "./lib/api";

import { Navbar } from "./components/Navbar";
import { BottomNav } from "./components/BottomNav";
import { MusicPlayer } from "./components/MusicPlayer";

import {
  IconCloud,
  IconLeaf,
  IconSparkle,
} from "./components/HandDrawn";

import { startNotificationScheduler } from "./notifications/notificationScheduler";

/* =========================================================
   AUTH
========================================================= */

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AcceptInvite from "./pages/AcceptInvite";

/* =========================================================
   MAIN PAGES
========================================================= */

import Dashboard from "./pages/Dashboard/Dashboard";
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

import NotificationsSettings from "./pages/Settings/General/NotificationsSettings";
import AppearanceSettings from "./pages/Settings/General/AppearanceSettings";

import WaterSettings from "./pages/Settings/Wellness/WaterSettings";
import EyeCareSettings from "./pages/Settings/Wellness/EyeCareSettings";
import MoveResetSettings from "./pages/Settings/Wellness/MoveResetSettings";
import BreathingSettings from "./pages/Settings/Wellness/BreathingSettings";

/* =========================================================
   GLOBAL APPEARANCE SETTINGS
========================================================= */

const APPEARANCE_KEY = "wellness-appearance-settings";

const DEFAULT_APPEARANCE = {
  background: "garden",
  solidColor: "#F5F5F5",
  accentMode: "default",
  accentColor: "#7FAE62",
  layout: "comfortable",
  fontStyle: "default",
  fontSize: "default",
};

/* =========================================================
   FONT SETTINGS
========================================================= */

const FONT_FAMILIES = {
  nunito: '"Nunito", sans-serif',
  fredoka: '"Fredoka", sans-serif',
  jakarta: '"Plus Jakarta Sans", sans-serif',
  kalam: '"Kalam", cursive',
  poppins: '"Poppins", sans-serif',
  quicksand: '"Quicksand", sans-serif',
  dmSans: '"DM Sans", sans-serif',
  manrope: '"Manrope", sans-serif',
  inter: '"Inter", sans-serif',
};

/* =========================================================
   APPLY SAVED APPEARANCE
========================================================= */

const applySavedAppearance = () => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  let settings = {
    ...DEFAULT_APPEARANCE,
  };

  /* =======================================================
     LOAD SAVED SETTINGS
  ======================================================= */

  try {
    const saved = localStorage.getItem(APPEARANCE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      settings = {
        ...DEFAULT_APPEARANCE,
        ...parsed,
      };
    }
  } catch (error) {
    console.warn(
      "Could not load appearance settings.",
      error
    );
  }

  

  let background = settings.background || "garden";

  if (background === "custom") {
    background = "solid";
  }

  root.dataset.background = background;

  /* =======================================================
     CUSTOM / SOLID BACKGROUND
  ======================================================= */

  if (background === "solid") {
    const solidColor =
      settings.solidColor || "#F5F5F5";

    root.style.setProperty(
      "--appearance-bg",
      solidColor
    );

    root.style.setProperty(
      "--appearance-tint",
      solidColor
    );

    root.style.setProperty(
      "--appearance-decoration",
      "none"
    );
  } else {
    root.style.removeProperty(
      "--appearance-bg"
    );

    root.style.removeProperty(
      "--appearance-tint"
    );

    root.style.removeProperty(
      "--appearance-decoration"
    );
  }

  /* =======================================================
     LAYOUT
  ======================================================= */

  root.dataset.layout =
    settings.layout || "comfortable";

  /* =======================================================
     FONT STYLE
  ======================================================= */

  const fontStyle =
    settings.fontStyle || "default";

  root.dataset.fontStyle = fontStyle;


  let fontFamily =
    '"Nunito", "Plus Jakarta Sans", sans-serif';

  switch (fontStyle) {
    case "nunito":
      fontFamily = FONT_FAMILIES.nunito;
      break;

    case "fredoka":
      fontFamily = FONT_FAMILIES.fredoka;
      break;

    case "jakarta":
    case "plus-jakarta":
    case "plusJakartaSans":
      fontFamily = FONT_FAMILIES.jakarta;
      break;

    case "kalam":
      fontFamily = FONT_FAMILIES.kalam;
      break;

    case "poppins":
      fontFamily = FONT_FAMILIES.poppins;
      break;

    case "quicksand":
      fontFamily = FONT_FAMILIES.quicksand;
      break;

    case "dm-sans":
    case "dmSans":
      fontFamily = FONT_FAMILIES.dmSans;
      break;

    case "manrope":
      fontFamily = FONT_FAMILIES.manrope;
      break;

    case "inter":
      fontFamily = FONT_FAMILIES.inter;
      break;

    case "default":
    default:
      /*
         Default keeps the original Wellness Garden
         mixed typography.
      */
      fontFamily =
        '"Nunito", "Plus Jakarta Sans", sans-serif';
      break;
  }

  root.style.setProperty(
    "--appearance-font-family",
    fontFamily
  );

  /* =======================================================
     FONT SIZE
  ======================================================= */

  const fontSize =
    settings.fontSize || "default";

  root.dataset.fontSize = fontSize;

  

  let fontScale = 1;

  switch (fontSize) {
    case "small":
      fontScale = 0.92;
      break;

    case "large":
      fontScale = 1.12;
      break;

    case "extra-large":
      fontScale = 1.25;
      break;

    case "default":
    default:
      fontScale = 1;
      break;
  }

  root.style.setProperty(
    "--appearance-font-scale",
    String(fontScale)
  );

  /* =======================================================
     ACCENT COLOR
  ======================================================= */

  if (settings.accentMode === "custom") {
    const hex =
      settings.accentColor || "#7FAE62";

    root.dataset.accent = "custom";

    root.style.setProperty(
      "--custom-primary",
      hex
    );

    root.style.setProperty(
      "--custom-primary-dark",
      hex
    );

    root.style.setProperty(
      "--custom-secondary",
      hex
    );

    root.style.setProperty(
      "--custom-accent",
      hex
    );

    root.style.setProperty(
      "--custom-border",
      hex
    );
  } else {
    root.dataset.accent = "default";

    root.style.removeProperty(
      "--custom-primary"
    );

    root.style.removeProperty(
      "--custom-primary-dark"
    );

    root.style.removeProperty(
      "--custom-secondary"
    );

    root.style.removeProperty(
      "--custom-accent"
    );

    root.style.removeProperty(
      "--custom-border"
    );
  }

  /* =======================================================
     BODY BACKGROUND
     
  ======================================================= */

  if (background === "solid") {
    document.body.style.backgroundColor =
      settings.solidColor || "#F5F5F5";
  } else {
    document.body.style.backgroundColor =
      "var(--cozy-bg)";
  }
};

/* =========================================================
   PRIVATE LAYOUT
========================================================= */

const PrivateLayout = ({
  children,
  adminOnly = false,
}) => {
  const { token, user } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="private-layout">

      {/* =====================================================
          GLOBAL APPEARANCE BACKGROUND
      ===================================================== */}

      <div
        className="appearance-background"
        aria-hidden="true"
      />

      {/* =====================================================
          GLOBAL WELLNESS DECORATIONS
      ===================================================== */}

      <div
        className="appearance-decorations"
        aria-hidden="true"
      >

        <div className="appearance-leaf appearance-leaf-one">
          <IconLeaf size={58} />
        </div>

        <div className="appearance-sparkle appearance-sparkle-one">
          <IconSparkle size={38} />
        </div>

        <div className="appearance-cloud appearance-cloud-one">
          <IconCloud size={70} />
        </div>

        <div className="appearance-leaf appearance-leaf-two">
          <IconLeaf size={48} />
        </div>

        <div className="appearance-sparkle appearance-sparkle-two">
          <IconSparkle size={34} />
        </div>

        <div className="appearance-cloud appearance-cloud-two">
          <IconCloud size={60} />
        </div>

        <div className="appearance-leaf appearance-leaf-three">
          <IconLeaf size={45} />
        </div>

        <div className="appearance-sparkle appearance-sparkle-three">
          <IconSparkle size={32} />
        </div>

        <div className="appearance-leaf appearance-leaf-four">
          <IconLeaf size={52} />
        </div>

        <div className="appearance-sparkle appearance-sparkle-four">
          <IconSparkle size={28} />
        </div>

        <div className="appearance-cloud appearance-cloud-three">
          <IconCloud size={54} />
        </div>

      </div>

      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <div className="global-navigation">
        <Navbar />
      </div>

      {/* =====================================================
          PAGE CONTENT
      ===================================================== */}

      <main className="private-content">
        {children}
      </main>

      {/* =====================================================
          BOTTOM NAVIGATION
      ===================================================== */}

      <div className="global-bottom-navigation">
        <BottomNav />
      </div>

      {/* =====================================================
          MUSIC PLAYER
      ===================================================== */}

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
     APPLY SAVED APPEARANCE
  ======================================================= */

  useEffect(() => {
    applySavedAppearance();

    

    const handleAppearanceUpdate = () => {
      applySavedAppearance();
    };

    window.addEventListener(
      "appearanceSettingsUpdated",
      handleAppearanceUpdate
    );

    return () => {
      window.removeEventListener(
        "appearanceSettingsUpdated",
        handleAppearanceUpdate
      );
    };
  }, []);

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

    return startNotificationScheduler(
      (notification) => {
        toast(notification.title, {
          description: notification.message,
          duration: 10000,
        });
      }
    );
  }, [token]);

  /* =======================================================
     ROUTES
  ======================================================= */

  return (
    <div className="App">

      <BrowserRouter>

        <Toaster
          position="top-right"
          toastOptions={{
            className:
              "!bg-white !border-[3px] !border-black " +
              "!shadow-brutal !rounded-[2px] " +
              "!font-black !uppercase !text-sm",
          }}
        />

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

          <Route
            path="/accept-invite/:token"
            element={
              token ? (
                <Navigate to="/" replace />
              ) : (
                <AcceptInvite />
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
              SETTINGS
          ================================================= */}

          <Route
            path="/settings"
            element={
              <PrivateLayout>
                <Settings />
              </PrivateLayout>
            }
          />

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
              FALLBACK
          ================================================= */}

          <Route
            path="*"
            element={
              <Navigate to="/" replace />
            }
          />

        </Routes>

      </BrowserRouter>

    </div>
  );
}

export default App;