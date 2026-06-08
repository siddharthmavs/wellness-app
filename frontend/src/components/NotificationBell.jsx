import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCheck } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../store";

// ─── Wellness reminder schedule (ms) ──────────────────────────────────────
const WELLNESS_SCHEDULE = [
  { type: "water",     interval: 60 * 60 * 1000 }, // 60 min
  { type: "eye_care",  interval: 20 * 60 * 1000 }, // 20 min
  { type: "stand",     interval: 90 * 60 * 1000 }, // 90 min
  { type: "breathing", interval: 45 * 60 * 1000 }, // 45 min
];

const KIND_COLOR = {
  shoutout:     "bg-brutal-pink",
  reward:       "bg-brutal-yellow",
  announcement: "bg-brutal-cyan",
  wellness:     "bg-brutal-green",
  birthday:     "bg-brutal-yellow",
  badge:        "bg-brutal-cyan",
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Request browser notification permission on first render
async function requestBrowserPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function showBrowserNotif(title, body, icon = "🔔") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    // eslint-disable-next-line no-new
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: title, // deduplicate same-title notifications
    });
  } catch (_) {
    // silently ignore (e.g. in iframe / certain browsers)
  }
}

export default function NotificationBell() {
  const { token } = useAuthStore();
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);
  const prevIdsRef = useRef(new Set());
  const panelRef = useRef(null);

  const unread = notifs.filter((n) => !n.read).length;

  const fetchNotifs = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get("/notifications/me");
      setNotifs(data);
      // show browser notification for any newly arrived unread items
      for (const n of data) {
        if (!n.read && !prevIdsRef.current.has(n.id)) {
          showBrowserNotif(n.title, n.message, n.icon);
        }
      }
      prevIdsRef.current = new Set(data.map((n) => n.id));
    } catch (_) {}
  }, [token]);

  // Initial fetch + 30-second polling
  useEffect(() => {
    requestBrowserPermission();
    fetchNotifs();
    const timer = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(timer);
  }, [fetchNotifs]);

  // Also fire birthday notifications once on mount
  useEffect(() => {
    if (!token) return;
    api.post("/notifications/birthday").catch(() => {});
  }, [token]);

  // Wellness reminders (client-side timers)
  useEffect(() => {
    if (!token) return;
    const timers = WELLNESS_SCHEDULE.map(({ type, interval }) =>
      setInterval(() => {
        api.post("/notifications/wellness", { type }).catch(() => {});
        fetchNotifs();
      }, interval)
    );
    return () => timers.forEach(clearInterval);
  }, [token, fetchNotifs]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`).catch(() => {});
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    await api.post("/notifications/read-all").catch(() => {});
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <motion.button
        data-testid="notif-bell"
        whileTap={{ rotate: 20, scale: 0.9 }}
        onClick={() => setOpen((o) => !o)}
        className="relative bg-white border-[3px] border-black p-2 shadow-brutal-sm"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <motion.span
            key={unread}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 -right-2 bg-brutal-pink border-[2px] border-black text-[10px] font-black min-w-[18px] h-[18px] flex items-center justify-center px-0.5"
            data-testid="notif-badge"
          >
            {unread > 99 ? "99+" : unread}
          </motion.span>
        )}
      </motion.button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, rotate: -1 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-2 z-50 w-[340px] bg-white border-[4px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
            data-testid="notif-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b-[3px] border-black bg-black text-white">
              <span className="font-display font-black uppercase text-base">
                🔔 Notifications {unread > 0 && <span className="text-brutal-yellow">({unread})</span>}
              </span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    data-testid="notif-mark-all"
                    onClick={markAllRead}
                    className="text-brutal-cyan hover:text-white"
                    title="Mark all read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setOpen(false)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto divide-y-[2px] divide-black">
              {notifs.length === 0 && (
                <div className="p-6 text-center font-black uppercase text-sm text-gray-400">
                  All quiet. Go do something! 🦗
                </div>
              )}
              {notifs.map((n) => (
                <div
                  key={n.id}
                  data-testid={`notif-item-${n.kind}`}
                  onClick={() => markRead(n.id)}
                  className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !n.read ? "bg-brutal-yellow/10" : ""
                  }`}
                >
                  {/* Kind dot */}
                  <div className={`${KIND_COLOR[n.kind] || "bg-white"} border-[2px] border-black w-8 h-8 flex-shrink-0 flex items-center justify-center text-sm font-black`}>
                    {n.icon || "🔔"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-black uppercase leading-tight truncate ${!n.read ? "text-black" : "text-gray-600"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs font-medium text-gray-600 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-brutal-pink border border-black flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            {notifs.length > 0 && (
              <div className="border-t-[3px] border-black px-4 py-2 text-center">
                <span className="text-[10px] font-black uppercase text-gray-400">
                  {notifs.length} total · showing last 80
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
