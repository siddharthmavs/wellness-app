import React, { useEffect, useState } from "react";
import { ArrowLeft, Droplets, Plus, Trash2, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const WATER_GOAL_KEY = "waterGoal";
const WATER_SETTINGS_KEY = "wellness-water-settings";
const REWARD_CONFIG_KEY = "wellness-reward-config";

const DEFAULT_WATER_REWARD_GOAL = 2000;
const QUICK_GOALS = [1500, 2000, 2500, 3000];

const parseRewardGoal = (savedData) => {
  try {
    if (!savedData) return DEFAULT_WATER_REWARD_GOAL;
    const parsed = typeof savedData === "string" ? JSON.parse(savedData) : savedData;
    const rawGoal = parsed?.water?.rewardGoal ?? parsed?.rewardGoal;
    const goal = Number(rawGoal);
    return Number.isFinite(goal) && goal > 0 ? goal : DEFAULT_WATER_REWARD_GOAL;
  } catch (error) {
    console.error("Failed to parse reward goal:", error);
    return DEFAULT_WATER_REWARD_GOAL;
  }
};

const WaterSettings = () => {
  const navigate = useNavigate();

  const [savedGoal, setSavedGoal] = useState(() => {
    const saved = localStorage.getItem(WATER_GOAL_KEY);
    return saved ? Number(saved) : 2000;
  });

  const [selectedGoal, setSelectedGoal] = useState(() => {
    const saved = localStorage.getItem(WATER_GOAL_KEY);
    return saved ? Number(saved) : 2000;
  });

  const [customGoal, setCustomGoal] = useState("");

  const [rewardGoal, setRewardGoal] = useState(() => {
    const saved = localStorage.getItem(REWARD_CONFIG_KEY);
    return parseRewardGoal(saved);
  });

  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(WATER_SETTINGS_KEY);
      if (saved) {
        return { reminderTimes: ["10:00", "13:00", "16:00"], ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error(e);
    }
    return { reminderTimes: ["10:00", "13:00", "16:00"] };
  });

  const [newTime, setNewTime] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    localStorage.setItem(WATER_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const updateGoalFromStorage = (detailData) => {
      if (detailData) {
        const goal = parseRewardGoal(detailData);
        setRewardGoal(goal);
      } else {
        const stored = localStorage.getItem(REWARD_CONFIG_KEY);
        setRewardGoal(parseRewardGoal(stored));
      }
    };

    const handleRewardsUpdated = (event) => {
      updateGoalFromStorage(event?.detail);
    };

    const handleStorageEvent = () => {
      updateGoalFromStorage();
    };

    window.addEventListener("wellnessRewardsUpdated", handleRewardsUpdated);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener("wellnessRewardsUpdated", handleRewardsUpdated);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, []);

  const hasUnsavedChanges = selectedGoal !== savedGoal;

  const selectGoal = (amount) => {
    if (!amount || amount < 500) return;
    setSelectedGoal(amount);
    setCustomGoal("");
  };

  const handleCustomGoalChange = (value) => {
    setCustomGoal(value);
    const amount = Number(value);
    if (amount >= 500) setSelectedGoal(amount);
  };

  const saveGoal = () => {
    if (!selectedGoal || selectedGoal < 500) return;
    localStorage.setItem(WATER_GOAL_KEY, String(selectedGoal));
    setSavedGoal(selectedGoal);
    window.dispatchEvent(new Event("water-settings-updated"));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetTodayProgress = () => {
    const today = new Date().toDateString();
    localStorage.setItem("waterDate", today);
    localStorage.setItem("waterConsumed", "0");
    localStorage.removeItem(`waterRewardedMilestones-${today}`);
    window.dispatchEvent(new Event("water-progress-reset"));
  };

  const addReminderTime = () => {
    if (!newTime || settings.reminderTimes.includes(newTime)) {
      setNewTime("");
      return;
    }
    setSettings((prev) => ({
      ...prev,
      reminderTimes: [...prev.reminderTimes, newTime].sort(),
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
      <div className="water-care-settings-header">
        <button type="button" onClick={() => navigate("/settings")} className="back-button" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2>Drink Water</h2>
          <p>Customize your hydration goal and reminders.</p>
        </div>
      </div>

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
          {QUICK_GOALS.map((goal) => (
            <button
              key={goal}
              type="button"
              className={`goal-option-pill ${selectedGoal === goal ? "active" : ""}`}
              onClick={() => selectGoal(goal)}
            >
              {goal} ml
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="number"
            min="500"
            step="50"
            placeholder="Custom ml"
            value={customGoal}
            onChange={(e) => handleCustomGoalChange(e.target.value)}
            className="schedule-input"
          />
          <span className="text-sm font-bold opacity-60">Selected: {selectedGoal} ml</span>
        </div>
      </div>

      <div className="water-care-setting-card reward-goal-card">
        <div className="setting-header">
          <div className="setting-icon reward-setting-icon">
            <Trophy size={22} />
          </div>
          <div>
            <h3>Reward Goal</h3>
            <p>Set by your organization to calculate hydration rewards.</p>
          </div>
        </div>
        <div className="reward-goal-display">
          <div className="reward-goal-value">
            {rewardGoal}
            <span>ml</span>
          </div>
          <div className="reward-goal-readonly">🔒 Set by Admin</div>
        </div>
      </div>

      <div className="water-care-setting-card">
        <div className="setting-header">
          <div className="setting-icon clock-icon">⏰</div>
          <div>
            <h3>Water Reminders</h3>
            <p>Remind me to drink water throughout the day.</p>
          </div>
        </div>

        <div className="schedule-list">
          {settings.reminderTimes.map((time, index) => (
            <div className="schedule-row" key={time}>
              <div className="schedule-number">{index + 1}</div>
              <div className="schedule-label">{time}</div>
              <button
                type="button"
                onClick={() => removeReminderTime(time)}
                className="p-2 border-2 border-black rounded-xl bg-red-50 hover:bg-red-100 transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-4">
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="schedule-input"
            />
            <button type="button" onClick={addReminderTime} className="reset-today-button flex items-center gap-2">
              <Plus size={16} />
              Add Time
            </button>
          </div>
        </div>
      </div>

      <div className="water-care-setting-card reset-progress-card">
        <div className="setting-header">
          <div className="setting-icon reset-icon">↻</div>
          <div>
            <h3>Reset Today's Progress</h3>
            <p>Start your water progress from 0 ml for today.</p>
          </div>
        </div>
        <button type="button" className="reset-progress-button" onClick={resetTodayProgress}>
          ↻ Reset Today's Progress
        </button>
      </div>

      <div className="save-section">
        <p className="save-status-text">
          {hasUnsavedChanges ? "You have unsaved changes." : "Your settings are up to date."}
        </p>
        <button
          type="button"
          className={`save-button ${!hasUnsavedChanges && !saved ? "disabled" : ""}`}
          onClick={saveGoal}
          disabled={!hasUnsavedChanges && !saved}
        >
          {saved ? "✓ Changes Saved" : hasUnsavedChanges ? "Save Goal" : "✓ Saved"}
        </button>
      </div>

      <style>{`
        .water-care-settings { width: 100%; max-width: 850px; margin: 0 auto; padding: 10px 0 40px; color: #374139; }
        .water-care-settings-header { display: flex; align-items: center; gap: 16px; padding: 16px 4px; margin-bottom: 24px; border-bottom: 2px solid rgba(0, 0, 0, 0.05); }
        .back-button { width: 44px; height: 44px; border: 3px solid #000; border-radius: 14px; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 3px 3px 0 #000; }
        .water-care-setting-card { background: #fff; border: 3px solid #000; border-radius: 22px; padding: 22px; margin-bottom: 20px; box-shadow: 5px 5px 0 #000; }
        .setting-header { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
        .setting-icon { width: 48px; height: 48px; border-radius: 14px; background: #dbeafe; display: flex; align-items: center; justify-content: center; }
        .clock-icon { background: #dcfce7; }
        .goal-options { display: flex; gap: 10px; flex-wrap: wrap; }
        .goal-option-pill { padding: 10px 18px; border: 2px solid #000; border-radius: 14px; background: #f8fafc; font-size: 15px; font-weight: 700; cursor: pointer; }
        .goal-option-pill.active { background: #bde3f4; box-shadow: 3px 3px 0 #000; transform: translate(-2px, -2px); }
        .reward-goal-card { background: #fffbeb; }
        .reward-setting-icon { background: #fef3c7; }
        .reward-goal-display { display: flex; align-items: center; justify-content: space-between; padding: 16px; border: 2px solid #000; border-radius: 16px; background: #fff; }
        .reward-goal-value { font-size: 30px; font-weight: 800; }
        .reward-goal-readonly { padding: 7px 12px; border: 2px solid #000; border-radius: 10px; background: #f1f5f9; font-size: 12px; font-weight: 800; }
        .schedule-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .schedule-number { width: 34px; height: 34px; border-radius: 50%; background: #dbeafe; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid #000; }
        .schedule-label { width: 110px; font-weight: 600; }
        .schedule-input { width: 160px; padding: 10px 12px; border: 2px solid #000; border-radius: 12px; background: #f8fafc; }
        .reset-progress-card { background: #fff7ed; }
        .reset-icon { background: #fed7aa; font-weight: 800; display: flex; align-items: center; justify-content: center; }
        .reset-progress-button { padding: 11px 18px; border: 2px solid #000; border-radius: 12px; background: #fff; box-shadow: 3px 3px 0 #000; font-weight: 700; cursor: pointer; }
        .save-section { display: flex; align-items: center; justify-content: space-between; margin: 24px 0; }
        .save-button { padding: 12px 22px; border: 2px solid #000; border-radius: 14px; background: #bde3f4; box-shadow: 4px 4px 0 #000; font-weight: 700; cursor: pointer; }
        .save-button.disabled { background: #e2e8f0; opacity: 0.7; cursor: default; }
      `}</style>
    </div>
  );
};

export default WaterSettings;