import React, { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";

const DEFAULT_GOAL = 3;
const DEFAULT_REWARD_GOAL = 3;

const DEFAULT_SCHEDULE = [
  "10:30",
  "14:00",
  "17:00",
  "19:00",
  "21:00",
];

const REWARD_CONFIG_KEY = "wellness-reward-config";
const MOVE_GOAL_KEY = "moveResetGoal";
const MOVE_SCHEDULE_KEY = "moveResetSchedule";

/* =========================================================
   REWARD GOAL PARSER
========================================================= */

const parseRewardGoal = (savedData) => {
  try {
    if (!savedData) {
      return DEFAULT_REWARD_GOAL;
    }

    const parsed =
      typeof savedData === "string"
        ? JSON.parse(savedData)
        : savedData;

    const rawGoal =
      parsed?.moveReset?.rewardGoal ??
      parsed?.rewardGoal;

    const parsedGoal = Number(rawGoal);

    return Number.isFinite(parsedGoal) && parsedGoal > 0
      ? parsedGoal
      : DEFAULT_REWARD_GOAL;
  } catch (error) {
    console.error(
      "Failed to parse movement reward goal:",
      error
    );

    return DEFAULT_REWARD_GOAL;
  }
};

const MoveResetSettings = () => {
  const navigate = useNavigate();

  /* =========================================================
     PERSONAL GOAL
  ========================================================= */

  const [savedGoal, setSavedGoal] = useState(() => {
    const saved = Number(
      localStorage.getItem(MOVE_GOAL_KEY)
    );

    return saved > 0 ? saved : DEFAULT_GOAL;
  });

  const [goal, setGoal] = useState(() => {
    const saved = Number(
      localStorage.getItem(MOVE_GOAL_KEY)
    );

    return saved > 0 ? saved : DEFAULT_GOAL;
  });

  /* =========================================================
     PERSONAL SCHEDULE
  ========================================================= */

  const [savedSchedule, setSavedSchedule] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(MOVE_SCHEDULE_KEY)
      );

      return Array.isArray(saved) && saved.length > 0
        ? saved
        : DEFAULT_SCHEDULE.slice(0, DEFAULT_GOAL);
    } catch {
      return DEFAULT_SCHEDULE.slice(0, DEFAULT_GOAL);
    }
  });

  const [schedule, setSchedule] = useState(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(MOVE_SCHEDULE_KEY)
      );

      return Array.isArray(saved) && saved.length > 0
        ? saved
        : DEFAULT_SCHEDULE.slice(0, DEFAULT_GOAL);
    } catch {
      return DEFAULT_SCHEDULE.slice(0, DEFAULT_GOAL);
    }
  });

  /* =========================================================
     ADMIN REWARD GOAL
  ========================================================= */

  const [rewardGoal, setRewardGoal] = useState(() => {
    const saved = localStorage.getItem(
      REWARD_CONFIG_KEY
    );

    return parseRewardGoal(saved);
  });

  const [saved, setSaved] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  /* =========================================================
     LOAD ADMIN REWARD GOAL
  ========================================================= */

  const loadRewardGoal = useCallback(() => {
    const stored = localStorage.getItem(
      REWARD_CONFIG_KEY
    );

    setRewardGoal(parseRewardGoal(stored));
  }, []);

  /* =========================================================
     SYNC ADMIN REWARD SETTINGS
  ========================================================= */

  useEffect(() => {
    loadRewardGoal();

    const handleRewardsUpdated = (event) => {
      if (event?.detail) {
        setRewardGoal(
          parseRewardGoal(event.detail)
        );
      } else {
        loadRewardGoal();
      }
    };

    const handleStorage = (event) => {
      if (
        !event?.key ||
        event.key === REWARD_CONFIG_KEY
      ) {
        loadRewardGoal();
      }
    };

    window.addEventListener(
      "wellnessRewardsUpdated",
      handleRewardsUpdated
    );

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "wellnessRewardsUpdated",
        handleRewardsUpdated
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, [loadRewardGoal]);

  // Backend is the source of truth; localStorage is only a fallback for offline use.
  useEffect(() => {
    api.get("/settings").then(({ data }) => {
      const mr = data?.move_reset;
      if (!mr) return;
      if (typeof mr.goal === "number") {
        setSavedGoal(mr.goal);
        setGoal(mr.goal);
      }
      if (Array.isArray(mr.schedule) && mr.schedule.length > 0) {
        setSavedSchedule(mr.schedule);
        setSchedule(mr.schedule);
      }
    }).catch(() => {});
  }, []);

  /* =========================================================
     CHANGE PERSONAL GOAL
  ========================================================= */

  const handleGoalChange = (newGoal) => {
    setGoal(newGoal);

    setSchedule((previous) => {
      const updated = [...previous];

      while (updated.length < newGoal) {
        const nextDefault =
          DEFAULT_SCHEDULE[updated.length] ||
          "21:00";

        updated.push(nextDefault);
      }

      return updated.slice(0, newGoal);
    });
  };

  /* =========================================================
     CHANGE SCHEDULE
  ========================================================= */

  const handleScheduleChange = (index, value) => {
    setSchedule((previous) => {
      const updated = [...previous];

      updated[index] = value;

      return updated;
    });
  };

  /* =========================================================
     UNSAVED CHANGES
  ========================================================= */

  const activeSchedule = schedule.slice(0, goal);

  const hasUnsavedChanges =
    goal !== savedGoal ||
    JSON.stringify(activeSchedule) !==
      JSON.stringify(savedSchedule);

  /* =========================================================
     SAVE PERSONAL SETTINGS
  ========================================================= */

  const saveSettings = () => {
    const finalSchedule =
      schedule.slice(0, goal);

    localStorage.setItem(
      MOVE_GOAL_KEY,
      String(goal)
    );

    localStorage.setItem(
      MOVE_SCHEDULE_KEY,
      JSON.stringify(finalSchedule)
    );

    setSavedGoal(goal);
    setSavedSchedule(finalSchedule);

    api.put("/settings", { move_reset: { goal, schedule: finalSchedule } }).catch(() => {});

    window.dispatchEvent(
      new CustomEvent(
        "wellnessSettingsUpdated",
        {
          detail: {
            goal,
            schedule: finalSchedule,
          },
        }
      )
    );

    window.dispatchEvent(
      new Event("wellness-settings-updated")
    );

    /* Also notify MoveResetCard specifically */
    window.dispatchEvent(
      new CustomEvent(
        "moveReset-settings-updated",
        {
          detail: {
            goal,
            schedule: finalSchedule,
          },
        }
      )
    );

    setSaved(true);

    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  /* =========================================================
     RESET TODAY'S PROGRESS
  ========================================================= */

  const resetToday = () => {
    const today = new Date().toDateString();

    localStorage.setItem(
      "moveResetDate",
      today
    );

    localStorage.setItem(
      "moveResetCompleted",
      "0"
    );

    localStorage.removeItem(
      "moveResetRewarded"
    );

    localStorage.removeItem(
      "moveResetCompletedSlots"
    );

    localStorage.removeItem(
      `moveResetRewardedMilestones-${today}`
    );

    /* Direct reset function if MoveResetCard provides it */
    if (
      typeof window.resetMoveResetToday ===
      "function"
    ) {
      window.resetMoveResetToday();
    }

    /* Reset event */
    window.dispatchEvent(
      new Event("moveResetTodayReset")
    );

    /* Additional progress-reset event */
    window.dispatchEvent(
      new Event("moveReset-progress-reset")
    );

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
          HEADER
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
            Customize your daily movement goal and
            reminder schedule.
          </p>
        </div>

      </div>

      {/* =====================================================
          PERSONAL DAILY GOAL
      ===================================================== */}

      <div className="move-care-setting-card">

        <div className="setting-header">

          <div className="setting-icon">
            🏃‍♂️
          </div>

          <div>
            <h3>Daily Movement Goal</h3>

            <p>
              Choose how many movement breaks you
              want to complete each day.
            </p>
          </div>

        </div>

        <div className="goal-options">

          {[2, 3, 4, 5].map((number) => (
            <button
              key={number}
              type="button"
              className={`goal-option ${
                goal === number
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                handleGoalChange(number)
              }
            >
              {number}
            </button>
          ))}

        </div>

        <div className="goal-summary">
          <strong>{goal}</strong>{" "}
          movement sessions per day
        </div>

      </div>

      {/* =====================================================
          ADMIN REWARD GOAL
      ===================================================== */}

      <div className="move-care-setting-card reward-goal-card">

        <div className="setting-header">

          <div className="setting-icon reward-setting-icon">
            <Trophy size={22} />
          </div>

          <div>
            <h3>Reward Goal</h3>

            <p>
              Set by your organization to calculate
              movement rewards.
            </p>
          </div>

        </div>

        <div className="reward-goal-display">

          <div className="reward-goal-value">
            {rewardGoal}{" "}
            <span>sessions</span>
          </div>

          <div className="reward-goal-readonly">
            🔒 Set by Admin
          </div>

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
              Set the time for each of your daily
              movement intervals.
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
          SAVE SECTION
      ===================================================== */}

      <div className="save-section">

        <p className="save-status-text">
          {hasUnsavedChanges
            ? "You have unsaved changes."
            : "Your settings are up to date."}
        </p>

        <button
          type="button"
          className={`save-button ${
            !hasUnsavedChanges && !saved
              ? "disabled"
              : ""
          }`}
          onClick={saveSettings}
          disabled={
            !hasUnsavedChanges && !saved
          }
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
            <h3>
              Reset Today's Movement
            </h3>

            <p>
              Restart today's movement progress.
              Your goal and schedule will stay
              unchanged.
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

        /* =====================================================
           REWARD GOAL
        ===================================================== */

        .reward-goal-card {
          background: #fffbeb;
        }

        .reward-setting-icon {
          background: #fef3c7;
        }

        .reward-goal-display {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border: 2px solid #000;
          border-radius: 16px;
          background: #fff;
        }

        .reward-goal-value {
          font-size: 30px;
          font-weight: 800;
        }

        .reward-goal-value span {
          font-size: 15px;
          font-weight: 600;
          color: #6b7280;
        }

        .reward-goal-readonly {
          padding: 7px 12px;
          border: 2px solid #000;
          border-radius: 10px;
          background: #f1f5f9;
          font-size: 12px;
          font-weight: 800;
        }

        /* =====================================================
           GOAL OPTIONS
        ===================================================== */

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

        /* =====================================================
           SCHEDULE
        ===================================================== */

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

        /* =====================================================
           SAVE
        ===================================================== */

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

        /* =====================================================
           RESET
        ===================================================== */

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

        /* =====================================================
           MOBILE
        ===================================================== */

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

          .reward-goal-display {
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
          }

          .reward-goal-readonly {
            align-self: flex-start;
          }
        }

      `}</style>
    </div>
  );
};

export default MoveResetSettings;