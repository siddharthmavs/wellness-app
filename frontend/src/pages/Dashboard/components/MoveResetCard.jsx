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
} from "lucide-react";

import "./MoveResetCard.css";

import handStretch from "./assets/hand-stretch.png";
import fingerExercise from "./assets/finger-exercise.png";
import neckStretch from "./assets/neck-stretch.png";
import walking from "./assets/walking.png";
import shoulderRolling from "./assets/shoulder-rolling.png";

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

const DEFAULT_REWARD_GOAL = 3;

const DEFAULT_REWARDS = [
  { threshold: 50, xp: 10 },
  { threshold: 75, xp: 20 },
  { threshold: 100, xp: 50 },
];

/*
  One MOVE BREAK consists of ALL five exercises.
  Completing an individual exercise does NOT increase
  the daily movement count.
*/

const ACTIVITIES = [
  {
    name: "Hand Stretching",
    preview: "Get ready to stretch your fingers and palms gently.",
    description:
      "Stretch your fingers and palms gently.",
    duration: 5,
    image: handStretch,
  },
  {
    name: "Finger Stretch",
    preview: "Prepare to relax and stretch each finger slowly.",
    description:
      "Relax and stretch each finger slowly.",
    duration: 5,
    image: fingerExercise,
  },
  {
    name: "Neck Relax",
    preview: "Get ready to release tension from your neck and shoulders.",
    description:
      "Release tension from your neck and shoulders.",
    duration: 5,
    image: neckStretch,
  },
  {
    name: "Shoulder Rolling",
    preview: "Prepare to roll your shoulders slowly and relax.",
    description:
      "Roll your shoulders slowly and relax.",
    duration: 5,
    image: shoulderRolling,
  },
  {
    name: "Walking",
    preview: "Get ready to stand up and walk around.",
    description:
      "Stand up and walk around for a moment.",
    duration: 5,
    image: walking,
  },
];

/* =========================================================
   SOUND UTILITY (Web Audio API)
========================================================= */

const playSound = (type = "tick") => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "tick") {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === "beep") {
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Higher pitch beep
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === "complete") {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
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
  const date = new Date();

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
    // Ignore invalid data.
  }

  return DEFAULT_SCHEDULE;
};

