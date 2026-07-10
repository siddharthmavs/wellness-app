import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import { api } from "../lib/api";

const KIND_COLOR = {
  info: "bg-brutal-cyan",
  alert: "bg-brutal-pink text-white",
  party: "bg-brutal-yellow",
};

export const NotificationBell = () => {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const load = async () => {
    try {
      const { data } = await api.get("/announcements/me");
      setItems(data);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const unread = items.filter((i) => i.unread).length;

  const markRead = async (id) => {
    await api.post(`/announcements/${id}/read`);
    setItems((it) => it.map((x) => x.id === id ? { ...x, unread: false } : x));
  };

  return (
    <div className="relative" ref={ref}>
      <motion.button
        whileTap={{ scale: 0.92 }}
        data-testid="notif-bell"
        onClick={() => setOpen(!open)}
        className="bg-white border-[3px] border-black p-2 shadow-brutal-sm relative"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-2 -right-2 bg-brutal-pink text-white border-[2px] border-black w-5 h-5 flex items-center justify-center font-black text-[10px]" data-testid="notif-unread">
            {unread}
          </span>
        )}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, rotate: -1 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-80 bg-white border-[4px] border-black shadow-brutal-lg z-50 max-h-96 overflow-y-auto"
            data-testid="notif-dropdown"
          >
            <div className="bg-black text-brutal-yellow border-b-[3px] border-black px-3 py-2 font-display font-black uppercase text-sm">
              📢 Announcements
            </div>
            {items.length === 0 ? (
              <div className="p-4 text-sm font-bold uppercase text-center">All quiet, legend.</div>
            ) : (
              items.map((a) => (
                <div
                  key={a.id}
                  data-testid={`notif-${a.id}`}
                  onClick={() => a.unread && markRead(a.id)}
                  className={`border-b-[3px] border-black p-3 cursor-pointer ${KIND_COLOR[a.kind] || "bg-white"} ${a.unread ? "" : "opacity-70"}`}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className="font-display font-black uppercase text-sm flex-1">{a.title}</span>
                    {a.unread && <span className="bg-black text-brutal-yellow border-[2px] border-black px-1 font-black text-[9px] uppercase">NEW</span>}
                  </div>
                  <div className="text-xs font-medium">{a.message}</div>
                  <div className="text-[10px] font-bold uppercase mt-1 opacity-70">From {a.from_name} · {new Date(a.created_at).toLocaleString()}</div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
