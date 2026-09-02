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

const ACTIVITIES = [
  {
    name: "Hand Stretching",
    description: "Stretch your fingers and palms gently.",
    duration: 5,
    image: handStretch,
  },
  {
    name: "Finger Stretch",
    description: "Relax and stretch each finger slowly.",
    duration: 5,
    image: fingerExercise,
  },
  {
    name: "Neck Relax",
    description: "Release tension from your neck and shoulders.",
    duration: 5,
    image: neckStretch,
  },
  {
    name: "Shoulder Rolling",
    description: "Roll your shoulders slowly and relax.",
    duration: 5,
    image: shoulderRolling,
  },
  {
    name: "Walking",
    description: "Stand up and walk around for a moment.",
    duration: 5,
    image: walking,
  },
];

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
      "moveResetRewarded"
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
   PROGRESS DATA
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
        index === safeCompleted,
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
  /* -------------------------------------------------------
     USER SETTINGS
  ------------------------------------------------------- */

  const [goal, setGoal] =
    useState(getSavedGoal);

  const [schedule, setSchedule] =
    useState(getSavedSchedule);

  /* -------------------------------------------------------
     REWARD SETTINGS
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     DAILY PROGRESS
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     REWARD MODE
  ------------------------------------------------------- */

  const [
    workingTowardRewardGoal,
    setWorkingTowardRewardGoal,
  ] = useState(false);

  /* -------------------------------------------------------
     POPUPS
  ------------------------------------------------------- */

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

  /* -------------------------------------------------------
     EXERCISE
  ------------------------------------------------------- */

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
    isTransitioning,
    setIsTransitioning,
  ] = useState(false);

  const [
    transitionRemaining,
    setTransitionRemaining,
  ] = useState(0);

  /* =======================================================
     GOAL LOGIC
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
     PERSIST PROGRESS
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
     PERSIST REWARDS
  ======================================================= */

  useEffect(() => {
    rewardedMilestonesRef.current =
      rewardedMilestones;

    saveRewardedMilestones(
      rewardedMilestones
    );
  }, [rewardedMilestones]);

  /* =======================================================
     RESET EVENT
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
     SHOW REWARD
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
     START EXERCISE
  ======================================================= */

  const startExercise = () => {
    if (allGoalsComplete) {
      return;
    }

    const randomIndex =
      Math.floor(
        Math.random() *
          ACTIVITIES.length
      );

    setActivityIndex(randomIndex);

    setRemaining(
      ACTIVITIES[randomIndex].duration
    );

    setIsPreparing(true);
    setIsTransitioning(false);
    setShowExercise(true);
  };

  /* =======================================================
     CLOSE EXERCISE
  ======================================================= */

  const closeExercise = () => {
    setShowExercise(false);
    setIsPreparing(false);
    setIsTransitioning(false);
    setRemaining(0);
    setTransitionRemaining(0);
  };

  /* =======================================================
     COMPLETE SESSION
  ======================================================= */

  const completeSession =
    useCallback(() => {
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

      /* -----------------------------------------------
         PERSONAL GOAL
      ------------------------------------------------ */

      const crossedPersonalGoal =
        previousCompleted <
          personalGoal &&
        newCompleted >=
          personalGoal;

      /* -----------------------------------------------
         ADMIN REWARDS
      ------------------------------------------------ */

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

      /* -----------------------------------------------
         PERSONAL GOAL POPUP
      ------------------------------------------------ */

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

      /* -----------------------------------------------
         REWARD POPUP
      ------------------------------------------------ */

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

        setRemaining(
          ACTIVITIES[
            activityIndex
          ].duration
        );
      }, 1000);

      return () =>
        clearTimeout(timer);
    }

    if (isTransitioning) {
      if (transitionRemaining <= 1) {
        completeSession();
        closeExercise();

        return;
      }

      const timer = setTimeout(() => {
        setTransitionRemaining(
          (value) => value - 1
        );
      }, 1000);

      return () =>
        clearTimeout(timer);
    }

    if (remaining > 0) {
      const timer = setTimeout(() => {
        setRemaining(
          (value) => value - 1
        );
      }, 1000);

      return () =>
        clearTimeout(timer);
    }

    setIsTransitioning(true);
    setTransitionRemaining(1);
  }, [
    showExercise,
    isPreparing,
    isTransitioning,
    transitionRemaining,
    remaining,
    activityIndex,
    completeSession,
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
  }, [showExercise]);

  /* =======================================================
     CONTINUE
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
     FINISH TODAY
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
     RESET
  ======================================================= */

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

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      {/* ===================================================
          MAIN CARD
      =================================================== */}

      <div className="move-reset-card">

        {/* HEADER */}

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
              Take a short movement break.
            </p>
          </div>

          <button
            type="button"
            className="move-settings-button"
            onClick={resetToday}
            title="Reset today's progress"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* =================================================
            PROGRESS
        ================================================= */}

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
                      safeActiveProgressGoal - 1 && (
                      <div
                        className={`move-connector ${
                          item.index < completed
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

        {/* =================================================
            STATUS
        ================================================= */}

        <div className="move-status-message">
          {allGoalsComplete ? (
            "🎉 All movement goals completed!"
          ) : workingTowardRewardGoal ? (
            `Keep going! ${
              adminRewardGoal -
              completed
            } more to reach the reward goal.`
          ) : personalGoalComplete ? (
            "Daily movement goal completed!"
          ) : (
            <>
              {personalGoal -
                completed}{" "}
              movement{" "}
              {personalGoal -
                completed ===
              1
                ? "break"
                : "breaks"}{" "}
              remaining
            </>
          )}
        </div>

        {/* =================================================
            START BUTTON
        ================================================= */}

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

      {/* ===================================================
          EXERCISE MODAL
      =================================================== */}

      <AnimatePresence>
        {showExercise && (
          <motion.div
            className="move-exercise-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
              >
                <X size={20} />
              </button>

              {isPreparing ? (
                <>
                  <div className="move-small-label">
                    GET READY
                  </div>

                  <h2>
                    Prepare to move!
                  </h2>

                  <div className="move-countdown">
                    1
                  </div>

                  <p>
                    Get into a comfortable
                    position.
                  </p>
                </>
              ) : isTransitioning ? (
                <>
                  <div className="move-small-label">
                    GREAT JOB!
                  </div>

                  <h2>
                    Movement Complete
                  </h2>

                  <div className="move-countdown transition-countdown">
                    ✓
                  </div>

                  <p>
                    Saving your progress...
                  </p>
                </>
              ) : (
                <>
                  <div className="move-small-label">
                    MOVE & RESET
                  </div>

                  <h2>
                    {
                      ACTIVITIES[
                        activityIndex
                      ].name
                    }
                  </h2>

                  <img
                    src={
                      ACTIVITIES[
                        activityIndex
                      ].image
                    }
                    alt={
                      ACTIVITIES[
                        activityIndex
                      ].name
                    }
                    className="move-exercise-image"
                  />

                  <div className="move-countdown">
                    {remaining}
                  </div>

                  <div className="move-exercise-description">
                    {
                      ACTIVITIES[
                        activityIndex
                      ].description
                    }
                  </div>

                  <div className="move-exercise-dots">
                    {ACTIVITIES.map(
                      (_, index) => (
                        <span
                          key={index}
                          className={
                            index ===
                            activityIndex
                              ? "active"
                              : ""
                          }
                        />
                      )
                    )}
                  </div>
                </>
              )}

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================================================
          PERSONAL GOAL COMPLETE
      =================================================== */}

      <AnimatePresence>
        {showGoalComplete && (
          <motion.div
            className="move-reward-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
                </strong>
                .
              </p>

              {canContinueTowardReward ? (
                <>
                  <p>
                    Continue to{" "}
                    <strong>
                      {adminRewardGoal}
                    </strong>{" "}
                    to unlock more rewards.
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

      {/* ===================================================
          REWARD POPUP
      =================================================== */}

      <AnimatePresence>
        {showReward &&
          currentReward && (
            <motion.div
              className="move-reward-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                  of your admin reward goal.
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