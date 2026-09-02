import React, { useState } from "react";
import { motion } from "framer-motion";
import { Settings as SettingsIcon, Droplets, Eye, PersonStanding, Wind, Save, Check, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const WellnessDefaults = () => {
  const navigate = useNavigate();

  // Initial reference state with practical default configurations
  const initialDefaults = {
    water: { goal: "2000", interval: "Every 2 hours" },
    eyeBreak: { target: "3", interval: "Every 60 minutes" },
    moveReset: { target: "3", interval: "Every 90 minutes" },
    breathing: { target: "3", interval: "After lunch / 14:00" },
  };

  const [defaults, setDefaults] = useState(initialDefaults);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (key, field, value) => {
    setDefaults((prev) => {
      const updated = {
        ...prev,
        [key]: {
          ...prev[key],
          [field]: value,
        },
      };
      
      setHasChanges(JSON.stringify(updated) !== JSON.stringify(initialDefaults));
      return updated;
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    console.log("Saving organization wellness defaults:", defaults);
    toast.success("Wellness defaults updated successfully!");
    setHasChanges(false);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      {/* BACK BUTTON */}
      <button
        type="button"
        onClick={() => navigate("/settings")}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100 mb-6 transition-opacity"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </button>

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
          <h1 className="font-display font-black text-2xl md:text-3xl text-cozy-text">
            Wellness Defaults
          </h1>
          <p className="text-xs md:text-sm opacity-60 mt-1 text-cozy-text">
            Configure default organizational goals and reminder intervals for all employees.
          </p>
        </div>
      </div>

      {/* FORM */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* WATER DEFAULTS */}
        <div className="bg-cozy-surface p-6 shadow-cozy border border-cozy-border rounded-[20px]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Droplets className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-cozy-text">Water Hydration Default</h2>
              <p className="text-xs opacity-60">Baseline volume and reminder pacing</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
                Default Goal (ml)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={defaults.water.goal}
                onChange={(e) => handleChange("water", "goal", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
                Reminder Interval
              </label>
              <input
                type="text"
                value={defaults.water.interval}
                onChange={(e) => handleChange("water", "interval", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </div>

        {/* EYE BREAK DEFAULTS */}
        <div className="bg-cozy-surface p-6 shadow-cozy border border-cozy-border rounded-[20px]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-cozy-text">Eye Break Default</h2>
              <p className="text-xs opacity-60">Baseline daily target sessions & interval</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
                Default Target Sessions
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={defaults.eyeBreak.target}
                onChange={(e) => handleChange("eyeBreak", "target", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
                Reminder Interval
              </label>
              <input
                type="text"
                value={defaults.eyeBreak.interval}
                onChange={(e) => handleChange("eyeBreak", "interval", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </div>

        {/* MOVE & RESET DEFAULTS */}
        <div className="bg-cozy-surface p-6 shadow-cozy border border-cozy-border rounded-[20px]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <PersonStanding className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-cozy-text">Move & Reset Default</h2>
              <p className="text-xs opacity-60">Baseline physical stretch targets & interval</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
                Default Target Sessions
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={defaults.moveReset.target}
                onChange={(e) => handleChange("moveReset", "target", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
                Reminder Interval
              </label>
              <input
                type="text"
                value={defaults.moveReset.interval}
                onChange={(e) => handleChange("moveReset", "interval", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </div>

        {/* BREATHING DEFAULTS */}
        <div className="bg-cozy-surface p-6 shadow-cozy border border-cozy-border rounded-[20px]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-cozy-text">Breathing Default</h2>
              <p className="text-xs opacity-60">Baseline mindfulness target sessions & spacing</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
                Default Target Sessions
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={defaults.breathing.target}
                onChange={(e) => handleChange("breathing", "target", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider opacity-70 mb-2">
                Reminder Interval
              </label>
              <input
                type="text"
                value={defaults.breathing.interval}
                onChange={(e) => handleChange("breathing", "interval", e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end">
          <motion.button
            type="submit"
            disabled={!hasChanges}
            whileHover={hasChanges ? { scale: 1.02 } : {}}
            whileTap={hasChanges ? { scale: 0.98 } : {}}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
              hasChanges
                ? "bg-black text-white shadow-brutal cursor-pointer"
                : "bg-cozy-surface text-cozy-text opacity-50 border border-cozy-border cursor-not-allowed shadow-none"
            }`}
          >
            {hasChanges ? (
              <>
                <Save className="w-4 h-4" />
                Save Default Settings
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                Saved
              </>
            )}
          </motion.button>
        </div>

      </form>
    </main>
  );
};

export default WellnessDefaults;