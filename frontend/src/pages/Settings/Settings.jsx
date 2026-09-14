import React from "react";
import { motion } from "framer-motion";
import {
  Settings as SettingsIcon,
  Bell,
  Palette,
  Droplets,
  Eye,
  PersonStanding,
  Wind,
  ChevronRight,
  
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store"; // Make sure this path points to your store

/* =========================================================
   GENERAL SETTINGS
========================================================= */

const GENERAL_SETTINGS = [
  {
    label: "Notifications",
    description: "Manage wellness notifications and reminders",
    icon: Bell,
    path: "/settings/notifications",
  },
  {
    label: "Appearance",
    description: "Customize the look and feel of Wellness Garden",
    icon: Palette,
    path: "/settings/appearance",
  },
  
 
];

/* =========================================================
   WELLNESS SETTINGS
========================================================= */

const WELLNESS_SETTINGS = [
  {
    label: "Drink Water",
    description: "Customize your daily water goal and reminders",
    icon: Droplets,
    path: "/settings/water",
  },
  {
    label: "Eye Care",
    description: "Manage eye break reminders and schedules",
    icon: Eye,
    path: "/settings/eye-care",
  },
  {
    label: "Move & Reset",
    description: "Manage movement reminders and schedules",
    icon: PersonStanding,
    path: "/settings/move-reset",
  },
  {
    label: "Breathe",
    description: "Manage breathing reminders and schedules",
    icon: Wind,
    path: "/settings/breathe",
  },
];


/* =========================================================
   SETTING ITEM
========================================================= */

const SettingItem = ({ item }) => {
  const navigate = useNavigate();
  const Icon = item.icon;

  return (
    <motion.button
      type="button"
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(item.path)}
      className="w-full flex items-center gap-4 p-4 text-left transition-colors"
    >
      {/* ICON */}
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
        style={{
          background: "var(--cozy-secondary)",
          color: "var(--cozy-primary-dark)",
        }}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* TEXT */}
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-sm text-cozy-text">
          {item.label}
        </h3>

        <p className="text-xs mt-1 opacity-60 text-cozy-text">
          {item.description}
        </p>
      </div>

      {/* ARROW */}
      <ChevronRight className="w-5 h-5 opacity-50 shrink-0" />
    </motion.button>
  );
};

/* =========================================================
   SETTINGS SECTION
========================================================= */

const SettingsSection = ({ title, items }) => {
  return (
    <section>
      <h2 className="px-2 mb-3 text-xs font-black uppercase tracking-widest opacity-50">
        {title}
      </h2>

      <div
        className="overflow-hidden bg-cozy-surface shadow-cozy"
        style={{
          border: "1px solid var(--cozy-border)",
          borderRadius: 20,
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.path}
            style={{
              borderBottom:
                index === items.length - 1
                  ? "none"
                  : "1px solid var(--cozy-border)",
            }}
          >
            <SettingItem item={item} />
          </div>
        ))}
      </div>
    </section>
  );
};

/* =========================================================
   SETTINGS PAGE
========================================================= */

const Settings = () => {
  // Use the actual auth store user state instead of manual localStorage hacks
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">

      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: "var(--cozy-primary)",
            color: "white",
          }}
        >
          <SettingsIcon className="w-7 h-7" />
        </div>

        <div>
          <h1 className="font-display font-black text-3xl md:text-4xl text-cozy-text">
            Settings
          </h1>

          <p className="text-sm opacity-60 mt-1 text-cozy-text">
            Customize your Wellness Garden experience.
          </p>
        </div>
      </div>

      {/* SETTINGS SECTIONS */}
      <div className="space-y-8">

        {/* GENERAL */}
        <SettingsSection
          title="General"
          items={GENERAL_SETTINGS}
        />

        {/* WELLNESS */}
        <SettingsSection
          title="Wellness"
          items={WELLNESS_SETTINGS}
        />

        

      </div>
    </main>
  );
};

export default Settings;