const getSavedRewardConfig = () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem(REWARD_CONFIG_KEY)
    );

    const config = saved?.moveReset;

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
              Number.isFinite(item.xp)
          )
      : DEFAULT_REWARDS;

    return {
      rewardGoal:
        Number.isFinite(rewardGoal) && rewardGoal > 0
          ? rewardGoal
          : DEFAULT_REWARD_GOAL,

      milestones:
        milestones.length > 0
          ? milestones
          : DEFAULT_REWARDS,
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

  const savedDate =
    localStorage.getItem("moveResetDate");

  if (savedDate !== today) {
    localStorage.setItem(
      "moveResetDate",
      today
    );

    localStorage.setItem(
      "moveResetCompleted",
      "0"
    );

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

      completed:
        index < safeCompleted,

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
  onAction,
  onDailyGoalComplete,
}) {
  /* =======================================================
     USER SETTINGS
  ======================================================= */

  const [goal, setGoal] =
    useState(getSavedGoal);

  const [schedule, setSchedule] =
    useState(getSavedSchedule);

  /* =======================================================
     REWARD SETTINGS
  ======================================================= */

  const initialRewardConfig =
    getSavedRewardConfig();

  const rewardConfigRef =
    useRef(initialRewardConfig);

  const [rewardGoal, setRewardGoal] =
    useState(
      initialRewardConfig.rewardGoal
    );

  const [moveRewards, setMoveRewards] =
    useState(
      initialRewardConfig.milestones
    );

  /* =======================================================
     DAILY PROGRESS
  ======================================================= */

  const [completed, setCompleted] =
    useState(loadDailyData);

  const [
    rewardedMilestones,
    setRewardedMilestones,
  ] = useState(
    loadRewardedMilestones
  );

  const rewardedMilestonesRef =
    useRef(rewardedMilestones);

  /* =======================================================
     REWARD MODE
  ======================================================= */

  const [
    workingTowardRewardGoal,
    setWorkingTowardRewardGoal,
  ] = useState(false);

  /* =======================================================
     POPUPS
  ======================================================= */

  const [
    showGoalComplete,
    setShowGoalComplete,
  ] = useState(false);

  const [
    currentReward,
    setCurrentReward,
  ] = useState(null);

  const [
    showReward,
    setShowReward,
  ] = useState(false);

  const [
    pendingReward,
    setPendingReward,
  ] = useState(null);

  /* =======================================================
     EXERCISE SESSION
  ======================================================= */

  const [
    showExercise,
    setShowExercise,
  ] = useState(false);

  const [
    activityIndex,
    setActivityIndex,
  ] = useState(0);

  const [
    remaining,
    setRemaining,
  ] = useState(0);

  const [
    isPreparing,
    setIsPreparing,
  ] = useState(false);

  const [
    isPreviewing,
    setIsPreviewing,
  ] = useState(false);

  const [
    isTransitioning,
    setIsTransitioning,
  ] = useState(false);

  /* =======================================================
     DERIVED VALUES
  ======================================================= */

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

  const currentActivity =
    ACTIVITIES[activityIndex];

  /* =======================================================
     LOAD SETTINGS
  ======================================================= */

  const loadSettings = useCallback(() => {
    setGoal(getSavedGoal());
    setSchedule(getSavedSchedule());
    setCompleted(loadDailyData());
  }, []);

  /* =======================================================
     LOAD REWARD SETTINGS
  ======================================================= */

  const loadRewardSettings =
    useCallback(() => {
      const config =
        getSavedRewardConfig();

      rewardConfigRef.current =
        config;

      setRewardGoal(
        config.rewardGoal
      );

      setMoveRewards(
        config.milestones
      );
    }, []);

  /* =======================================================
     SETTINGS EVENTS
  ======================================================= */

  useEffect(() => {
    const handleSettingsUpdate =
      (event) => {
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
        event.key ===
          "moveResetGoal" ||
        event.key ===
          "moveResetSchedule" ||
        event.key ===
          REWARD_CONFIG_KEY
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

  /* =======================================================
     NEW DAY CHECK
  ======================================================= */

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

  /* =======================================================
     PERSIST DAILY PROGRESS
  ======================================================= */

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

  /* =======================================================
     PERSIST REWARDED MILESTONES
  ======================================================= */

  useEffect(() => {
    rewardedMilestonesRef.current =
      rewardedMilestones;

    saveRewardedMilestones(
      rewardedMilestones
    );
  }, [rewardedMilestones]);

  /* =======================================================
     RESET API
  ======================================================= */

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

      rewardedMilestonesRef.current =
        [];

      setCompleted(0);
      setRewardedMilestones([]);

      setWorkingTowardRewardGoal(
        false
      );

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

  /* =======================================================
     REWARD MILESTONE CALCULATION
  ======================================================= */

  const getReachedMilestones =
    useCallback(
      (
        previousCompleted,
        newCompleted
      ) => {
        const config =
          rewardConfigRef.current;

        const goal =
          Number(config.rewardGoal) ||
          DEFAULT_REWARD_GOAL;

        if (goal <= 0) {
          return [];
        }

        const previousPercentage =
          (previousCompleted / goal) *
          100;

        const newPercentage =
          (newCompleted / goal) *
          100;

        return config.milestones
          .filter((milestone) => {
            const threshold =
              Number(
                milestone.threshold
              );

            return (
              threshold >
                previousPercentage &&
              threshold <=
                newPercentage
            );
          })
          .sort(
            (a, b) =>
              Number(a.threshold) -
              Number(b.threshold)
          );
      },
      []
    );

  /* =======================================================
     OPEN REWARD POPUP
  ======================================================= */

  const openRewardPopup =
    useCallback((milestone) => {
      if (!milestone) return;

      setCurrentReward({
        threshold:
          Number(
            milestone.threshold
          ),
        xp: Number(milestone.xp),
      });

      setShowReward(true);
    }, []);

  /* =======================================================
     START MOVE BREAK
  ======================================================= */

  const startExercise = () => {
    if (allGoalsComplete) {
      return;
    }

    setActivityIndex(0);
    setIsPreparing(true);
    setIsPreviewing(false);
    setIsTransitioning(false);
    setShowExercise(true);
  };

  /* =======================================================
     CLOSE EXERCISE
  ======================================================= */

  const closeExercise = useCallback(() => {
    setShowExercise(false);

    setIsPreparing(false);
    setIsPreviewing(false);
    setIsTransitioning(false);

    setRemaining(0);
    setActivityIndex(0);
  }, []);

  /* =======================================================
     COMPLETE ENTIRE MOVE BREAK
  ======================================================= */

  const completeSession =
    useCallback(() => {
      playSound("complete");
      const previousCompleted =
        Number(
          localStorage.getItem(
            "moveResetCompleted"
          )
        ) || 0;

      const newCompleted =
        previousCompleted + 1;

      localStorage.setItem(
        "moveResetCompleted",
        String(newCompleted)
      );

      localStorage.setItem(
        "moveResetDate",
        getToday()
      );

      setCompleted(newCompleted);

      onAction?.("stand");

      const crossedPersonalGoal =
        previousCompleted <
          personalGoal &&
        newCompleted >=
          personalGoal;

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

        setRewardedMilestones(
          updated
        );

        newMilestones.forEach(
          (milestone) => {
            onDailyGoalComplete?.({
              type:
                "move_reset_milestone",

              threshold:
                Number(
                  milestone.threshold
                ),

              reward:
                Number(
                  milestone.xp
                ),

              completed:
                newCompleted,

              goal:
                adminRewardGoal,
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

      if (latestReward) {
        openRewardPopup(
          latestReward
        );
      }
    }, [
      adminRewardGoal,
      getReachedMilestones,
      onAction,
      onDailyGoalComplete,
      openRewardPopup,
      personalGoal,
    ]);

  /* =======================================================
     EXERCISE TIMER
  ======================================================= */

  useEffect(() => {
    if (!showExercise) {
      return;
    }

    if (isPreparing) {
      const timer = setTimeout(() => {
        setIsPreparing(false);
        setIsPreviewing(true);
      }, 1000);

      return () =>
        clearTimeout(timer);
    }

    if (isPreviewing) {
      const timer = setTimeout(() => {
        setIsPreviewing(false);
        setRemaining(
          ACTIVITIES[activityIndex].duration
        );
      }, 2000);

      return () =>
        clearTimeout(timer);
    }

    if (isTransitioning) {
      const timer = setTimeout(() => {
        completeSession();
        closeExercise();
      }, 1000);

      return () =>
        clearTimeout(timer);
    }

    if (remaining > 0) {
      // Trigger beep when hitting the last second, or tick otherwise
      if (remaining === 1) {
        playSound("beep");
      } else {
        playSound("tick");
      }

      const timer = setTimeout(() => {
        setRemaining(
          (value) => value - 1
        );
      }, 1000);

      return () =>
        clearTimeout(timer);
    }

    const isLastExercise =
      activityIndex ===
      ACTIVITIES.length - 1;

    if (isLastExercise) {
      setIsTransitioning(true);
      return;
    }

    const nextIndex =
      activityIndex + 1;

    setActivityIndex(nextIndex);
    setIsPreviewing(true);
  }, [
    showExercise,
    isPreparing,
    isPreviewing,
    isTransitioning,
    remaining,
    activityIndex,
    completeSession,
    closeExercise,
  ]);

  /* =======================================================
     ESCAPE KEY
  ======================================================= */

  useEffect(() => {
    if (!showExercise) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeExercise();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [
    showExercise,
    closeExercise,
  ]);

  /* =======================================================
     CONTINUE TOWARD ADMIN REWARD GOAL
  ======================================================= */

  const continueTowardRewardGoal =
    () => {
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

  /* =======================================================
     FINISH FOR TODAY
  ======================================================= */

  const finishForToday = () => {
    setShowGoalComplete(false);

    if (pendingReward) {
      openRewardPopup(
        pendingReward
      );

      setPendingReward(null);
    }
  };

  /* =======================================================
     RENDER
  ======================================================= */

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
              Complete a full movement break to
              reset your body and mind.
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
              initial={{ width: 0 }}
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
              to reach the reward goal.
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

      <AnimatePresence>
        {showExercise && (
          <motion.div
            className="move-exercise-overlay"
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
              className="move-exercise-modal"
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
              <button
                type="button"
                className="move-exercise-close"
                onClick={closeExercise}
                aria-label="Close movement break"
              >
                <X size={20} />
              </button>

              {isPreparing ? (
                <>
                  <div className="move-small-label">
                    MOVE & RESET
                  </div>

                  <div className="move-exercise-progress">
                    Get Ready
                  </div>

                  <h2>
                    Prepare to move!
                  </h2>

                  <div className="move-countdown">
                    1
                  </div>

                  <p>
                    You will complete all{" "}
                    <strong>
                      {ACTIVITIES.length}
                    </strong>{" "}
                    exercises in this break.
                  </p>
                </>
              ) : isPreviewing ? (
                <>
                  <div className="move-small-label">
                    EXERCISE {activityIndex + 1} OF {ACTIVITIES.length}
                  </div>

                  <h2>
                    {currentActivity.name}
                  </h2>

                  <motion.img
                    key={currentActivity.name + "-preview"}
                    src={currentActivity.image}
                    alt={currentActivity.name}
                    className="move-exercise-image"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  />

                  <div className="move-exercise-description" style={{ fontSize: "1.1rem", fontWeight: 500, margin: "1rem 0" }}>
                    {currentActivity.preview}
                  </div>
                </>
              ) : isTransitioning ? (
                <>
                  <div className="move-small-label">
                    GREAT JOB!
                  </div>

                  <div className="move-exercise-progress">
                    {ACTIVITIES.length} of{" "}
                    {ACTIVITIES.length} exercises
                  </div>

                  <h2>
                    Break Complete!
                  </h2>

                  <div className="move-countdown transition-countdown">
                    <Check
                      size={42}
                      strokeWidth={3}
                    />
                  </div>

                  <p>
                    You completed the full
                    movement break.
                  </p>
                </>
              ) : (
                <>
                  <div className="move-small-label">
                    MOVE & RESET
                  </div>

                  <div className="move-exercise-progress">
                    Exercise{" "}
                    {activityIndex + 1}{" "}
                    of{" "}
                    {ACTIVITIES.length}
                  </div>

                  <h2>
                    {currentActivity.name}
                  </h2>

                  <motion.img
                    key={currentActivity.name}
                    src={
                      currentActivity.image
                    }
                    alt={
                      currentActivity.name
                    }
                    className="move-exercise-image"
                    initial={{
                      opacity: 0,
                      scale: 0.95,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    transition={{
                      duration: 0.3,
                    }}
                  />

                  <div className="move-countdown">
                    {remaining}
                  </div>

                  <div className="move-exercise-description">
                    {currentActivity.description}
                  </div>

                  <div className="move-exercise-dots">
                    {ACTIVITIES.map(
                      (_, index) => (
                        <span
                          key={index}
                          className={
                            index <=
                            activityIndex
                              ? "active"
                              : ""
                          }
                        />
                      )
                    )}
                  </div>

                  <div className="move-exercise-step-label">
                    {activityIndex ===
                    ACTIVITIES.length - 1
                      ? "Final exercise"
                      : "Next exercise follows automatically"}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                You completed your personal
                movement goal of{" "}
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
                    }
                    %
                  </strong>{" "}
                  of your admin reward
                  goal.
                </p>

                <div className="move-xp">
                  +{currentReward.xp} XP
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowReward(false);
                    setCurrentReward(null);
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