import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Droplets,
  Plus,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const WATER_GOAL_KEY = "waterGoal";
const WATER_SETTINGS_KEY = "wellness-water-settings";

const DEFAULT_SETTINGS = {
  reminderTimes: ["10:00", "13:00", "16:00"],
};

const QUICK_GOALS = [1500, 2000, 2500, 3000];

const WaterSettings = () => {
  const navigate = useNavigate();

  /* =========================================================
      DAILY GOAL
  ========================================================= */

  const [savedGoal, setSavedGoal] = useState(() => {
    const saved = localStorage.getItem(WATER_GOAL_KEY);
    return saved ? Number(saved) : 2000;
  });

  const [selectedGoal, setSelectedGoal] = useState(() => {
    const saved = localStorage.getItem(WATER_GOAL_KEY);
    return saved ? Number(saved) : 2000;
  });

  const [customGoal, setCustomGoal] = useState("");

  /* =========================================================
      REMINDER SETTINGS
  ========================================================= */

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(WATER_SETTINGS_KEY);
      if (saved) {
        return {
          ...DEFAULT_SETTINGS,
          ...JSON.parse(saved),
        };
      }
    } catch (error) {
      console.error("Failed to load water settings:", error);
    }
    return DEFAULT_SETTINGS;
  });

  const [newTime, setNewTime] = useState("");
  const [saved, setSaved] = useState(false);

  /* =========================================================
      REMINDER SETTINGS AUTO SAVE
  ========================================================= */

  useEffect(() => {
    localStorage.setItem(
      WATER_SETTINGS_KEY,
      JSON.stringify(settings)
    );
  }, [settings]);

  /* =========================================================
      LISTEN FOR GOAL CHANGES
  ========================================================= */

  useEffect(() => {
    const loadGoal = () => {
      const saved = localStorage.getItem(WATER_GOAL_KEY);
      if (!saved) return;
      const goal = Number(saved);
      if (!goal || goal < 500) return;

      setSavedGoal(goal);
      setSelectedGoal(goal);
      setCustomGoal("");
    };

    window.addEventListener("water-settings-updated", loadGoal);
    window.addEventListener("storage", loadGoal);

    return () => {
      window.removeEventListener("water-settings-updated", loadGoal);
      window.removeEventListener("storage", loadGoal);
    };
  }, []);

  /* =========================================================
      UNSAVED CHANGES
  ========================================================= */

  const hasUnsavedChanges = selectedGoal !== savedGoal;

  /* =========================================================
      SELECT GOAL
  ========================================================= */

  const selectGoal = (amount) => {
    if (!amount || amount < 500) return;
    setSelectedGoal(amount);
    setCustomGoal("");
  };

  const handleCustomGoalChange = (value) => {
    setCustomGoal(value);
    const amount = Number(value);
    if (amount >= 500) {
      setSelectedGoal(amount);
    }
  };

  const saveGoal = () => {
    if (!selectedGoal || selectedGoal < 500) return;

    localStorage.setItem(WATER_GOAL_KEY, String(selectedGoal));
    setSavedGoal(selectedGoal);

    window.dispatchEvent(new Event("water-settings-updated"));

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  /* =========================================================
      REMINDERS
  ========================================================= */

  const addReminderTime = () => {
    if (!newTime) return;
    if (settings.reminderTimes.includes(newTime)) {
      setNewTime("");
      return;
    }

    const updatedTimes = [...settings.reminderTimes, newTime].sort();
    setSettings((prev) => ({
      ...prev,
      reminderTimes: updatedTimes,
    }));
    setNewTime("");
  };

  const removeReminderTime = (time) => {
    setSettings((prev) => ({
      ...prev,
      reminderTimes: prev.reminderTimes.filter((item) => item !== time),
    }));
  };

  return (
    <div className="water-care-settings">
      {/* =====================================================
          HEADER WITH SCROLLING BACK BUTTON
      ========================================================= */}

      <div className="water-care-settings-header">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="back-button"
          aria-label="Back to settings"
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <h2>Drink Water</h2>
          <p>Customize your hydration goal and reminders.</p>
        </div>
      </div>

      {/* =====================================================
          DAILY GOAL
      ========================================================= */}

      <div className="water-care-setting-card">
        <div className="setting-header">
          <div className="setting-icon">
            <Droplets size={22} />
          </div>
          <div>
            <h3>Daily Water Goal</h3>
            <p>Choose how much water you want to drink each day.</p>
          </div>
        </div>

        <div className="goal-options">
          {QUICK_GOALS.map((goal) => {
            const active = selectedGoal === goal;
            return (
              <button
                key={goal}
                type="button"
                className={`goal-option-pill ${active ? "active" : ""}`}
                onClick={() => selectGoal(goal)}
              >
                {goal} ml
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="number"
            min="500"
            step="50"
            placeholder="Custom ml"
            value={customGoal}
            onChange={(event) => handleCustomGoalChange(event.target.value)}
            className="schedule-input"
          />
          <span className="text-sm font-bold opacity-60">
            Selected: {selectedGoal} ml
          </span>
        </div>
      </div>

      {/* =====================================================
          REMINDERS SCHEDULE
      ========================================================= */}

      <div className="water-care-setting-card">
        <div className="setting-header">
          <div className="setting-icon clock-icon">
            ⏰
          </div>
          <div>
            <h3>Water Reminders</h3>
            <p>Remind me to drink water throughout the day.</p>
          </div>
        </div>

        <div className="schedule-list">
          <p className="text-xs font-black uppercase tracking-wide opacity-50 mb-2">
            Reminder Times
          </p>

          {settings.reminderTimes.length === 0 ? (
            <p className="text-sm opacity-50 py-2">No reminder times added.</p>
          ) : (
            settings.reminderTimes.map((time, index) => (
              <div className="schedule-row" key={time}>
                <div className="schedule-number">{index + 1}</div>
                <div className="schedule-label">{formatTime(time)}</div>
                <button
                  type="button"
                  onClick={() => removeReminderTime(time)}
                  className="p-2 border-2 border-black rounded-xl bg-red-50 hover:bg-red-100 transition"
                  aria-label={`Remove ${formatTime(time)}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}

          <div className="flex items-center gap-2 mt-4">
            <input
              type="time"
              value={newTime}
              onChange={(event) => setNewTime(event.target.value)}
              className="schedule-input"
            />
            <button
              type="button"
              onClick={addReminderTime}
              className="reset-today-button flex items-center gap-2"
            >
              <Plus size={16} /> Add Time
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          SAVE SECTION
      ========================================================= */}

      <div className="save-section">
        <p className="save-status-text">
          {hasUnsavedChanges
            ? "You have unsaved changes."
            : "Your settings are up to date."}
        </p>

        <button
          type="button"
          className={`save-button ${!hasUnsavedChanges && !saved ? "disabled" : ""}`}
          onClick={saveGoal}
          disabled={!hasUnsavedChanges && !saved}
        >
          {saved
            ? "✓ Changes Saved"
            : hasUnsavedChanges
            ? "Save Goal"
            : "✓ Saved"}
        </button>
      </div>

      {/* =====================================================
          STYLES
      ========================================================= */}

      <style>{`
        .water-care-settings {
          width: 100%;
          max-width: 850px;
          margin: 0 auto;
          padding: 10px 0 40px;
          color: #374139;
        }

        .water-care-settings-header {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 4px;
          margin-bottom: 24px;
          border-bottom: 2px solid rgba(0, 0, 0, 0.05);
        }

        .back-button {
          width: 44px;
          height: 44px;
          border: 3px solid #000;
          border-radius: 14px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 3px 3px 0 #000;
          transition: 0.15s ease;
          flex-shrink: 0;
        }

        .back-button:hover {
          transform: translate(-1px, -1px);
          box-shadow: 4px 4px 0 #000;
        }

        .back-button:active {
          transform: translate(2px, 2px);
          box-shadow: 1px 1px 0 #000;
        }

        .water-care-settings-header h2 {
          margin: 0 0 4px;
          font-size: 28px;
          font-weight: 700;
        }

        .water-care-settings-header p {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .water-care-setting-card {
          background: #ffffff;
          border: 3px solid #000;
          border-radius: 22px;
          padding: 22px;
          margin-bottom: 20px;
          box-shadow: 5px 5px 0 #000;
        }

        .setting-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 22px;
        }

        .setting-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: #dbeafe;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }

        .clock-icon {
          background: #dcfce7;
        }

        .setting-header h3 {
          margin: 0 0 5px;
          font-size: 18px;
        }

        .setting-header p {
          margin: 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.5;
        }

        .goal-options {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .goal-option-pill {
          padding: 10px 18px;
          border: 2px solid #000;
          border-radius: 14px;
          background: #f8fafc;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .goal-option-pill:hover {
          transform: translateY(-2px);
        }

        .goal-option-pill.active {
          background: #bde3f4;
          box-shadow: 3px 3px 0 #000;
          transform: translate(-2px, -2px);
        }

        .schedule-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .schedule-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .schedule-number {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #dbeafe;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          flex-shrink: 0;
          border: 2px solid #000;
        }

        .schedule-label {
          width: 110px;
          font-size: 14px;
          font-weight: 600;
        }

        .schedule-input {
          width: 160px;
          padding: 10px 12px;
          border: 2px solid #000;
          border-radius: 12px;
          background: #f8fafc;
          font-size: 15px;
          font-family: inherit;
          outline: none;
        }

        .schedule-input:focus {
          background: #fff;
          box-shadow: 3px 3px 0 #000;
        }

        .save-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 24px 0;
        }

        .save-status-text {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
        }

        .save-button {
          padding: 12px 22px;
          border: 2px solid #000;
          border-radius: 14px;
          background: #bde3f4;
          box-shadow: 4px 4px 0 #000;
          font-family: inherit;
          font-weight: 700;
          cursor: pointer;
          transition: 0.15s ease;
        }

        .save-button:active:not(.disabled) {
          transform: translate(3px, 3px);
          box-shadow: 1px 1px 0 #000;
        }

        .save-button.disabled {
          background: #e2e8f0;
          opacity: 0.7;
          cursor: default;
          box-shadow: 2px 2px 0 #000;
        }

        .reset-today-button {
          padding: 11px 17px;
          border: 2px solid #000;
          border-radius: 12px;
          background: #ffffff;
          font-family: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        .reset-today-button:hover {
          background: #fef3c7;
        }
      `}</style>
    </div>
  );
};

/* =========================================================
   TIME FORMATTER
========================================================= */

const formatTime = (time) => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const date = new Date();
  date.setHours(Number(hours));
  date.setMinutes(Number(minutes));

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};

export default WaterSettings;