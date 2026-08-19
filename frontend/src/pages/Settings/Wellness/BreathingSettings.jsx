import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

const DEFAULT_GOAL = 3;
const DEFAULT_SCHEDULE = ["10:00", "14:00", "18:00", "20:00", "22:00"];

const BreathingSettings = () => {
  const navigate = useNavigate();

  // Saved values (synced with localStorage)
  const [savedGoal, setSavedGoal] = useState(DEFAULT_GOAL);
  const [savedSchedule, setSavedSchedule] = useState(DEFAULT_SCHEDULE.slice(0, DEFAULT_GOAL));

  // Selected values (local state for editing)
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE.slice(0, DEFAULT_GOAL));

  const [saved, setSaved] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  /* =========================================================
     LOAD SETTINGS
  ========================================================= */

  useEffect(() => {
    const sGoal = localStorage.getItem("breathingGoal");
    const sSched = localStorage.getItem("breathingSchedule");

    if (sGoal) {
      const g = Number(sGoal);
      setSavedGoal(g);
      setGoal(g);
    }
    if (sSched) {
      try {
        const parsed = JSON.parse(sSched);
        setSavedSchedule(parsed);
        setSchedule(parsed);
      } catch (e) { console.error("Failed to load schedule", e); }
    }
  }, []);

  /* =========================================================
     HANDLERS
  ========================================================= */

  const handleGoalChange = (newGoal) => {
    setGoal(newGoal);
    setSchedule((prev) => {
      const updated = [...prev];
      while (updated.length < newGoal) updated.push(DEFAULT_SCHEDULE[updated.length] || "12:00");
      return updated.slice(0, newGoal);
    });
  };

  const handleScheduleChange = (index, value) => {
    setSchedule((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const hasUnsavedChanges = 
    goal !== savedGoal || 
    JSON.stringify(schedule) !== JSON.stringify(savedSchedule);

  const saveSettings = () => {
    localStorage.setItem("breathingGoal", String(goal));
    localStorage.setItem("breathingSchedule", JSON.stringify(schedule));
    
    setSavedGoal(goal);
    setSavedSchedule(schedule);

    window.dispatchEvent(new CustomEvent("wellnessSettingsUpdated", { 
      detail: { goal, schedule } 
    }));
    window.dispatchEvent(new Event("wellness-settings-updated"));

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const resetToday = () => {
    localStorage.setItem("breathingDate", new Date().toDateString());
    localStorage.setItem("breathingCompleted", "0");
    localStorage.removeItem("breathingRewarded");
    window.dispatchEvent(new Event("breathingTodayReset"));
    setResetMessage("Today's progress has been reset.");
    setTimeout(() => setResetMessage(""), 2500);
  };

  return (
    <div className="breathing-care-settings">
      <div className="breathing-care-settings-header">
        <button type="button" className="back-button" onClick={() => navigate("/settings")}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2>Breathe</h2>
          <p>Customize your daily breathing goals and reminder schedule.</p>
        </div>
      </div>

      {/* DAILY GOAL */}
      <div className="breathing-care-setting-card">
        <div className="setting-header">
          <div className="setting-icon">💨</div>
          <div>
            <h3>Daily Breathing Goal</h3>
            <p>Choose how many sessions to complete each day.</p>
          </div>
        </div>
        <div className="goal-options">
          {[2, 3, 4, 5].map((n) => (
            <button key={n} className={`goal-option ${goal === n ? "active" : ""}`} onClick={() => handleGoalChange(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* SCHEDULE */}
      <div className="breathing-care-setting-card">
        <div className="setting-header">
          <div className="setting-icon clock-icon">⏰</div>
          <div>
            <h3>Reminder Schedule</h3>
            <p>Set the time for each breathing session.</p>
          </div>
        </div>
        <div className="schedule-list">
          {schedule.map((time, index) => (
            <div className="schedule-row" key={index}>
              <div className="schedule-number">{index + 1}</div>
              <input type="time" value={time} onChange={(e) => handleScheduleChange(index, e.target.value)} className="schedule-input" />
            </div>
          ))}
        </div>
      </div>

      {/* SAVE SECTION */}
      <div className="save-section">
        <p className="save-status-text">{hasUnsavedChanges ? "You have unsaved changes." : "Settings up to date."}</p>
        <button type="button" className={`save-button ${!hasUnsavedChanges && !saved ? "disabled" : ""}`} onClick={saveSettings} disabled={!hasUnsavedChanges && !saved}>
          {saved ? "✓ Changes Saved" : hasUnsavedChanges ? "Save Changes" : "✓ Saved"}
        </button>
      </div>

      {/* RESET */}
      <div className="reset-card">
        <div className="reset-header">
          <div className="reset-icon">↻</div>
          <div>
            <h3>Reset Today's Progress</h3>
            <p>Restart today's count without changing your settings.</p>
          </div>
        </div>
        <button type="button" className="reset-today-button" onClick={resetToday}>Reset Today</button>
        {resetMessage && <div className="reset-message">✓ {resetMessage}</div>}
      </div>

      <style>{`
        .breathing-care-settings { width: 100%; max-width: 850px; margin: 0 auto; padding: 10px 0 40px; color: #374139; }
        .breathing-care-settings-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
        .back-button { width: 44px; height: 44px; border: 3px solid #000; border-radius: 14px; background: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 3px 3px 0 #000; }
        .breathing-care-setting-card { background: #fff; border: 3px solid #000; border-radius: 22px; padding: 22px; margin-bottom: 20px; box-shadow: 5px 5px 0 #000; }
        .setting-header { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
        .setting-icon { width: 48px; height: 48px; border-radius: 14px; background: #dcefdc; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .clock-icon { background: #dcfce7; }
        .goal-options { display: flex; gap: 10px; }
        .goal-option { width: 48px; height: 48px; border: 2px solid #000; border-radius: 14px; background: #f8fafc; font-weight: 700; cursor: pointer; }
        .goal-option.active { background: #dcefdc; box-shadow: 3px 3px 0 #000; transform: translate(-2px, -2px); }
        .schedule-list { display: flex; flex-direction: column; gap: 12px; }
        .schedule-row { display: flex; align-items: center; gap: 12px; }
        .schedule-number { width: 34px; height: 34px; border-radius: 50%; background: #dcefdc; display: flex; align-items: center; justify-content: center; font-weight: 700; }
        .schedule-input { width: 160px; padding: 10px 12px; border: 2px solid #000; border-radius: 12px; background: #f8fafc; outline: none; }
        .save-section { display: flex; align-items: center; justify-content: space-between; margin: 24px 0; }
        .save-button { padding: 12px 22px; border: 2px solid #000; border-radius: 14px; background: #dcefdc; box-shadow: 4px 4px 0 #000; font-weight: 700; cursor: pointer; }
        .save-button.disabled { background: #e2e8f0; opacity: 0.7; cursor: default; }
        .reset-card { padding: 20px; border: 3px solid #000; border-radius: 22px; background: #fff7ed; box-shadow: 5px 5px 0 #000; }
        .reset-today-button { padding: 11px 17px; border: 2px solid #000; border-radius: 12px; background: #fff; font-weight: 700; cursor: pointer; }
        .reset-message { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: #dcfce7; color: #166534; font-weight: 600; }
      `}</style>
    </div>
  );
};

export default BreathingSettings;