import React, { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DEFAULT_GOAL = 3;

const DEFAULT_SCHEDULE = [
  "10:30",
  "14:00",
  "17:00",
  "19:00",
  "21:00",
];

const getToday = () => new Date().toDateString();

const MoveResetSettings = () => {
  const navigate = useNavigate();

  // Saved values (synced with actual state/storage)
  const [savedGoal, setSavedGoal] = useState(DEFAULT_GOAL);
  const [savedSchedule, setSavedSchedule] = useState(
    DEFAULT_SCHEDULE.slice(0, DEFAULT_GOAL)
  );

  // Selected values (local state before saving)
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [schedule, setSchedule] = useState(
    DEFAULT_SCHEDULE.slice(0, DEFAULT_GOAL)
  );

  const [saved, setSaved] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  /* =========================================================
     LOAD SETTINGS
  ========================================================= */

  useEffect(() => {
    const savedGoal = localStorage.getItem("moveResetGoal");
    const savedSchedule = localStorage.getItem("moveResetSchedule");

    if (savedGoal) {
      const parsedGoal = Number(savedGoal);
      if (parsedGoal >= 1) {
        setSavedGoal(parsedGoal);
        setGoal(parsedGoal);
      }
    }

    if (savedSchedule) {
      try {
        const parsed = JSON.parse(savedSchedule);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedSchedule(parsed);
          setSchedule(parsed);
        }
      } catch (error) {
        console.error(
          "Failed to load movement settings:",
          error
        );
      }
    }
  }, []);

  /* =========================================================
     CHANGE GOAL
  ========================================================= */

  const handleGoalChange = (newGoal) => {
    setGoal(newGoal);

    setSchedule((previous) => {
      const updated = [...previous];

      while (updated.length < newGoal) {
        const nextDefault =
          DEFAULT_SCHEDULE[updated.length] ||
          "10:30";

        updated.push(nextDefault);
      }

      return updated.slice(0, newGoal);
    });
  };

  /* =========================================================
     CHANGE TIME
  ========================================================= */

  const handleScheduleChange = (index, value) => {
    setSchedule((previous) => {
      const updated = [...previous];
      updated[index] = value;
      return updated;
    });
  };

  /* =========================================================
     UNSAVED CHANGES CHECK
  ========================================================= */

  const hasUnsavedChanges =
    goal !== savedGoal ||
    JSON.stringify(schedule.slice(0, goal)) !== JSON.stringify(savedSchedule);

  /* =========================================================
     SAVE SETTINGS
  ========================================================= */

  const saveSettings = () => {
    const activeSchedule = schedule.slice(0, goal);

    localStorage.setItem("moveResetGoal", String(goal));
    localStorage.setItem(
      "moveResetSchedule",
      JSON.stringify(activeSchedule)
    );

    setSavedGoal(goal);
    setSavedSchedule(activeSchedule);

    window.dispatchEvent(
      new CustomEvent("wellnessSettingsUpdated", {
        detail: {
          goal,
          schedule: activeSchedule,
        },
      })
    );

    window.dispatchEvent(new Event("wellness-settings-updated"));

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  /* =========================================================
     RESET TODAY'S PROGRESS
  ========================================================= */

  const resetToday = () => {
    const today = getToday();

    localStorage.setItem("moveResetDate", today);
    localStorage.setItem("moveResetCompleted", "0");
    localStorage.removeItem("moveResetRewarded");

    window.dispatchEvent(new Event("moveResetTodayReset"));

    setResetMessage(
      "Today's movement progress has been reset."
    );

    setTimeout(() => {
      setResetMessage("");
    }, 2500);
  };

  return (
    <div className="move-care-settings">

      {/* =====================================================
          HEADER WITH BACK BUTTON
      ===================================================== */}

      <div className="move-care-settings-header">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="back-button"
          aria-label="Back to settings"
        >
          <ArrowLeft size={20} />
        </button>

        <div>
          <h2>Move & Reset</h2>
          <p>
            Customize your daily movement goal and reminder schedule.
          </p>
        </div>
      </div>

      {/* =====================================================
          DAILY GOAL
      ===================================================== */}

      <div className="move-care-setting-card">

        <div className="setting-header">

          <div className="setting-icon">
            🏃‍♂️
          </div>

          <div>
            <h3>Daily Movement Goal</h3>

            <p>
              Choose how many movement breaks you want to complete each day.
            </p>
          </div>

        </div>

        <div className="goal-options">

          {[2, 3, 4, 5].map((number) => (
            <button
              key={number}
              type="button"
              className={`goal-option ${
                goal === number ? "active" : ""
              }`}
              onClick={() => handleGoalChange(number)}
            >
              {number}
            </button>
          ))}

        </div>

        <div className="goal-summary">
          <strong>{goal}</strong> movement sessions per day
        </div>

      </div>

      {/* =====================================================
          SCHEDULE
      ===================================================== */}

      <div className="move-care-setting-card">

        <div className="setting-header">

          <div className="setting-icon clock-icon">
            ⏰
          </div>

          <div>
            <h3>Movement Schedule</h3>

            <p>
              Set the time for each of your daily movement intervals.
            </p>
          </div>

        </div>

        <div className="schedule-list">

          {schedule
            .slice(0, goal)
            .map((time, index) => (
              <div
                className="schedule-row"
                key={index}
              >

                <div className="schedule-number">
                  {index + 1}
                </div>

                <div className="schedule-label">
                  Move {index + 1}
                </div>

                <input
                  type="time"
                  value={time || ""}
                  onChange={(event) =>
                    handleScheduleChange(
                      index,
                      event.target.value
                    )
                  }
                  className="schedule-input"
                />

              </div>
            ))}

        </div>

      </div>

      {/* =====================================================
          SAVE SECTION (Water Settings Style)
      ===================================================== */}

      <div className="save-section">
        <p className="save-status-text">
          {hasUnsavedChanges
            ? "You have unsaved changes."
            : "Your settings are up to date."}
        </p>

        <button
          type="button"
          className={`save-button ${!hasUnsavedChanges && !saved ? "disabled" : ""}`}
          onClick={saveSettings}
          disabled={!hasUnsavedChanges && !saved}
        >
          {saved
            ? "✓ Changes Saved"
            : hasUnsavedChanges
            ? "Save Changes"
            : "✓ Saved"}
        </button>
      </div>

      {/* =====================================================
          RESET TODAY
      ===================================================== */}

      <div className="reset-card">

        <div className="reset-header">

          <div className="reset-icon">
            ↻
          </div>

          <div>
            <h3>Reset Today's Movement</h3>

            <p>
              Restart today's movement progress. Your goal and schedule will stay unchanged.
            </p>
          </div>

        </div>

        <button
          type="button"
          className="reset-today-button"
          onClick={resetToday}
        >
          Reset Today's Progress
        </button>

        {resetMessage && (
          <div className="reset-message">
            ✓ {resetMessage}
          </div>
        )}

      </div>

      {/* =====================================================
          STYLES
      ===================================================== */}

      <style>{`

        .move-care-settings {
          width: 100%;
          max-width: 850px;
          margin: 0 auto;
          padding: 10px 0 40px;
          color: #374139;
        }

        .move-care-settings-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
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

        .move-care-settings-header h2 {
          margin: 0 0 4px;
          font-size: 28px;
          font-weight: 700;
        }

        .move-care-settings-header p {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        .move-care-setting-card {
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

        .goal-option {
          width: 48px;
          height: 48px;
          border: 2px solid #000;
          border-radius: 14px;
          background: #f8fafc;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .goal-option:hover {
          transform: translateY(-2px);
        }

        .goal-option.active {
          background: #bde3f4;
          box-shadow: 3px 3px 0 #000;
          transform: translate(-2px, -2px);
        }

        .goal-summary {
          margin-top: 14px;
          color: #6b7280;
          font-size: 14px;
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
        }

        .schedule-label {
          width: 80px;
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

        /* RESET TODAY */

        .reset-card {
          padding: 20px;
          border: 3px solid #000;
          border-radius: 22px;
          background: #fff7ed;
          box-shadow: 5px 5px 0 #000;
        }

        .reset-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 18px;
        }

        .reset-icon {
          width: 45px;
          height: 45px;
          border-radius: 13px;
          background: #fed7aa;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .reset-header h3 {
          margin: 0 0 5px;
          font-size: 17px;
        }

        .reset-header p {
          margin: 0;
          color: #6b7280;
          font-size: 13px;
          line-height: 1.5;
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

        .reset-message {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: #dcfce7;
          color: #166534;
          font-size: 13px;
          font-weight: 600;
        }

        @media (max-width: 600px) {
          .move-care-setting-card {
            padding: 17px;
          }

          .schedule-label {
            display: none;
          }

          .schedule-input {
            flex: 1;
          }

          .save-section {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .save-button {
            width: 100%;
          }
        }

      `}</style>
    </div>
  );
};

export default MoveResetSettings;