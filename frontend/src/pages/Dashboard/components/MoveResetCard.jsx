import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Hand,
  PersonStanding,
  RotateCcw,
  X,
  Play,
  Pause,
} from "lucide-react";

import "./MoveResetCard.css";

import { businessNow, unscopedKey } from "../../../lib/userStorage";
import { api } from "../../../lib/api";
import MoveBreakSession from "./MoveBreakSession";

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_GOAL = 3;

const DEFAULT_SCHEDULE = [
  "10:30",
  "14:00",
  "17:00",
  "19:00",
  "21:00",
];

const REWARD_CONFIG_KEY = "wellness-reward-config";

/*
  This is only a safety fallback for the reward GOAL.

  IMPORTANT:
  No XP values are hardcoded here.

  Actual reward milestones and XP must come from:
  wellness-reward-config -> moveReset
*/
const DEFAULT_REWARD_GOAL = 3;

/*
  DO NOT hardcode reward XP here.

  Admin configuration is the only source for:
  - milestone threshold
  - milestone XP
*/
const DEFAULT_REWARDS = [];


/* =========================================================
   SOUND UTILITY
========================================================= */

const playSound = (type = "tick") => {
  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "tick") {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.1
      );

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === "beep") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.25
      );

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "complete") {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(
        880,
        ctx.currentTime + 0.1
      );

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.4
      );

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch {
    // Ignore audio context blocks
  }
};

/* =========================================================
   STORAGE HELPERS
========================================================= */

const getToday = () => {
  const date = businessNow();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const getSavedGoal = () => {
  const value = Number(
    localStorage.getItem("moveResetGoal")
  );

  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_GOAL;
};

const getSavedSchedule = () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem("moveResetSchedule")
    );

    if (Array.isArray(saved) && saved.length > 0) {
      return saved;
    }
  } catch {
    // Ignore invalid data
  }

  return DEFAULT_SCHEDULE;
};

/* =========================================================
   ADMIN REWARD CONFIG
========================================================= */

const getSavedRewardConfig = () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem(REWARD_CONFIG_KEY)
    );

    const config = saved?.moveReset;

    /*
      If Admin configuration does not exist,
      do NOT invent XP values.
    */
    if (!config) {
      return {
        rewardGoal: DEFAULT_REWARD_GOAL,
        milestones: DEFAULT_REWARDS,
      };
    }

    const rewardGoal = Number(config.rewardGoal);

    const milestones = Array.isArray(config.milestones)
      ? config.milestones
          .map((item) => ({
            threshold: Number(item.threshold),
            xp: Number(item.xp),
          }))
          .filter(
            (item) =>
              Number.isFinite(item.threshold) &&
              Number.isFinite(item.xp) &&
              item.threshold > 0 &&
              item.xp >= 0
          )
          .sort(
            (a, b) =>
              Number(a.threshold) - Number(b.threshold)
          )
      : [];

    return {
      rewardGoal:
        Number.isFinite(rewardGoal) && rewardGoal > 0
          ? rewardGoal
          : DEFAULT_REWARD_GOAL,

      /*
        If Admin has not configured milestones,
        keep this empty rather than using hardcoded XP.
      */
      milestones,
    };
  } catch {
    return {
      rewardGoal: DEFAULT_REWARD_GOAL,
      milestones: DEFAULT_REWARDS,
    };
  }
};

/* =========================================================
   DAILY DATA
========================================================= */

const loadDailyData = () => {
  const today = getToday();

  const savedDate = localStorage.getItem(
    "moveResetDate"
  );

  if (savedDate !== today) {
    localStorage.setItem("moveResetDate", today);
    localStorage.setItem("moveResetCompleted", "0");

    localStorage.removeItem(
      `moveResetRewardedMilestones-${today}`
    );
  }

  const completed = Number(
    localStorage.getItem("moveResetCompleted")
  );

  return Number.isFinite(completed) && completed >= 0
    ? completed
    : 0;
};

/* =========================================================
   REWARDED MILESTONES
========================================================= */

const loadRewardedMilestones = () => {
  const today = getToday();

  try {
    const saved = JSON.parse(
      localStorage.getItem(
        `moveResetRewardedMilestones-${today}`
      )
    );

    return Array.isArray(saved)
      ? saved
          .map(Number)
          .filter(Number.isFinite)
      : [];
  } catch {
    return [];
  }
};

