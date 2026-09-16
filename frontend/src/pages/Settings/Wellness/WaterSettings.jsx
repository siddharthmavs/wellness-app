import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Trophy,
  LockKeyhole,
  Clock3,
  RotateCcw,
  Droplets,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";

/* =========================================================
   WATER SETTINGS
========================================================= */

const WATER_GOAL_KEY = "waterGoal";
const WATER_SETTINGS_KEY = "wellness-water-settings";
const REWARD_CONFIG_KEY = "wellness-reward-config";

const DEFAULT_WATER_GOAL = 2000;
const DEFAULT_WATER_REWARD_GOAL = 2000;

const QUICK_GOALS = [
  1500,
  2000,
  2500,
  3000,
];

const DEFAULT_REMINDER_TIMES = [
  "10:00",
  "13:00",
  "16:00",
];

/* =========================================================
   REWARD GOAL
========================================================= */

const parseRewardGoal = (savedData) => {
  try {
    if (!savedData) {
      return DEFAULT_WATER_REWARD_GOAL;
    }

    const parsed =
      typeof savedData === "string"
        ? JSON.parse(savedData)
        : savedData;

    const rawGoal =
      parsed?.water?.rewardGoal ??
      parsed?.water?.reward_goal ??
      parsed?.rewardGoal ??
      parsed?.reward_goal;

    const goal = Number(rawGoal);

    return Number.isFinite(goal) && goal > 0
      ? goal
      : DEFAULT_WATER_REWARD_GOAL;
  } catch {
    return DEFAULT_WATER_REWARD_GOAL;
  }
};

/* =========================================================
   STORED WATER GOAL
========================================================= */

const getStoredWaterGoal = () => {
  try {
    const saved =
      localStorage.getItem(WATER_GOAL_KEY);

    const value = Number(saved);

    return Number.isFinite(value) &&
      value >= 500
      ? value
      : DEFAULT_WATER_GOAL;
  } catch {
    return DEFAULT_WATER_GOAL;
  }
};

/* =========================================================
   STORED REMINDERS
========================================================= */

const getStoredReminderTimes = () => {
  try {
    const saved =
      localStorage.getItem(WATER_SETTINGS_KEY);

    if (!saved) {
      return DEFAULT_REMINDER_TIMES;
    }

    const parsed =
      JSON.parse(saved);

    if (
      !Array.isArray(
        parsed?.reminderTimes
      )
    ) {
      return DEFAULT_REMINDER_TIMES;
    }

    return parsed.reminderTimes;
  } catch {
    return DEFAULT_REMINDER_TIMES;
  }
};

/* =========================================================
   COMPONENT
========================================================= */

