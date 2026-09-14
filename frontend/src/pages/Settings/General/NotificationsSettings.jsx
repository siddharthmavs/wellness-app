
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { pushSupported, getPushSubscriptionStatus, enablePush, disablePush } from "../../../notifications/pushService";

import {
  ArrowLeft,
  Bell,
  Droplets,
  Eye,
  PersonStanding,
  Wind,
  Volume2,
  Monitor,
  MessageSquare,
  Smartphone,
} from "lucide-react";

/* =========================================================
   STORAGE
========================================================= */

const NOTIFICATION_SETTINGS_KEY = "notificationSettings";

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,

  desktopNotifications: true,
  inAppPopup: true,

  water: true,
  eyeCare: true,
  moveReset: true,
  breathe: true,

  sound: true,
};

/* =========================================================
   NOTIFICATION SETTINGS
========================================================= */

const NotificationSettings = () => {
  const navigate = useNavigate();

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(
        NOTIFICATION_SETTINGS_KEY
      );

      if (saved) {
        return {
          ...DEFAULT_SETTINGS,
          ...JSON.parse(saved),
        };
      }
    } catch (error) {
      console.error(
        "Failed to load notification settings:",
        error
      );
    }

    return DEFAULT_SETTINGS;
  });

  const [permission, setPermission] = useState(() => {
    if (typeof Notification !== "undefined") {
      return Notification.permission;
    }

    return "default";
  });

  const [pushStatus, setPushStatus] = useState("checking"); // checking | none | subscribed | unsupported
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) { setPushStatus("unsupported"); return; }
    getPushSubscriptionStatus().then(setPushStatus).catch(() => setPushStatus("none"));
  }, []);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (pushStatus === "subscribed") {
        await disablePush();
        setPushStatus("none");
        toast.success("Browser push disabled");
      } else {
        await enablePush();
        setPushStatus("subscribed");
        toast.success("Browser push enabled — you'll get reminders even when this tab is closed");
      }
    } catch (err) {
      toast.error(err?.message || "Could not update browser push");
    } finally {
      setPushBusy(false);
    }
  };

  // Backend is the source of truth; localStorage is only a fallback for offline use.
  const loadedFromBackend = useRef(false);
  useEffect(() => {
    api.get("/notifications/settings").then(({ data }) => {
      loadedFromBackend.current = true;
      setSettings((prev) => ({
        ...prev,
        notificationsEnabled: data.notifications_enabled ?? prev.notificationsEnabled,
        desktopNotifications: data.desktop_notifications ?? prev.desktopNotifications,
        inAppPopup: data.in_app_popup ?? prev.inAppPopup,
        sound: data.sound ?? prev.sound,
        water: data.water ?? prev.water,
        eyeCare: data.eye_care ?? prev.eyeCare,
        moveReset: data.move_reset ?? prev.moveReset,
        breathe: data.breathing ?? prev.breathe,
      }));
    }).catch(() => {});
  }, []);

  /* =========================================================
     SAVE SETTINGS
  ========================================================= */

  useEffect(() => {
    localStorage.setItem(
      NOTIFICATION_SETTINGS_KEY,
      JSON.stringify(settings)
    );

    /*
      Tell the notification system that settings changed.
    */
    window.dispatchEvent(
      new CustomEvent("notificationSettingsUpdated", {
        detail: settings,
      })
    );

    if (loadedFromBackend.current) {
      api.put("/notifications/settings", {
        notifications_enabled: settings.notificationsEnabled,
        desktop_notifications: settings.desktopNotifications,
        in_app_popup: settings.inAppPopup,
        sound: settings.sound,
        water: settings.water,
        eye_care: settings.eyeCare,
        move_reset: settings.moveReset,
        breathing: settings.breathe,
      }).catch(() => {});
    }
  }, [settings]);

  /* =========================================================
     TOGGLE
  ========================================================= */

  const toggleSetting = (key) => {
    setSettings((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  };

  /* =========================================================
     REQUEST DESKTOP NOTIFICATION PERMISSION
  ========================================================= */

  const requestNotificationPermission = async () => {
    if (typeof Notification === "undefined") {
      return;
    }

    try {
      const result =
        await Notification.requestPermission();

      setPermission(result);

      if (result === "granted") {
        setSettings((previous) => ({
          ...previous,
          desktopNotifications: true,
        }));
      }
    } catch (error) {
      console.error(
        "Notification permission request failed:",
        error
      );
    }
  };

  /* =========================================================
     SETTING ROW
  ========================================================= */

  const SettingRow = ({
    icon: Icon,
    title,
    description,
    settingKey,
    disabled = false,
  }) => {
    const enabled = settings[settingKey];

    return (
      <div
        className="flex items-center gap-4 p-4"
        style={{
          borderBottom:
            "1px solid var(--cozy-border)",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {/* ICON */}

        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background:
              "var(--cozy-secondary)",
            color:
              "var(--cozy-primary-dark)",
          }}
        >
          <Icon className="w-5 h-5" />
        </div>

        {/* TEXT */}

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-cozy-text">
            {title}
          </h3>

          <p className="text-xs mt-1 opacity-60 text-cozy-text">
            {description}
          </p>
        </div>

        {/* TOGGLE */}

        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            toggleSetting(settingKey)
          }
          className="relative w-12 h-7 rounded-full transition-colors shrink-0"
          style={{
            background: enabled
              ? "var(--cozy-primary)"
              : "var(--cozy-border)",
          }}
          aria-label={`Toggle ${title}`}
        >
          <motion.div
            className="absolute top-1 w-5 h-5 rounded-full bg-white shadow"
            animate={{
              x: enabled ? 26 : 4,
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
            }}
          />
        </button>
      </div>
    );
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex items-center gap-4 mb-8">

        {/* BACK TO SETTINGS */}

        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition hover:scale-105"
          style={{
            background: "var(--cozy-surface)",
            color: "var(--cozy-text)",
            border:
              "1px solid var(--cozy-border)",
          }}
          aria-label="Back to Settings"
          title="Back to Settings"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* NOTIFICATION ICON */}

        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background:
              "var(--cozy-primary)",
            color: "white",
          }}
        >
          <Bell className="w-7 h-7" />
        </div>

        {/* TITLE */}

        <div>
          <h1 className="font-display font-black text-3xl md:text-4xl text-cozy-text">
            Notifications
          </h1>

          <p className="text-sm opacity-60 mt-1 text-cozy-text">
            Manage wellness notifications and reminders.
          </p>
        </div>

      </div>

      {/* =====================================================
          MASTER SETTINGS
      ===================================================== */}

      <section className="mb-8">

        <h2 className="px-2 mb-3 text-xs font-black uppercase tracking-widest opacity-50">
          Notification Controls
        </h2>

        <div
          className="overflow-hidden bg-cozy-surface shadow-cozy"
          style={{
            border:
              "1px solid var(--cozy-border)",
            borderRadius: 20,
          }}
        >

          {/* MASTER */}

          <SettingRow
            icon={Bell}
            title="Wellness Notifications"
            description="Turn all wellness reminders on or off."
            settingKey="notificationsEnabled"
          />

          {/* DESKTOP */}

          <SettingRow
            icon={Monitor}
            title="Desktop Notifications"
            description="Show wellness reminders as desktop notifications."
            settingKey="desktopNotifications"
            disabled={
              !settings.notificationsEnabled ||
              permission !== "granted"
            }
          />

          {/* IN APP */}

          <SettingRow
            icon={MessageSquare}
            title="In-App Wellness Popup"
            description="Show the Wellness Alert popup inside Wellness Garden."
            settingKey="inAppPopup"
            disabled={
              !settings.notificationsEnabled
            }
          />

          {/* SOUND */}

          <SettingRow
            icon={Volume2}
            title="Notification Sound"
            description="Play a sound when a wellness reminder appears."
            settingKey="sound"
            disabled={
              !settings.notificationsEnabled
            }
          />

        </div>

      </section>

      {/* =====================================================
          DESKTOP PERMISSION
      ===================================================== */}

      {settings.notificationsEnabled && (
        <section className="mb-8">

          <h2 className="px-2 mb-3 text-xs font-black uppercase tracking-widest opacity-50">
            Desktop Permission
          </h2>

          <div
            className="bg-cozy-surface p-5 shadow-cozy"
            style={{
              border:
                "1px solid var(--cozy-border)",
              borderRadius: 20,
            }}
          >

            <div className="flex items-center justify-between gap-4">

              <div>
                <h3 className="font-bold text-sm text-cozy-text">
                  Browser notification permission
                </h3>

                <p className="text-xs mt-1 opacity-60">
                  {permission === "granted"
                    ? "Desktop notifications are allowed."
                    : permission === "denied"
                    ? "Notifications are blocked by your browser."
                    : "Allow Wellness Garden to show desktop notifications."}
                </p>
              </div>

              {permission === "granted" ? (
                <div
                  className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{
                    background:
                      "var(--cozy-secondary)",
                  }}
                >
                  ✓ Allowed
                </div>
              ) : (
                <button
                  type="button"
                  onClick={
                    requestNotificationPermission
                  }
                  disabled={
                    permission === "denied"
                  }
                  className="px-4 py-2 rounded-xl font-bold text-sm shadow-cozy transition hover:opacity-90 disabled:opacity-50"
                  style={{
                    background:
                      "var(--cozy-primary)",
                    color: "white",
                  }}
                >
                  Allow
                </button>
              )}

            </div>

          </div>

        </section>
      )}

      {/* =====================================================
          BROWSER PUSH (doc section 8.4)
      ===================================================== */}

      {settings.notificationsEnabled && pushStatus !== "unsupported" && (
        <section className="mb-8">

          <h2 className="px-2 mb-3 text-xs font-black uppercase tracking-widest opacity-50">
            Browser Push
          </h2>

          <div
            className="bg-cozy-surface p-5 shadow-cozy"
            style={{
              border: "1px solid var(--cozy-border)",
              borderRadius: 20,
            }}
          >

            <div className="flex items-center justify-between gap-4">

              <div className="flex items-center gap-4">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: "var(--cozy-secondary)", color: "var(--cozy-primary-dark)" }}
                >
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-cozy-text">
                    Notifications outside the browser tab
                  </h3>
                  <p className="text-xs mt-1 opacity-60">
                    {pushStatus === "subscribed"
                      ? "Enabled — reminders will reach you even when this tab is closed."
                      : "Get reminders on your device even when Wellness Garden isn't open."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={togglePush}
                disabled={pushBusy || pushStatus === "checking"}
                className="px-4 py-2 rounded-xl font-bold text-sm shadow-cozy transition hover:opacity-90 disabled:opacity-50 shrink-0"
                style={{
                  background: pushStatus === "subscribed" ? "var(--cozy-secondary)" : "var(--cozy-primary)",
                  color: pushStatus === "subscribed" ? "var(--cozy-text)" : "white",
                }}
              >
                {pushBusy ? "..." : pushStatus === "subscribed" ? "Disable" : "Enable"}
              </button>

            </div>

          </div>

        </section>
      )}

      {/* =====================================================
          WELLNESS TYPES
      ===================================================== */}

      <section>

        <h2 className="px-2 mb-3 text-xs font-black uppercase tracking-widest opacity-50">
          Wellness Reminders
        </h2>

        <div
          className="overflow-hidden bg-cozy-surface shadow-cozy"
          style={{
            border:
              "1px solid var(--cozy-border)",
            borderRadius: 20,
          }}
        >

          {/* WATER */}

          <SettingRow
            icon={Droplets}
            title="Drink Water"
            description="Receive reminders to stay hydrated."
            settingKey="water"
            disabled={
              !settings.notificationsEnabled
            }
          />

          {/* EYE CARE */}

          <SettingRow
            icon={Eye}
            title="Eye Care"
            description="Receive reminders to take eye breaks."
            settingKey="eyeCare"
            disabled={
              !settings.notificationsEnabled
            }
          />

          {/* MOVE */}

          <SettingRow
            icon={PersonStanding}
            title="Move & Reset"
            description="Receive reminders to move and stretch."
            settingKey="moveReset"
            disabled={
              !settings.notificationsEnabled
            }
          />

          {/* BREATHE */}

          <SettingRow
            icon={Wind}
            title="Breathe"
            description="Receive reminders for breathing exercises."
            settingKey="breathe"
            disabled={
              !settings.notificationsEnabled
            }
          />

        </div>

      </section>

      {/* =====================================================
          INFO
      ===================================================== */}

      <div
        className="mt-6 p-4 rounded-2xl"
        style={{
          background:
            "var(--cozy-secondary)",
          color: "var(--cozy-text)",
        }}
      >
        <p className="text-xs opacity-70">
          Your wellness schedules are managed
          separately in Water, Eye Care,
          Move & Reset, and Breathe settings.
          These controls decide which reminders
          are allowed to notify you.
        </p>
      </div>

    </main>
  );
};

export default NotificationSettings;
