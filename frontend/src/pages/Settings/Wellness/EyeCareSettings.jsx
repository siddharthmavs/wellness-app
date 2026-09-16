import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Trophy,
  LockKeyhole,
  Clock3,
  RotateCcw,
  Eye,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";

/* =========================================================
   EYE CARE SETTINGS
========================================================= */

const DEFAULT_GOAL = 3;
const DEFAULT_REWARD_GOAL = 3;
const MAX_GOAL = 5;

const DEFAULT_SCHEDULE = [
  "10:00",
  "13:00",
  "16:00",
  "18:00",
  "20:00",
  "21:00",
];

const REWARD_CONFIG_KEY = "wellness-reward-config";
const GOAL_KEY = "eyeBreakGoal";
const SCHEDULE_KEY = "eyeBreakSchedule";

/* =========================================================
   STORAGE HELPERS
========================================================= */

const getStoredRewardGoal = () => {
  try {
    const stored = localStorage.getItem(
      REWARD_CONFIG_KEY
    );

    if (!stored) {
      return DEFAULT_REWARD_GOAL;
    }

    const parsed = JSON.parse(stored);

    const value =
      parsed?.eyeBreak?.rewardGoal ??
      parsed?.eye_break?.rewardGoal ??
      parsed?.eyeBreak?.reward_goal ??
      parsed?.eye_break?.reward_goal ??
      parsed?.rewardGoal ??
      DEFAULT_REWARD_GOAL;

    return Math.min(
      Math.max(
        Number(value) || DEFAULT_REWARD_GOAL,
        1
      ),
      MAX_GOAL
    );
  } catch {
    return DEFAULT_REWARD_GOAL;
  }
};

const getStoredGoal = () => {
  try {
    const stored =
      localStorage.getItem(GOAL_KEY);

    if (!stored) {
      return DEFAULT_GOAL;
    }

    const value = Number(stored);

    if (!Number.isFinite(value)) {
      return DEFAULT_GOAL;
    }

    return Math.min(
      Math.max(value, 2),
      MAX_GOAL
    );
  } catch {
    return DEFAULT_GOAL;
  }
};

const getStoredSchedule = () => {
  try {
    const stored =
      localStorage.getItem(SCHEDULE_KEY);

    if (!stored) {
      return DEFAULT_SCHEDULE;
    }

    const parsed = JSON.parse(stored);

    if (
      !Array.isArray(parsed) ||
      parsed.length === 0
    ) {
      return DEFAULT_SCHEDULE;
    }

    return parsed;
  } catch {
    return DEFAULT_SCHEDULE;
  }
};