export default function WaterSettings() {
  const navigate = useNavigate();

  /* =========================================================
     INITIAL VALUES
  ========================================================= */

  const initialGoal =
    getStoredWaterGoal();

  const initialSchedule =
    getStoredReminderTimes();

  /* =========================================================
     WATER GOAL
  ========================================================= */

  const [selectedGoal, setSelectedGoal] =
    useState(initialGoal);

  const [savedGoal, setSavedGoal] =
    useState(initialGoal);

  const [customGoal, setCustomGoal] =
    useState("");

  /* =========================================================
     ADMIN REWARD GOAL
  ========================================================= */

  const [rewardGoal, setRewardGoal] =
    useState(() => {
      const saved =
        localStorage.getItem(
          REWARD_CONFIG_KEY
        );

      return parseRewardGoal(saved);
    });

  /* =========================================================
     REMINDERS
  ========================================================= */

  const [schedule, setSchedule] =
    useState(initialSchedule);

  const [savedSchedule, setSavedSchedule] =
    useState(initialSchedule);

  const [newTime, setNewTime] =
    useState("");

  /* =========================================================
     SAVE / RESET
  ========================================================= */

  const [saving, setSaving] =
    useState(false);

  const [resetting, setResetting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  /* =========================================================
     UNSAVED CHANGES
  ========================================================= */

  const hasChanges =
    Number(selectedGoal) !==
      Number(savedGoal) ||
    JSON.stringify(schedule) !==
      JSON.stringify(savedSchedule);

  /* =========================================================
     LOAD BACKEND SETTINGS
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const loadSettings =
      async () => {
        try {
          const response =
            await api.get(
              "/settings"
            );

          const settings =
            response?.data || {};

          const water =
            settings?.water;

          if (
            !water ||
            !mounted
          ) {
            return;
          }

          /* -----------------------------
             WATER GOAL
          ----------------------------- */

          const backendGoal =
            Number(water.goal);

          if (
            Number.isFinite(
              backendGoal
            ) &&
            backendGoal >= 500
          ) {
            setSelectedGoal(
              backendGoal
            );

            setSavedGoal(
              backendGoal
            );

            localStorage.setItem(
              WATER_GOAL_KEY,
              String(
                backendGoal
              )
            );
          }

          /* -----------------------------
             REMINDER TIMES
          ----------------------------- */

          if (
            Array.isArray(
              water.reminder_times
            )
          ) {
            setSchedule(
              water.reminder_times
            );

            setSavedSchedule(
              water.reminder_times
            );

            localStorage.setItem(
              WATER_SETTINGS_KEY,
              JSON.stringify({
                reminderTimes:
                  water.reminder_times,
              })
            );
          }
        } catch {
          // Keep local settings.
        }
      };

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================================================
     ADMIN REWARD CONFIG SYNC
  ========================================================= */

  useEffect(() => {
    const updateRewardGoal =
      (detailData) => {
        if (detailData) {
          setRewardGoal(
            parseRewardGoal(
              detailData
            )
          );

          return;
        }

        const stored =
          localStorage.getItem(
            REWARD_CONFIG_KEY
          );

        setRewardGoal(
          parseRewardGoal(
            stored
          )
        );
      };

    const handleRewardUpdate =
      (event) => {
        updateRewardGoal(
          event?.detail
        );
      };

    const handleStorage =
      () => {
        updateRewardGoal();
      };

    window.addEventListener(
      "wellnessRewardsUpdated",
      handleRewardUpdate
    );

    window.addEventListener(
      "wellness-reward-config-updated",
      handleRewardUpdate
    );

    window.addEventListener(
      "wellnessSettingsUpdated",
      handleRewardUpdate
    );

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "wellnessRewardsUpdated",
        handleRewardUpdate
      );

      window.removeEventListener(
        "wellness-reward-config-updated",
        handleRewardUpdate
      );

      window.removeEventListener(
        "wellnessSettingsUpdated",
        handleRewardUpdate
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  /* =========================================================
     GOAL
  ========================================================= */

  const handleGoalChange =
    (amount) => {
      const safeAmount =
        Number(amount);

      if (
        !Number.isFinite(
          safeAmount
        ) ||
        safeAmount < 500
      ) {
        return;
      }

      setSelectedGoal(
        safeAmount
      );

      setCustomGoal("");

      setMessage("");
    };

  const handleCustomGoalChange =
    (value) => {
      setCustomGoal(value);

      const amount =
        Number(value);

      if (
        Number.isFinite(
          amount
        ) &&
        amount >= 500
      ) {
        setSelectedGoal(
          amount
        );
      }

      setMessage("");
    };

  /* =========================================================
     REMINDER SCHEDULE
  ========================================================= */

  const updateScheduleTime =
    (index, value) => {
      setSchedule(
        (current) =>
          current.map(
            (time, i) =>
              i === index
                ? value
                : time
          )
      );

      setMessage("");
    };

  const addReminderTime =
    () => {
      if (
        !newTime ||
        schedule.includes(
          newTime
        )
      ) {
        setNewTime("");
        return;
      }

      const nextSchedule = [
        ...schedule,
        newTime,
      ].sort();

      setSchedule(
        nextSchedule
      );

      setNewTime("");

      setMessage("");
    };

  const removeReminderTime =
    (index) => {
      const nextSchedule =
        schedule.filter(
          (_, i) =>
            i !== index
        );

      setSchedule(
        nextSchedule
      );

      setMessage("");
    };

  /* =========================================================
     SAVE
  ========================================================= */

  const handleSave = async () => {
    if (
      !hasChanges ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    const safeGoal =
      Number(selectedGoal) >= 500
        ? Number(selectedGoal)
        : DEFAULT_WATER_GOAL;

    const safeSchedule =
      schedule.filter(
        (time) =>
          typeof time ===
            "string" &&
          time.length > 0
      );

    try {
      /* -----------------------------
         LOCAL WATER GOAL
      ----------------------------- */

      localStorage.setItem(
        WATER_GOAL_KEY,
        String(safeGoal)
      );

      /* -----------------------------
         LOCAL REMINDERS
      ----------------------------- */

      localStorage.setItem(
        WATER_SETTINGS_KEY,
        JSON.stringify({
          reminderTimes:
            safeSchedule,
        })
      );

      /* -----------------------------
         BACKEND WATER GOAL
      ----------------------------- */

      try {
        await api.put(
          "/water/goal",
          {
            goal: safeGoal,
          }
        );
      } catch {
        // Keep local settings.
      }

      /* -----------------------------
         BACKEND REMINDERS
      ----------------------------- */

      try {
        await api.put(
          "/settings",
          {
            water: {
              reminder_times:
                safeSchedule,
            },
          }
        );
      } catch {
        // Keep local settings.
      }

      /* -----------------------------
         UPDATE STATE
      ----------------------------- */

      setSelectedGoal(
        safeGoal
      );

      setSavedGoal(
        safeGoal
      );

      setSchedule(
        safeSchedule
      );

      setSavedSchedule(
        safeSchedule
      );

      /* -----------------------------
         EVENTS
      ----------------------------- */

      window.dispatchEvent(
        new CustomEvent(
          "water-settings-updated",
          {
            detail: {
              goal: safeGoal,
              reminderTimes:
                safeSchedule,
            },
          }
        )
      );

      window.dispatchEvent(
        new CustomEvent(
          "wellnessSettingsUpdated",
          {
            detail: {
              water: {
                goal: safeGoal,
                reminderTimes:
                  safeSchedule,
              },
            },
          }
        )
      );

      window.dispatchEvent(
        new CustomEvent(
          "wellness-settings-updated",
          {
            detail: {
              water: {
                goal: safeGoal,
                reminderTimes:
                  safeSchedule,
              },
            },
          }
        )
      );
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     RESET TODAY
  ========================================================= */

  const handleResetToday =
    () => {
      setResetting(true);
      setMessage("");

      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      localStorage.removeItem(
        "waterDate"
      );

      localStorage.removeItem(
        "waterConsumed"
      );

      localStorage.removeItem(
        `waterRewardedMilestones-${today}`
      );

      try {
        if (
          typeof window.resetWaterToday ===
          "function"
        ) {
          window.resetWaterToday();
        }
      } catch {
        // Ignore callback errors.
      }

      window.dispatchEvent(
        new CustomEvent(
          "waterTodayReset"
        )
      );

      window.dispatchEvent(
        new CustomEvent(
          "water-progress-reset"
        )
      );

      setMessage(
        "Today's water progress has been reset."
      );

      window.setTimeout(() => {
        setResetting(false);
      }, 500);
    };

  /* =========================================================
     STYLES
  ========================================================= */

  const styles = {
    page: {
      minHeight: "100%",
      padding:
        "18px 24px 28px",
      background:
        "var(--cozy-bg)",
      color:
        "var(--cozy-text)",
    },

    container: {
      width: "100%",
      maxWidth: "900px",
      margin: "0 auto",
    },

    header: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginBottom: "18px",
    },

    backButton: {
      width: "40px",
      height: "40px",
      borderRadius: "12px",
      border:
        "1px solid var(--cozy-border)",
      background:
        "var(--cozy-surface)",
      color:
        "var(--cozy-text)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flexShrink: 0,
    },

    headerIcon: {
      width: "46px",
      height: "46px",
      borderRadius: "13px",
      background:
        "var(--cozy-primary)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },

    title: {
      margin: 0,
      fontSize:
        "clamp(1.35rem, 2.5vw, 1.8rem)",
      lineHeight: 1.1,
      fontWeight: 800,
      color:
        "var(--cozy-text)",
    },

    subtitle: {
      margin: "3px 0 0",
      color:
        "var(--cozy-muted)",
      fontSize: "0.82rem",
    },

    card: {
      background:
        "var(--cozy-surface)",
      border:
        "1px solid var(--cozy-border)",
      borderRadius: "18px",
      padding: "15px 17px",
      marginBottom: "12px",
      boxShadow:
        "0 4px 12px rgba(0, 0, 0, 0.04)",
    },

    cardHeader: {
      display: "flex",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: "12px",
      marginBottom: "12px",
    },

    cardTitleWrap: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      minWidth: 0,
    },

    cardIcon: {
      width: "36px",
      height: "36px",
      borderRadius: "11px",
      background:
        "var(--cozy-bg)",
      border:
        "1px solid var(--cozy-border)",
      color:
        "var(--cozy-text)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },

    cardTitle: {
      margin: 0,
      fontSize: "0.98rem",
      lineHeight: 1.2,
      fontWeight: 800,
      color:
        "var(--cozy-text)",
    },

    cardDescription: {
      margin: "2px 0 0",
      color:
        "var(--cozy-muted)",
      fontSize: "0.76rem",
      lineHeight: 1.3,
    },

    lockBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "6px 9px",
      borderRadius: "9px",
      background:
        "var(--cozy-bg)",
      border:
        "1px solid var(--cozy-border)",
      color:
        "var(--cozy-text)",
      fontSize: "0.7rem",
      fontWeight: 800,
      whiteSpace: "nowrap",
    },

    rewardValue: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "11px 13px",
      borderRadius: "13px",
      background:
        "var(--cozy-bg)",
      border:
        "1px solid var(--cozy-border)",
    },

    rewardNumber: {
      fontSize: "1.55rem",
      lineHeight: 1,
      fontWeight: 900,
      color:
        "var(--cozy-text)",
      whiteSpace: "nowrap",
    },

    rewardUnit: {
      marginLeft: "3px",
      fontSize: "0.72rem",
      fontWeight: 800,
      color:
        "var(--cozy-muted)",
    },

    rewardText: {
      color:
        "var(--cozy-text)",
      fontSize: "0.82rem",
      fontWeight: 800,
    },

    rewardSubtext: {
      marginTop: "2px",
      color:
        "var(--cozy-muted)",
      fontSize: "0.7rem",
    },

    label: {
      display: "block",
      marginBottom: "8px",
      fontSize: "0.8rem",
      fontWeight: 800,
      color:
        "var(--cozy-text)",
    },

    goalOptions: {
      display: "grid",
      gridTemplateColumns:
        "repeat(4, minmax(0, 1fr))",
      gap: "8px",
    },

    goalButton: {
      minHeight: "44px",
      borderRadius: "12px",
      border:
        "1px solid var(--cozy-border)",
      background:
        "var(--cozy-bg)",
      color:
        "var(--cozy-text)",
      fontSize: "0.82rem",
      fontWeight: 800,
      cursor: "pointer",
      transition:
        "background 0.18s ease, border-color 0.18s ease",
    },

    activeGoalButton: {
      background:
        "var(--cozy-primary)",
      borderColor:
        "var(--cozy-primary)",
      color: "#fff",
    },

    customGoalRow: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginTop: "12px",
      flexWrap: "wrap",
    },

    customInput: {
      width: "150px",
      minHeight: "39px",
      padding: "0 11px",
      borderRadius: "11px",
      border:
        "1px solid var(--cozy-border)",
      background:
        "var(--cozy-bg)",
      color:
        "var(--cozy-text)",
      fontSize: "0.82rem",
      fontWeight: 700,
      outline: "none",
      fontFamily: "inherit",
      colorScheme: "light",
    },

    selectedGoal: {
      color:
        "var(--cozy-muted)",
      fontSize: "0.76rem",
      fontWeight: 600,
    },

    selectedGoalStrong: {
      marginLeft: "3px",
      color:
        "var(--cozy-text)",
      fontWeight: 800,
    },

    scheduleList: {
      display: "flex",
      flexDirection: "column",
      gap: "7px",
    },

    scheduleRow: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },

    scheduleNumber: {
      width: "32px",
      height: "32px",
      borderRadius: "9px",
      background:
        "var(--cozy-bg)",
      border:
        "1px solid var(--cozy-border)",
      color:
        "var(--cozy-text)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "0.78rem",
      fontWeight: 900,
      flexShrink: 0,
    },

    /* =====================================================
       FIXED TIME INPUT
       Light mode = dark native clock icon
       Dark mode = light native clock icon
    ===================================================== */

    timeInput: {
      flex: 1,
      minHeight: "39px",
      padding: "0 11px",
      borderRadius: "11px",
      border:
        "1px solid var(--cozy-border)",
      background:
        "var(--cozy-bg)",
      color:
        "var(--cozy-text)",
      fontSize: "0.82rem",
      fontWeight: 700,
      outline: "none",
      fontFamily: "inherit",
      colorScheme: "light",
    },

    removeButton: {
      width: "34px",
      height: "34px",
      borderRadius: "9px",
      border:
        "1px solid var(--cozy-border)",
      background:
        "var(--cozy-bg)",
      color:
        "var(--cozy-text)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flexShrink: 0,
    },

    addButton: {
      marginTop: "8px",
      width: "100%",
      minHeight: "37px",
      borderRadius: "10px",
      border:
        "1px dashed var(--cozy-border)",
      background:
        "var(--cozy-bg)",
      color:
        "var(--cozy-text)",
      fontSize: "0.78rem",
      fontWeight: 800,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
    },

    resetCard: {
      background:
        "var(--cozy-surface)",
      border:
        "1px solid var(--cozy-border)",
      borderRadius: "18px",
      padding: "15px 17px",
      marginBottom: "12px",
    },

    resetButton: {
      width: "100%",
      minHeight: "40px",
      borderRadius: "11px",
      border:
        "1px solid var(--cozy-border)",
      background:
        "var(--cozy-bg)",
      color:
        "var(--cozy-text)",
      fontSize: "0.8rem",
      fontWeight: 800,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "7px",
    },

    message: {
      marginTop: "8px",
      padding: "8px 10px",
      borderRadius: "10px",
      background:
        "var(--cozy-bg)",
      border:
        "1px solid var(--cozy-border)",
      color:
        "var(--cozy-text)",
      fontSize: "0.75rem",
      fontWeight: 700,
      textAlign: "center",
    },

    saveCard: {
      background:
        "var(--cozy-primary)",
      borderRadius: "18px",
      padding: "10px",
      marginTop: "4px",
    },

    saveButton: {
      width: "100%",
      minHeight: "42px",
      border: "none",
      borderRadius: "11px",
      background:
        "var(--cozy-surface)",
      color:
        "var(--cozy-text)",
      fontSize: "0.84rem",
      fontWeight: 900,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "7px",
    },
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <>
      {/* =====================================================
          ADAPTIVE NATIVE TIME PICKER
      ===================================================== */}

      <style>{`
        .water-time-input {
          color-scheme: light !important;
        }

        .water-time-input::-webkit-calendar-picker-indicator {
          opacity: 1 !important;
          cursor: pointer;
          filter: brightness(0) saturate(100%);
        }

        .water-time-input:focus {
          border-color: var(--cozy-primary) !important;
          box-shadow: 0 0 0 2px rgba(127, 174, 98, 0.15);
        }

        html.dark .water-time-input {
          color-scheme: dark !important;
        }

        html.dark .water-time-input::-webkit-calendar-picker-indicator {
          opacity: 1 !important;
          filter: brightness(0) invert(1);
        }
      `}</style>

      <div style={styles.page}>
        <div style={styles.container}>

          {/* =====================================================
              HEADER
          ===================================================== */}

          <div style={styles.header}>
            <button
              type="button"
              style={styles.backButton}
              onClick={() =>
                navigate(-1)
              }
              aria-label="Go back"
            >
              <ArrowLeft size={19} />
            </button>

            <div
              style={
                styles.headerIcon
              }
            >
              <Droplets
                size={25}
                strokeWidth={2.5}
              />
            </div>

            <div>
              <h1
                style={styles.title}
              >
                Drink Water
              </h1>

              <p
                style={
                  styles.subtitle
                }
              >
                Customize your
                hydration goal and
                reminders.
              </p>
            </div>
          </div>

          {/* =====================================================
              REWARD GOAL
          ===================================================== */}

          <section
            style={styles.card}
          >
            <div
              style={
                styles.cardHeader
              }
            >
              <div
                style={
                  styles.cardTitleWrap
                }
              >
                <div
                  style={
                    styles.cardIcon
                  }
                >
                  <Trophy
                    size={18}
                    strokeWidth={2.4}
                  />
                </div>

                <div>
                  <h2
                    style={
                      styles.cardTitle
                    }
                  >
                    Reward Goal
                  </h2>

                  <p
                    style={
                      styles.cardDescription
                    }
                  >
                    Maximum daily
                    hydration rewards.
                  </p>
                </div>
              </div>

              <div
                style={
                  styles.lockBadge
                }
              >
                <LockKeyhole
                  size={12}
                />
                Admin
              </div>
            </div>

            <div
              style={
                styles.rewardValue
              }
            >
              <div
                style={
                  styles.rewardNumber
                }
              >
                {rewardGoal}

                <span
                  style={
                    styles.rewardUnit
                  }
                >
                  ml
                </span>
              </div>

              <div>
                <div
                  style={
                    styles.rewardText
                  }
                >
                  Daily hydration
                  reward
                </div>

                <div
                  style={
                    styles.rewardSubtext
                  }
                >
                  Controlled by your
                  organization
                  administrator.
                </div>
              </div>
            </div>
          </section>

          {/* =====================================================
              DAILY WATER GOAL
          ===================================================== */}

          <section
            style={styles.card}
          >
            <div
              style={
                styles.cardHeader
              }
            >
              <div
                style={
                  styles.cardTitleWrap
                }
              >
                <div
                  style={
                    styles.cardIcon
                  }
                >
                  <Droplets
                    size={18}
                    strokeWidth={2.4}
                  />
                </div>

                <div>
                  <h2
                    style={
                      styles.cardTitle
                    }
                  >
                    Daily Water Goal
                  </h2>

                  <p
                    style={
                      styles.cardDescription
                    }
                  >
                    Choose how much
                    water you want to
                    drink each day.
                  </p>
                </div>
              </div>
            </div>

            <label
              style={styles.label}
            >
              Daily hydration target
            </label>

            <div
              style={
                styles.goalOptions
              }
            >
              {QUICK_GOALS.map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      handleGoalChange(
                        value
                      )
                    }
                    style={{
                      ...styles.goalButton,
                      ...(Number(
                        selectedGoal
                      ) ===
                      Number(value)
                        ? styles.activeGoalButton
                        : {}),
                    }}
                  >
                    {value} ml
                  </button>
                )
              )}
            </div>

            <div
              style={
                styles.customGoalRow
              }
            >
              <input
                type="number"
                min="500"
                step="50"
                placeholder="Custom ml"
                value={customGoal}
                onChange={(event) =>
                  handleCustomGoalChange(
                    event.target.value
                  )
                }
                style={
                  styles.customInput
                }
                aria-label="Custom water goal"
              />

              <div
                style={
                  styles.selectedGoal
                }
              >
                Selected:

                <strong
                  style={
                    styles.selectedGoalStrong
                  }
                >
                  {selectedGoal} ml
                </strong>
              </div>
            </div>
          </section>

          {/* =====================================================
              WATER REMINDER SCHEDULE
          ===================================================== */}

          <section
            style={styles.card}
          >
            <div
              style={
                styles.cardHeader
              }
            >
              <div
                style={
                  styles.cardTitleWrap
                }
              >
                <div
                  style={
                    styles.cardIcon
                  }
                >
                  <Clock3
                    size={18}
                    strokeWidth={2.4}
                  />
                </div>

                <div>
                  <h2
                    style={
                      styles.cardTitle
                    }
                  >
                    Water Reminders
                  </h2>

                  <p
                    style={
                      styles.cardDescription
                    }
                  >
                    Choose when you would
                    like hydration
                    reminders.
                  </p>
                </div>
              </div>
            </div>

            <div
              style={
                styles.scheduleList
              }
            >
              {schedule.map(
                (time, index) => (
                  <div
                    key={`${index}-${time}`}
                    style={
                      styles.scheduleRow
                    }
                  >
                    <div
                      style={
                        styles.scheduleNumber
                      }
                    >
                      {index + 1}
                    </div>

                    <input
                      className="water-time-input"
                      type="time"
                      value={time}
                      onChange={(
                        event
                      ) =>
                        updateScheduleTime(
                          index,
                          event.target
                            .value
                        )
                      }
                      style={
                        styles.timeInput
                      }
                      aria-label={`Water reminder ${
                        index + 1
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        removeReminderTime(
                          index
                        )
                      }
                      style={
                        styles.removeButton
                      }
                      aria-label={`Remove water reminder ${
                        index + 1
                      }`}
                    >
                      <Trash2
                        size={16}
                      />
                    </button>
                  </div>
                )
              )}
            </div>

            {/* =================================================
                ADD NEW REMINDER
            ================================================= */}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <input
                className="water-time-input"
                type="time"
                value={newTime}
                onChange={(event) =>
                  setNewTime(
                    event.target.value
                  )
                }
                style={
                  styles.timeInput
                }
                aria-label="New water reminder time"
              />

              <button
                type="button"
                onClick={
                  addReminderTime
                }
                style={{
                  ...styles.addButton,
                  width: "auto",
                  flex: "0 0 auto",
                  padding:
                    "0 16px",
                  marginTop: 0,
                }}
              >
                <Plus size={16} />
                Add reminder
              </button>
            </div>
          </section>

          {/* =====================================================
              RESET TODAY
          ===================================================== */}

          <section
            style={
              styles.resetCard
            }
          >
            <div
              style={
                styles.cardHeader
              }
            >
              <div
                style={
                  styles.cardTitleWrap
                }
              >
                <div
                  style={
                    styles.cardIcon
                  }
                >
                  <RotateCcw
                    size={18}
                    strokeWidth={2.4}
                  />
                </div>

                <div>
                  <h2
                    style={
                      styles.cardTitle
                    }
                  >
                    Reset Today&apos;s
                    Progress
                  </h2>

                  <p
                    style={
                      styles.cardDescription
                    }
                  >
                    Start today&apos;s
                    water progress from
                    zero.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={
                handleResetToday
              }
              disabled={resetting}
              style={{
                ...styles.resetButton,
                opacity:
                  resetting
                    ? 0.6
                    : 1,
                cursor:
                  resetting
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              <RotateCcw
                size={16}
              />

              {resetting
                ? "Resetting..."
                : "Reset Today's Progress"}
            </button>

            {message && (
              <div
                style={
                  styles.message
                }
              >
                {message}
              </div>
            )}
          </section>

          {/* =====================================================
              SAVE
          ===================================================== */}

          <section
            style={
              styles.saveCard
            }
          >
            <button
              type="button"
              onClick={
                handleSave
              }
              disabled={
                saving ||
                !hasChanges
              }
              style={{
                ...styles.saveButton,
                opacity:
                  saving
                    ? 0.7
                    : 1,
                cursor:
                  saving ||
                  !hasChanges
                    ? "default"
                    : "pointer",
              }}
            >
              {saving ? (
                <>
                  <Check
                    size={17}
                    strokeWidth={3}
                  />
                  Saving...
                </>
              ) : hasChanges ? (
                <>
                  <Check
                    size={17}
                    strokeWidth={3}
                  />
                  Save 
                </>
              ) : (
                <>
                  <Check
                    size={17}
                    strokeWidth={3}
                  />
                  Saved
                </>
              )}
            </button>
          </section>

        </div>
      </div>
    </>
  );
}