const saveRewardedMilestones = (milestones) => {
  const today = getToday();

  localStorage.setItem(
    `moveResetRewardedMilestones-${today}`,
    JSON.stringify(milestones)
  );
};

/* =========================================================
   PROGRESS ITEMS
========================================================= */

const createProgressItems = (
  completed,
  activeGoal,
  schedule
) => {
  const safeGoal = Math.max(
    Number(activeGoal) || 1,
    1
  );

  const safeCompleted = Math.max(
    Number(completed) || 0,
    0
  );

  return Array.from(
    { length: safeGoal },
    (_, index) => ({
      index,
      time:
        schedule[index] ||
        `MOVE ${index + 1}`,

      completed: index < safeCompleted,

      current:
        index === safeCompleted &&
        safeCompleted < safeGoal,
    })
  );
};

/* =========================================================
   COMPONENT
========================================================= */

export default function MoveResetCard({
  onDailyGoalComplete,
}) {
  const [goal, setGoal] = useState(getSavedGoal);
  const [schedule, setSchedule] =
    useState(getSavedSchedule);

  /*
    Load the Admin reward configuration once initially.
  */
  const initialRewardConfig =
    getSavedRewardConfig();

  const rewardConfigRef = useRef(
    initialRewardConfig
  );

  const [rewardGoal, setRewardGoal] =
    useState(
      initialRewardConfig.rewardGoal
    );

  const [moveRewards, setMoveRewards] =
    useState(
      initialRewardConfig.milestones
    );

  const [completed, setCompleted] =
    useState(loadDailyData);

  const [rewardedMilestones, setRewardedMilestones] =
    useState(loadRewardedMilestones);

  const rewardedMilestonesRef = useRef(
    rewardedMilestones
  );

  const [
    workingTowardRewardGoal,
    setWorkingTowardRewardGoal,
  ] = useState(false);

  const [showGoalComplete, setShowGoalComplete] =
    useState(false);

  const [currentReward, setCurrentReward] =
    useState(null);

  const [showReward, setShowReward] =
    useState(false);

  const [pendingReward, setPendingReward] =
    useState(null);

  const [showExercise, setShowExercise] =
    useState(false);

  /* =========================================================
     GOALS
  ========================================================= */

  const personalGoal =
    Number(goal) || DEFAULT_GOAL;

  const adminRewardGoal =
    Number(rewardGoal) ||
    DEFAULT_REWARD_GOAL;

  const personalGoalComplete =
    completed >= personalGoal;

  const rewardGoalComplete =
    completed >= adminRewardGoal;

  const finalGoal = Math.max(
    personalGoal,
    adminRewardGoal
  );

  const allGoalsComplete =
    completed >= finalGoal;

  const activeProgressGoal =
    workingTowardRewardGoal
      ? adminRewardGoal
      : personalGoal;

  const safeActiveProgressGoal =
    Math.max(
      Number(activeProgressGoal) || 1,
      1
    );

  const progress = Math.min(
    Math.max(
      (completed /
        safeActiveProgressGoal) *
        100,
      0
    ),
    100
  );

  const progressItems = useMemo(
    () =>
      createProgressItems(
        completed,
        safeActiveProgressGoal,
        schedule
      ),
    [
      completed,
      safeActiveProgressGoal,
      schedule,
    ]
  );

  const canContinueTowardReward =
    personalGoalComplete &&
    !rewardGoalComplete &&
    personalGoal < adminRewardGoal;

  /* =========================================================
     LOAD PERSONAL SETTINGS
  ========================================================= */

  const loadSettings = useCallback(() => {
    setGoal(getSavedGoal());
    setSchedule(getSavedSchedule());
    setCompleted(loadDailyData());
  }, []);

  /* =========================================================
     LOAD ADMIN REWARD SETTINGS
  ========================================================= */

  const loadRewardSettings =
    useCallback(() => {
      const config =
        getSavedRewardConfig();

      /*
        Keep the ref synchronized immediately
        so reward calculations always use
        the latest Admin configuration.
      */
      rewardConfigRef.current = config;

      setRewardGoal(config.rewardGoal);
      setMoveRewards(config.milestones);
    }, []);

  /* =========================================================
     SETTINGS / ADMIN REWARD SYNC
  ========================================================= */

  useEffect(() => {
    const handleSettingsUpdate = (event) => {
      loadSettings();

      if (
        event?.detail?.moveReset ||
        event?.detail?.rewards
      ) {
        loadRewardSettings();
      }
    };

    const handleStorage = (event) => {
      if (
        unscopedKey(event.key) === "moveResetGoal" ||
        unscopedKey(event.key) === "moveResetSchedule" ||
        event.key === REWARD_CONFIG_KEY
      ) {
        loadSettings();
        loadRewardSettings();
      }
    };

    window.addEventListener(
      "wellnessSettingsUpdated",
      handleSettingsUpdate
    );

    window.addEventListener(
      "wellness-settings-updated",
      handleSettingsUpdate
    );

    window.addEventListener(
      "wellnessRewardsUpdated",
      loadRewardSettings
    );

    window.addEventListener(
      "storage",
      handleStorage
    );

    window.addEventListener(
      "focus",
      loadSettings
    );

    document.addEventListener(
      "visibilitychange",
      loadSettings
    );

    return () => {
      window.removeEventListener(
        "wellnessSettingsUpdated",
        handleSettingsUpdate
      );

      window.removeEventListener(
        "wellness-settings-updated",
        handleSettingsUpdate
      );

      window.removeEventListener(
        "wellnessRewardsUpdated",
        loadRewardSettings
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );

      window.removeEventListener(
        "focus",
        loadSettings
      );

      document.removeEventListener(
        "visibilitychange",
        loadSettings
      );
    };
  }, [
    loadSettings,
    loadRewardSettings,
  ]);

  /* =========================================================
     NEW DAY CHECK
  ========================================================= */

  useEffect(() => {
    const checkNewDay = () => {
      const today = getToday();

      const savedDate =
        localStorage.getItem(
          "moveResetDate"
        );

      if (savedDate !== today) {
        const newCompleted =
          loadDailyData();

        const newMilestones =
          loadRewardedMilestones();

        setCompleted(newCompleted);

        rewardedMilestonesRef.current =
          newMilestones;

        setRewardedMilestones(
          newMilestones
        );

        setWorkingTowardRewardGoal(
          false
        );

        setShowGoalComplete(false);
        setShowReward(false);
        setCurrentReward(null);
        setPendingReward(null);
      }
    };

    checkNewDay();

    const interval = setInterval(
      checkNewDay,
      30_000
    );

    return () =>
      clearInterval(interval);
  }, []);

  /* =========================================================
     SAVE COMPLETION
  ========================================================= */

  useEffect(() => {
    localStorage.setItem(
      "moveResetCompleted",
      String(completed)
    );

    localStorage.setItem(
      "moveResetDate",
      getToday()
    );
  }, [completed]);

  /* =========================================================
     SAVE REWARDED MILESTONES
  ========================================================= */

  useEffect(() => {
    rewardedMilestonesRef.current =
      rewardedMilestones;

    saveRewardedMilestones(
      rewardedMilestones
    );
  }, [rewardedMilestones]);

  /* =========================================================
     GLOBAL RESET
  ========================================================= */

  useEffect(() => {
    const resetToday = () => {
      localStorage.setItem(
        "moveResetDate",
        getToday()
      );

      localStorage.setItem(
        "moveResetCompleted",
        "0"
      );

      rewardedMilestonesRef.current = [];

      setCompleted(0);
      setRewardedMilestones([]);

      setWorkingTowardRewardGoal(false);

      setShowGoalComplete(false);
      setShowReward(false);

      setCurrentReward(null);
      setPendingReward(null);
    };

    window.resetMoveResetToday =
      resetToday;

    return () => {
      delete window.resetMoveResetToday;
    };
  }, []);

  /* =========================================================
     ADMIN MILESTONE CALCULATION

     IMPORTANT:
     Move & Reset rewards are COUNT BASED.

     Example:

     Admin config:
       goal = 5
       milestones:
         1 -> 10 XP
         2 -> 20 XP
         3 -> 30 XP
         4 -> 40 XP
         5 -> 50 XP

     Completing break #1 checks threshold 1.
     Completing break #2 checks threshold 2.
     etc.

     There is NO percentage calculation here.
  ========================================================= */

  const getReachedMilestones =
    useCallback(
      (
        previousCompleted,
        newCompleted
      ) => {
        const config =
          rewardConfigRef.current;

        const currentRewardGoal =
          Number(config.rewardGoal);

        const currentMilestones =
          config.milestones;

        if (
          currentRewardGoal <= 0 ||
          !Array.isArray(
            currentMilestones
          )
        ) {
          return [];
        }

        /*
          Keep completion counts inside
          the Admin reward goal.
        */
        const previousCount = Math.min(
          Math.max(
            Number(previousCompleted) || 0,
            0
          ),
          currentRewardGoal
        );

        const newCount = Math.min(
          Math.max(
            Number(newCompleted) || 0,
            0
          ),
          currentRewardGoal
        );

        /*
          Refresh the rewarded list before
          checking milestones.
        */
        const latestRewarded =
          loadRewardedMilestones();

        rewardedMilestonesRef.current =
          latestRewarded;

        /*
          A milestone is reached when:
          - new count is at/above its threshold
          - previous count was below it
          - it has not already been rewarded
        */
        return currentMilestones
          .filter((milestone) => {
            const threshold =
              Number(
                milestone.threshold
              );

            return (
              threshold > 0 &&
              newCount >= threshold &&
              previousCount < threshold
            );
          })
          .filter(
            (milestone) =>
              !latestRewarded.includes(
                Number(
                  milestone.threshold
                )
              )
          )
          .sort(
            (a, b) =>
              Number(a.threshold) -
              Number(b.threshold)
          );
      },
      []
    );

  /* =========================================================
     REWARD POPUP
  ========================================================= */

  const openRewardPopup =
    useCallback((milestone) => {
      if (!milestone) return;

      setCurrentReward({
        threshold: Number(
          milestone.threshold
        ),

        /*
          XP comes directly from Admin.
        */
        xp: Number(milestone.xp),
      });

      setShowReward(true);
    }, []);

  /* =========================================================
     START EXERCISE
  ========================================================= */

  const startExercise = () => {
    if (allGoalsComplete) return;
    setShowExercise(true);
  };

  const closeExercise = useCallback(() => {
    setShowExercise(false);
  }, []);

  /* =========================================================
     SERVER TRUTH FOR TODAY'S COUNT
     Completions are recorded by the server session, so the
     server's per-user daily log is authoritative across devices.
  ========================================================= */

  useEffect(() => {
    let alive = true;
    api
      .get("/move-reset/today")
      .then(({ data }) => {
        if (!alive || typeof data?.completed !== "number") return;
        localStorage.setItem("moveResetCompleted", String(data.completed));
        localStorage.setItem("moveResetDate", getToday());
        setCompleted(data.completed);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  /* =========================================================
     COMPLETE FULL MOVEMENT BREAK
  ========================================================= */

  const completeSession =
    useCallback((result) => {
      playSound("complete");

      // `result` comes from POST /move-reset/sessions/{id}/complete: the server has
      // validated the session and already awarded the points exactly once.
      const newCompleted =
        Number(result?.completed) || 0;

      const previousCompleted =
        Math.max(0, newCompleted - 1);

      window.dispatchEvent(new Event("points-changed"));

      localStorage.setItem(
        "moveResetCompleted",
        String(newCompleted)
      );

      localStorage.setItem(
        "moveResetDate",
        getToday()
      );

      setCompleted(newCompleted);

      /* =====================================================
         PERSONAL GOAL
      ===================================================== */

      const crossedPersonalGoal =
        previousCompleted <
          personalGoal &&
        newCompleted >= personalGoal;

      /* =====================================================
         ADMIN REWARD MILESTONES

         This now uses the Admin-configured
         COUNT thresholds directly.
      ===================================================== */

      const reachedMilestones =
        getReachedMilestones(
          previousCompleted,
          newCompleted
        );

      const newMilestones =
        reachedMilestones.filter(
          (milestone) =>
            !rewardedMilestonesRef.current.includes(
              Number(
                milestone.threshold
              )
            )
        );

      /* =====================================================
         SAVE REWARDED MILESTONES
      ===================================================== */

      if (newMilestones.length > 0) {
        const updated = [
          ...rewardedMilestonesRef.current,
          ...newMilestones.map(
            (milestone) =>
              Number(
                milestone.threshold
              )
          ),
        ];

        rewardedMilestonesRef.current =
          updated;

        setRewardedMilestones(updated);

        /* ===================================================
           AWARD ADMIN-CONFIGURED XP
        =================================================== */

        newMilestones.forEach(
          (milestone) => {
            onDailyGoalComplete?.({
              type:
                "move_reset_milestone",

              /*
                Threshold is the Admin-configured
                number of completed movement breaks.
              */
              threshold: Number(
                milestone.threshold
              ),

              /*
                XP comes directly from Admin.
                Nothing is hardcoded in this card.
              */
              reward: Number(
                milestone.xp
              ),

              completed:
                newCompleted,

              goal:
                Number(
                  rewardConfigRef.current
                    .rewardGoal
                ),
            });
          }
        );
      }

      const latestReward =
        newMilestones.length > 0
          ? newMilestones[
              newMilestones.length - 1
            ]
          : null;

      /* =====================================================
         PERSONAL GOAL COMPLETE BUT
         ADMIN REWARD GOAL NOT YET COMPLETE
      ===================================================== */

      if (
        crossedPersonalGoal &&
        personalGoal <
          adminRewardGoal &&
        newCompleted <
          adminRewardGoal
      ) {
        setPendingReward(
          latestReward
        );

        setShowGoalComplete(true);

        return;
      }

      /* =====================================================
         SHOW ADMIN REWARD
      ===================================================== */

      if (latestReward) {
        openRewardPopup(
          latestReward
        );
      }
    }, [
      adminRewardGoal,
      getReachedMilestones,
      onDailyGoalComplete,
      openRewardPopup,
      personalGoal,
    ]);

  /* =========================================================
     CONTINUE TOWARD ADMIN REWARD GOAL
  ========================================================= */

  const continueTowardRewardGoal = () => {
    setShowGoalComplete(false);

    setWorkingTowardRewardGoal(
      true
    );

    if (pendingReward) {
      openRewardPopup(
        pendingReward
      );

      setPendingReward(null);
    }
  };

  /* =========================================================
     FINISH FOR TODAY
  ========================================================= */

  const finishForToday = () => {
    setShowGoalComplete(false);

    if (pendingReward) {
      openRewardPopup(
        pendingReward
      );

      setPendingReward(null);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <>
      <div className="move-reset-card">
        <div className="move-card-header">
          <div>
            <div className="move-card-title">
              <PersonStanding
                size={20}
                strokeWidth={3}
              />

              <span>
                MOVE & RESET
              </span>
            </div>

            <p className="move-card-subtitle">
              Complete a full movement
              break to reset your body
              and mind.
            </p>
          </div>
        </div>

        <div className="move-activity-progress">
          <div className="move-progress-title">
            <span>
              {workingTowardRewardGoal
                ? "REWARD GOAL PROGRESS"
                : "TODAY'S MOVEMENT"}
            </span>

            <span>
              {completed} /{" "}
              {safeActiveProgressGoal}
            </span>
          </div>

          <div className="move-progress-bar">
            <motion.div
              className="move-progress-fill"
              initial={{
                width: 0,
              }}
              animate={{
                width: `${progress}%`,
              }}
              transition={{
                duration: 0.5,
              }}
            />
          </div>

          <div className="move-activity-icons">
            {progressItems.map(
              (item) => {
                const Icon =
                  item.index === 0
                    ? PersonStanding
                    : item.index === 1
                    ? RotateCcw
                    : Hand;

                return (
                  <React.Fragment
                    key={item.index}
                  >
                    <div className="move-progress-item">
                      <span className="move-time">
                        {item.time}
                      </span>

                      <motion.div
                        className={`move-progress-circle ${
                          item.completed
                            ? "completed"
                            : item.current
                            ? "current"
                            : ""
                        }`}
                        animate={
                          item.current
                            ? {
                                scale: [
                                  1,
                                  1.08,
                                  1,
                                ],
                              }
                            : {
                                scale: 1,
                              }
                        }
                        transition={{
                          duration: 1.2,
                          repeat:
                            item.current
                              ? Infinity
                              : 0,
                        }}
                      >
                        {item.completed ? (
                          <Check
                            size={18}
                            strokeWidth={3}
                          />
                        ) : (
                          <Icon
                            size={18}
                            strokeWidth={2.5}
                          />
                        )}
                      </motion.div>

                      <span
                        className={`move-status ${
                          item.completed
                            ? "done"
                            : item.current
                            ? "next"
                            : ""
                        }`}
                      >
                        {item.completed
                          ? "DONE"
                          : item.current
                          ? "NEXT"
                          : ""}
                      </span>
                    </div>

                    {item.index <
                      safeActiveProgressGoal -
                        1 && (
                      <div
                        className={`move-connector ${
                          item.index <
                          completed
                            ? "completed"
                            : ""
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              }
            )}
          </div>
        </div>

        <div className="move-status-message">
          {allGoalsComplete ? (
            "🎉 All movement goals completed!"
          ) : workingTowardRewardGoal ? (
            <>
              Keep going!{" "}
              <strong>
                {Math.max(
                  adminRewardGoal -
                    completed,
                  0
                )}
              </strong>{" "}
              more complete break
              {adminRewardGoal -
                completed ===
              1
                ? ""
                : "s"}{" "}
              to reach the reward
              goal.
            </>
          ) : personalGoalComplete ? (
            "Daily movement goal completed! Keep going if you want to earn more rewards."
          ) : (
            <>
              {personalGoal -
                completed}{" "}
              complete movement break
              {personalGoal -
                completed ===
              1
                ? ""
                : "s"}{" "}
              remaining
            </>
          )}
        </div>

        {!allGoalsComplete ? (
          <button
            type="button"
            className="move-start-button"
            onClick={startExercise}
          >
            <PersonStanding
              size={18}
              strokeWidth={3}
            />

            {workingTowardRewardGoal
              ? "KEEP MOVING"
              : personalGoalComplete
              ? "START ANOTHER BREAK"
              : "START MOVE BREAK"}
          </button>
        ) : (
          <div className="move-complete-state">
            <Check
              size={18}
              strokeWidth={3}
            />

            COMPLETED FOR TODAY
          </div>
        )}
      </div>

      {/* =====================================================
          GUIDED MOVE BREAK (server-validated session)
      ===================================================== */}

      <MoveBreakSession
        open={showExercise}
        onClose={closeExercise}
        onCompleted={completeSession}
      />

      {/* =====================================================
          PERSONAL GOAL COMPLETE POPUP
      ===================================================== */}

      <AnimatePresence>
        {showGoalComplete && (
          <motion.div
            className="move-reward-overlay"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
          >
            <motion.div
              className="move-reward-popup"
              initial={{
                scale: 0.9,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.9,
                opacity: 0,
              }}
            >
              <div className="reward-person">
                🎉
              </div>

              <h2>
                Daily Goal Complete!
              </h2>

              <p>
                You completed your
                personal movement goal
                of{" "}
                <strong>
                  {personalGoal}
                </strong>{" "}
                complete break
                {personalGoal === 1
                  ? ""
                  : "s"}.
              </p>

              {canContinueTowardReward ? (
                <>
                  <p>
                    Continue to{" "}
                    <strong>
                      {adminRewardGoal}
                    </strong>{" "}
                    complete breaks to
                    unlock more rewards.
                  </p>

                  <div className="move-goal-actions">
                    <button
                      type="button"
                      onClick={
                        continueTowardRewardGoal
                      }
                    >
                      CONTINUE
                    </button>

                    <button
                      type="button"
                      onClick={
                        finishForToday
                      }
                    >
                      FINISH FOR TODAY
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={
                    finishForToday
                  }
                >
                  DONE
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================
          ADMIN REWARD POPUP
      ===================================================== */}

      <AnimatePresence>
        {showReward &&
          currentReward && (
            <motion.div
              className="move-reward-overlay"
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
            >
              <motion.div
                className="move-reward-popup"
                initial={{
                  scale: 0.9,
                  opacity: 0,
                }}
                animate={{
                  scale: 1,
                  opacity: 1,
                }}
                exit={{
                  scale: 0.9,
                  opacity: 0,
                }}
              >
                <div className="reward-person">
                  🏆
                </div>

                <h2>
                  Reward Unlocked!
                </h2>

                <p>
                  You reached{" "}
                  <strong>
                    {
                      currentReward.threshold
                    }{" "}
                    movement break
                    {currentReward.threshold ===
                    1
                      ? ""
                      : "s"}
                  </strong>{" "}
                  of your Admin reward
                  goal.
                </p>

                {/*
                  This XP value is NOT hardcoded.

                  It is the XP configured by Admin
                  for this milestone.
                */}
                <div className="move-xp">
                  +
                  {
                    currentReward.xp
                  }{" "}
                  XP
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowReward(
                      false
                    );
                    setCurrentReward(
                      null
                    );
                  }}
                >
                  AWESOME
                </button>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>
    </>
  );
}