const createScheduleForGoal = (
  goal,
  currentSchedule
) => {
  const base =
    Array.isArray(currentSchedule) &&
    currentSchedule.length
      ? [...currentSchedule]
      : [...DEFAULT_SCHEDULE];

  const fallbackTimes = [
    "09:00",
    "10:00",
    "11:30",
    "13:00",
    "14:30",
    "16:00",
    "18:00",
    "20:00",
    "21:00",
  ];

  if (goal <= base.length) {
    return base.slice(0, goal);
  }

  const result = [...base];

  while (result.length < goal) {
    result.push(
      fallbackTimes[result.length] ||
        "21:00"
    );
  }

  return result;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function EyeCareSettings() {
  const navigate = useNavigate();

  const initialGoal =
    getStoredGoal();

  const initialSchedule =
    createScheduleForGoal(
      initialGoal,
      getStoredSchedule()
    );

  /* =========================================================
     THEME DETECTION

     This is important for the native time picker.
     It prevents the clock/control from becoming
     white and invisible in bright mode.
  ========================================================= */

  const getIsDarkMode = () => {
    if (
      typeof document === "undefined"
    ) {
      return false;
    }

    return document.documentElement.classList.contains(
      "dark"
    );
  };

  const [isDarkMode, setIsDarkMode] =
    useState(getIsDarkMode);

  useEffect(() => {
    if (
      typeof document === "undefined"
    ) {
      return undefined;
    }

    const updateTheme = () => {
      setIsDarkMode(
        document.documentElement.classList.contains(
          "dark"
        )
      );
    };

    updateTheme();

    const observer =
      new MutationObserver(
        updateTheme
      );

    observer.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ["class"],
      }
    );

    return () => {
      observer.disconnect();
    };
  }, []);

  /* =========================================================
     REWARD GOAL
  ========================================================= */

  const [rewardGoal, setRewardGoal] =
    useState(getStoredRewardGoal);

  /* =========================================================
     PERSONAL GOAL
  ========================================================= */

  const [goal, setGoal] =
    useState(initialGoal);

  const [schedule, setSchedule] =
    useState(initialSchedule);

  const [savedGoal, setSavedGoal] =
    useState(initialGoal);

  const [savedSchedule, setSavedSchedule] =
    useState(initialSchedule);

  /* =========================================================
     UI STATE
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
    Number(goal) !== Number(savedGoal) ||
    JSON.stringify(schedule) !==
      JSON.stringify(savedSchedule);

  /* =========================================================
     LOAD BACKEND SETTINGS
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const response =
          await api.get("/settings");

        const settings =
          response?.data || {};

        const backendRewardGoal =
          settings?.eye_break?.reward_goal ??
          settings?.eye_break?.rewardGoal ??
          settings?.eyeBreak?.reward_goal ??
          settings?.eyeBreak?.rewardGoal;

        const backendGoal =
          settings?.eye_break?.goal ??
          settings?.eyeBreak?.goal;

        const backendSchedule =
          settings?.eye_break?.schedule ??
          settings?.eyeBreak?.schedule;

        if (!mounted) {
          return;
        }

        /* =====================================================
           ADMIN REWARD GOAL
        ===================================================== */

        let nextRewardGoal =
          getStoredRewardGoal();

        if (
          Number.isFinite(
            Number(backendRewardGoal)
          )
        ) {
          nextRewardGoal =
            Math.min(
              Math.max(
                Number(
                  backendRewardGoal
                ),
                1
              ),
              MAX_GOAL
            );

          setRewardGoal(
            nextRewardGoal
          );

          try {
            const existing =
              JSON.parse(
                localStorage.getItem(
                  REWARD_CONFIG_KEY
                ) || "{}"
              );

            localStorage.setItem(
              REWARD_CONFIG_KEY,
              JSON.stringify({
                ...existing,
                eyeBreak: {
                  ...(existing?.eyeBreak ||
                    {}),
                  rewardGoal:
                    nextRewardGoal,
                },
              })
            );
          } catch {
            // Ignore localStorage errors.
          }
        }

        /* =====================================================
           PERSONAL EYE CARE GOAL
        ===================================================== */

        const nextGoal =
          Number.isFinite(
            Number(backendGoal)
          )
            ? Math.min(
                Math.max(
                  Number(
                    backendGoal
                  ),
                  2
                ),
                MAX_GOAL
              )
            : getStoredGoal();

        /* =====================================================
           SCHEDULE
        ===================================================== */

        const nextSchedule =
          Array.isArray(
            backendSchedule
          )
            ? createScheduleForGoal(
                nextGoal,
                backendSchedule
              )
            : createScheduleForGoal(
                nextGoal,
                getStoredSchedule()
              );

        setRewardGoal(
          nextRewardGoal
        );

        setGoal(nextGoal);
        setSchedule(nextSchedule);

        setSavedGoal(nextGoal);
        setSavedSchedule(
          nextSchedule
        );

        localStorage.setItem(
          GOAL_KEY,
          String(nextGoal)
        );

        localStorage.setItem(
          SCHEDULE_KEY,
          JSON.stringify(
            nextSchedule
          )
        );
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
     ADMIN REWARD CONFIG UPDATE
  ========================================================= */

  useEffect(() => {
    const handleRewardUpdate = (
      event
    ) => {
      const detail =
        event?.detail;

      if (detail) {
        const incoming =
          detail?.eyeBreak
            ?.rewardGoal ??
          detail?.eyeBreak
            ?.reward_goal ??
          detail?.eye_break
            ?.rewardGoal ??
          detail?.eye_break
            ?.reward_goal;

        if (
          Number.isFinite(
            Number(incoming)
          )
        ) {
          const next =
            Math.min(
              Math.max(
                Number(incoming),
                1
              ),
              MAX_GOAL
            );

          setRewardGoal(next);
          return;
        }
      }

      setRewardGoal(
        getStoredRewardGoal()
      );
    };

    const handleStorage = () => {
      setRewardGoal(
        getStoredRewardGoal()
      );
    };

    window.addEventListener(
      "wellness-reward-config-updated",
      handleRewardUpdate
    );

    window.addEventListener(
      "wellnessRewardsUpdated",
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
        "wellness-reward-config-updated",
        handleRewardUpdate
      );

      window.removeEventListener(
        "wellnessRewardsUpdated",
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

  const handleGoalChange = (
    value
  ) => {
    const nextGoal =
      Math.min(
        Math.max(
          Number(value),
          2
        ),
        MAX_GOAL
      );

    setGoal(nextGoal);

    setSchedule(
      (currentSchedule) =>
        createScheduleForGoal(
          nextGoal,
          currentSchedule
        )
    );

    setMessage("");
  };

  /* =========================================================
     SCHEDULE
  ========================================================= */

  const updateScheduleTime = (
    index,
    value
  ) => {
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

  const addScheduleTime = () => {
    if (
      schedule.length >=
      MAX_GOAL
    ) {
      return;
    }

    const fallbackTimes = [
      "09:00",
      "10:00",
      "11:30",
      "13:00",
      "14:30",
      "16:00",
      "18:00",
      "20:00",
      "21:00",
    ];

    const nextTime =
      fallbackTimes[
        schedule.length
      ] || "21:00";

    const nextSchedule = [
      ...schedule,
      nextTime,
    ];

    setSchedule(
      nextSchedule
    );

    setGoal(
      Math.min(
        Math.max(
          nextSchedule.length,
          2
        ),
        MAX_GOAL
      )
    );

    setMessage("");
  };

  const removeScheduleTime = (
    index
  ) => {
    if (
      schedule.length <= 2
    ) {
      return;
    }

    const nextSchedule =
      schedule.filter(
        (_, i) =>
          i !== index
      );

    setSchedule(
      nextSchedule
    );

    setGoal(
      Math.min(
        Math.max(
          nextSchedule.length,
          2
        ),
        MAX_GOAL
      )
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
      Math.min(
        Math.max(
          Number(goal) ||
            DEFAULT_GOAL,
          2
        ),
        MAX_GOAL
      );

    const safeSchedule =
      createScheduleForGoal(
        safeGoal,
        schedule
      );

    try {
      /* =====================================================
         LOCAL STORAGE
      ===================================================== */

      localStorage.setItem(
        GOAL_KEY,
        String(safeGoal)
      );

      localStorage.setItem(
        SCHEDULE_KEY,
        JSON.stringify(
          safeSchedule
        )
      );

      /* =====================================================
         BACKEND
      ===================================================== */

      try {
        await api.put(
          "/settings",
          {
            eye_break: {
              goal: safeGoal,
              schedule:
                safeSchedule,
            },
          }
        );
      } catch {
        // Keep local settings.
      }

      /* =====================================================
         STATE
      ===================================================== */

      setGoal(safeGoal);

      setSchedule(
        safeSchedule
      );

      setSavedGoal(
        safeGoal
      );

      setSavedSchedule(
        safeSchedule
      );

      /* =====================================================
         EVENTS
      ===================================================== */

      window.dispatchEvent(
        new CustomEvent(
          "wellnessSettingsUpdated",
          {
            detail: {
              eyeBreak: {
                goal: safeGoal,
                schedule:
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
              eyeBreak: {
                goal: safeGoal,
                schedule:
                  safeSchedule,
              },
            },
          }
        )
      );

      window.dispatchEvent(
        new CustomEvent(
          "eyeBreak-settings-updated",
          {
            detail: {
              goal: safeGoal,
              schedule:
                safeSchedule,
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

  const handleResetToday = () => {
    setResetting(true);
    setMessage("");

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    localStorage.removeItem(
      "eyeBreakDate"
    );

    localStorage.removeItem(
      "eyeBreakCompleted"
    );

    localStorage.removeItem(
      "eyeBreakRewarded"
    );

    localStorage.removeItem(
      "eyeBreakCompletedSlots"
    );

    localStorage.removeItem(
      `eyeBreakRewardedMilestones-${today}`
    );

    try {
      if (
        typeof window.resetEyeBreakToday ===
        "function"
      ) {
        window.resetEyeBreakToday();
      }
    } catch {
      // Ignore reset callback errors.
    }

    window.dispatchEvent(
      new CustomEvent(
        "eyeBreakTodayReset"
      )
    );

    window.dispatchEvent(
      new CustomEvent(
        "eyeBreak-progress-reset"
      )
    );

    setMessage(
      "Today's Eye Care progress has been reset."
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
      padding: "18px 24px 28px",
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

       Bright mode:
       colorScheme = light

       Dark mode:
       colorScheme = dark

       This controls the native browser time-picker
       clock/icon and popup appearance.
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

      /*
        IMPORTANT:
        Do NOT use "light dark" here.
        It can cause the bright-mode clock
        to become white/invisible.

        Instead the value is controlled
        dynamically from isDarkMode.
      */
      colorScheme:
        isDarkMode
          ? "dark"
          : "light",

      WebkitAppearance:
        "auto",
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
            style={styles.headerIcon}
          >
            <Eye
              size={25}
              strokeWidth={2.5}
            />
          </div>

          <div>
            <h1
              style={styles.title}
            >
              Eye Care
            </h1>

            <p
              style={styles.subtitle}
            >
              Give your eyes regular
              breaks throughout the
              workday.
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
                  Maximum daily Eye Care
                  rewards
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
            </div>

            <div>
              <div
                style={
                  styles.rewardText
                }
              >
                Eye Care breaks
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
            DAILY GOAL
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
                <Eye
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
                  Daily Eye Care
                  Goal
                </h2>

                <p
                  style={
                    styles.cardDescription
                  }
                >
                  Choose how many Eye
                  Care breaks you want
                  to complete.
                </p>
              </div>
            </div>
          </div>

          <label
            style={styles.label}
          >
            Breaks per day
          </label>

          <div
            style={
              styles.goalOptions
            }
          >
            {[2, 3, 4, 5].map(
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
                    ...(goal === value
                      ? styles.activeGoalButton
                      : {}),
                  }}
                >
                  {value}
                  {" breaks"}
                </button>
              )
            )}
          </div>
        </section>

        {/* =====================================================
            EYE BREAK SCHEDULE
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
                  Eye Break
                  Schedule
                </h2>

                <p
                  style={
                    styles.cardDescription
                  }
                >
                  Choose when you would
                  like your Eye Care
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
                    type="time"
                    value={time}
                    onChange={(
                      event
                    ) =>
                      updateScheduleTime(
                        index,
                        event.target.value
                      )
                    }
                    style={
                      styles.timeInput
                    }
                    aria-label={`Eye Care reminder ${
                      index + 1
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      removeScheduleTime(
                        index
                      )
                    }
                    disabled={
                      schedule.length <=
                      2
                    }
                    style={{
                      ...styles.removeButton,
                      opacity:
                        schedule.length <=
                        2
                          ? 0.45
                          : 1,
                      cursor:
                        schedule.length <=
                        2
                          ? "not-allowed"
                          : "pointer",
                    }}
                    aria-label={`Remove Eye Care reminder ${
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

          {schedule.length <
            MAX_GOAL && (
            <button
              type="button"
              onClick={
                addScheduleTime
              }
              style={
                styles.addButton
              }
            >
              <Plus size={16} />
              Add reminder
            </button>
          )}
        </section>

        {/* =====================================================
            RESET
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
                  Start today&apos;s Eye
                  Care progress from
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
  );
}