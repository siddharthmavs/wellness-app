import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AnimatePresence,
  motion,
} from "framer-motion";

import {
  Wind,
  Check,
  X,
  Play,
  Pause,
} from "lucide-react";

import "./BreathingCard.css";

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_GOAL = 3;

const DEFAULT_SCHEDULE = [
  "10:00",
  "14:00",
  "18:00",
  "20:00",
  "22:00",
];

const REWARD_CONFIG_KEY =
  "wellness-reward-config";

const DEFAULT_REWARD_GOAL = 3;

const DEFAULT_BREATHING_REWARDS = [
  {
    threshold: 50,
    xp: 5,
  },
  {
    threshold: 75,
    xp: 10,
  },
  {
    threshold: 100,
    xp: 20,
  },
];

/* =========================================================
   BREATHING PHASES
========================================================= */

const PHASES = {
  INHALE: {
    name: "BREATHE IN",
    description: "Slowly breathe in",
    duration: 4,
    from: 0.6,
    to: 1.25,
  },

  HOLD: {
    name: "HOLD",
    description: "Stay relaxed",
    duration: 4,
    from: 1.25,
    to: 1.25,
  },

  EXHALE: {
    name: "BREATHE OUT",
    description: "Slowly breathe out",
    duration: 6,
    from: 1.25,
    to: 0.6,
  },
};

/* =========================================================
   HELPERS
========================================================= */

const getToday = () => {
  return new Date().toDateString();
};

/* ---------------------------------------------------------
   PERSONAL GOAL
--------------------------------------------------------- */

const getSavedGoal = () => {
  const saved = Number(
    localStorage.getItem(
      "breathingGoal"
    )
  );

  return saved > 0
    ? saved
    : DEFAULT_GOAL;
};

/* ---------------------------------------------------------
   PERSONAL SCHEDULE
--------------------------------------------------------- */

const getSavedSchedule = () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        "breathingSchedule"
      )
    );

    if (
      Array.isArray(saved) &&
      saved.length > 0
    ) {
      return saved;
    }
  } catch {
    // Ignore invalid storage.
  }

  return DEFAULT_SCHEDULE;
};

/* ---------------------------------------------------------
   ADMIN REWARD CONFIG
--------------------------------------------------------- */

const loadBreathingRewardConfig = () => {
  try {
    const saved =
      localStorage.getItem(
        REWARD_CONFIG_KEY
      );

    if (!saved) {
      return {
        rewardGoal:
          DEFAULT_REWARD_GOAL,

        milestones:
          DEFAULT_BREATHING_REWARDS,
      };
    }

    const parsed =
      JSON.parse(saved);

    const savedRewardGoal =
      Number(
        parsed?.breathing?.rewardGoal
      );

    const rewardGoal =
      savedRewardGoal > 0
        ? savedRewardGoal
        : DEFAULT_REWARD_GOAL;

    const savedMilestones =
      parsed?.breathing?.milestones;

    const milestones =
      Array.isArray(
        savedMilestones
      )
        ? savedMilestones
            .map((item) => ({
              threshold: Number(
                item.threshold
              ),
              xp: Number(item.xp),
            }))
            .filter(
              (item) =>
                Number.isFinite(
                  item.threshold
                ) &&
                Number.isFinite(
                  item.xp
                ) &&
                item.threshold > 0 &&
                item.threshold <= 100 &&
                item.xp >= 0
            )
            .sort(
              (a, b) =>
                a.threshold -
                b.threshold
            )
        : [];

    return {
      rewardGoal,

      milestones:
        milestones.length > 0
          ? milestones
          : DEFAULT_BREATHING_REWARDS,
    };
  } catch {
    return {
      rewardGoal:
        DEFAULT_REWARD_GOAL,

      milestones:
        DEFAULT_BREATHING_REWARDS,
    };
  }
};

/* ---------------------------------------------------------
   TODAY'S DAILY DATA
--------------------------------------------------------- */

const loadDailyData = () => {
  const today =
    getToday();

  const savedDate =
    localStorage.getItem(
      "breathingDate"
    );

  if (
    savedDate !== today
  ) {
    localStorage.setItem(
      "breathingDate",
      today
    );

    localStorage.setItem(
      "breathingCompleted",
      "0"
    );

    localStorage.removeItem(
      "breathingRewarded"
    );

    localStorage.removeItem(
      `breathingRewardedMilestones-${today}`
    );

    localStorage.removeItem(
      `breathingRewardConfigSignature-${today}`
    );

    return {
      completed: 0,
    };
  }

  return {
    completed: Number(
      localStorage.getItem(
        "breathingCompleted"
      ) || 0
    ),
  };
};

/* ---------------------------------------------------------
   TODAY'S REWARDED MILESTONES
--------------------------------------------------------- */

const loadRewardedMilestones = () => {
  const today =
    getToday();

  try {
    const saved =
      localStorage.getItem(
        `breathingRewardedMilestones-${today}`
      );

    if (!saved) {
      return {};
    }

    const parsed =
      JSON.parse(saved);

    return parsed &&
      typeof parsed === "object"
      ? parsed
      : {};
  } catch {
    return {};
  }
};

/* ---------------------------------------------------------
   REWARD CONFIG SIGNATURE
--------------------------------------------------------- */

const getRewardConfigSignature = (
  rewardGoal,
  milestones
) => {
  return JSON.stringify({
    rewardGoal,
    milestones,
  });
};

/* =========================================================
   SOUND
========================================================= */

const playSound = (
  frequency = 600,
  duration = 0.12
) => {
  try {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const context =
      new AudioContext();

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.type =
      "sine";

    oscillator.frequency.value =
      frequency;

    gain.gain.setValueAtTime(
      0.0001,
      context.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.05,
      context.currentTime +
        0.03
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime +
        duration
    );

    oscillator.connect(gain);

    gain.connect(
      context.destination
    );

    oscillator.start();

    oscillator.stop(
      context.currentTime +
        duration
    );

    setTimeout(() => {
      context
        .close()
        .catch(() => {});
    }, duration * 1000 + 100);
  } catch {
    // Sound is optional.
  }
};

/* =========================================================
   COMPONENT
========================================================= */

export default function BreathingCard({
  onAction,
  onDailyGoalComplete,
}) {
  const dailyData =
    loadDailyData();

  const initialRewardConfig =
    loadBreathingRewardConfig();

  /* =======================================================
     PERSONAL SETTINGS
  ======================================================= */

  const [goal, setGoal] =
    useState(getSavedGoal);

  const [schedule, setSchedule] =
    useState(getSavedSchedule);

  /* =======================================================
     DAILY PROGRESS
  ======================================================= */

  const [completed, setCompleted] =
    useState(
      dailyData.completed
    );

  /* =======================================================
     ADMIN REWARD SETTINGS
  ======================================================= */

  const [rewardGoal, setRewardGoal] =
    useState(
      initialRewardConfig.rewardGoal
    );

  const [
    rewardMilestones,
    setRewardMilestones,
  ] = useState(
    initialRewardConfig.milestones
  );

  const [
    rewardedMilestones,
    setRewardedMilestones,
  ] = useState(
    loadRewardedMilestones()
  );

  const rewardedMilestonesRef =
    useRef(
      loadRewardedMilestones()
    );

  const rewardConfigRef =
    useRef(initialRewardConfig);

  /* =======================================================
     REWARD POPUP
  ======================================================= */

  const [
    currentReward,
    setCurrentReward,
  ] = useState(null);

  const [
    showReward,
    setShowReward,
  ] = useState(false);

  /* =======================================================
     PERSONAL GOAL COMPLETE POPUP
  ======================================================= */

  const [
    showGoalComplete,
    setShowGoalComplete,
  ] = useState(false);

  const [
    pendingReward,
    setPendingReward,
  ] = useState(null);

  /* =======================================================
     REWARD GOAL MODE
  ======================================================= */

  const [
    workingTowardRewardGoal,
    setWorkingTowardRewardGoal,
  ] = useState(false);

  /* =======================================================
     BREATHING MODAL
  ======================================================= */

  const [
    showExercise,
    setShowExercise,
  ] = useState(false);

  /* =======================================================
     BREATHING STATE
  ======================================================= */

  const [phase, setPhase] =
    useState("INHALE");

  const [round, setRound] =
    useState(1);

  /* =======================================================
     INITIAL PREVIEW
  ======================================================= */

  const [
    isPreviewing,
    setIsPreviewing,
  ] = useState(false);

  const [
    previewRemaining,
    setPreviewRemaining,
  ] = useState(3);

  /* =======================================================
     ROUND PAUSE
  ======================================================= */

  const [
    isRoundPause,
    setIsRoundPause,
  ] = useState(false);

  const [
    roundPauseRemaining,
    setRoundPauseRemaining,
  ] = useState(3);

  /* =======================================================
     MANUAL & AUTO PAUSE STATE
  ======================================================= */

  const [isPaused, setIsPaused] = useState(false);

  const currentPhase =
    PHASES[phase];

  /* =========================================================
     DERIVED GOAL STATE
  ========================================================= */

  const personalGoalComplete =
    goal > 0 &&
    completed >= goal;

  const rewardGoalComplete =
    rewardGoal > 0 &&
    completed >= rewardGoal;

  const allGoalsComplete =
    personalGoalComplete &&
    rewardGoalComplete;

  /* =========================================================
     ACTIVE PROGRESS GOAL
  ========================================================= */

  const activeProgressGoal =
    workingTowardRewardGoal
      ? rewardGoal
      : goal;

  const progress =
    activeProgressGoal > 0
      ? Math.min(
          (completed /
            activeProgressGoal) *
            100,
          100
        )
      : 0;

  /* =========================================================
     VISIBILITY CHANGE (AUTO PAUSE ON TAB/APP SWITCH)
  ========================================================= */

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && showExercise) {
        setIsPaused(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [showExercise]);

  /* =========================================================
     ADMIN REWARD CONFIG SYNCHRONIZATION
  ========================================================= */

  useEffect(() => {
    const updateRewards = (
      event
    ) => {
      let config =
        loadBreathingRewardConfig();

      const eventConfig =
        event?.detail?.breathing;

      if (eventConfig) {
        const eventRewardGoal =
          Number(
            eventConfig.rewardGoal
          );

        const eventMilestones =
          Array.isArray(
            eventConfig.milestones
          )
            ? eventConfig.milestones
                .map((item) => ({
                  threshold: Number(
                    item.threshold
                  ),
                  xp: Number(item.xp),
                }))
                .filter(
                  (item) =>
                    Number.isFinite(
                      item.threshold
                    ) &&
                    Number.isFinite(
                      item.xp
                    ) &&
                    item.threshold > 0 &&
                    item.threshold <= 100 &&
                    item.xp >= 0
                )
                .sort(
                  (a, b) =>
                    a.threshold -
                    b.threshold
                )
            : [];

        config = {
          rewardGoal:
            eventRewardGoal > 0
              ? eventRewardGoal
              : DEFAULT_REWARD_GOAL,

          milestones:
            eventMilestones.length > 0
              ? eventMilestones
              : DEFAULT_BREATHING_REWARDS,
        };
      }

      const previousSignature =
        getRewardConfigSignature(
          rewardConfigRef.current.rewardGoal,
          rewardConfigRef.current.milestones
        );

      const newSignature =
        getRewardConfigSignature(
          config.rewardGoal,
          config.milestones
        );

      setRewardGoal(
        config.rewardGoal
      );

      setRewardMilestones(
        config.milestones
      );

      rewardConfigRef.current =
        config;

      if (
        previousSignature !==
        newSignature
      ) {
        const today =
          getToday();

        localStorage.removeItem(
          `breathingRewardedMilestones-${today}`
        );

        localStorage.setItem(
          `breathingRewardConfigSignature-${today}`,
          newSignature
        );

        rewardedMilestonesRef.current =
          {};

        setRewardedMilestones({});
      }
    };

    updateRewards();

    window.addEventListener(
      "wellnessRewardsUpdated",
      updateRewards
    );

    window.addEventListener(
      "storage",
      updateRewards
    );

    return () => {
      window.removeEventListener(
        "wellnessRewardsUpdated",
        updateRewards
      );

      window.removeEventListener(
        "storage",
        updateRewards
      );
    };
  }, []);

  /* =========================================================
     INITIAL REWARD CONFIG SIGNATURE
  ========================================================= */

  useEffect(() => {
    const today =
      getToday();

    const signature =
      getRewardConfigSignature(
        rewardGoal,
        rewardMilestones
      );

    const storedSignature =
      localStorage.getItem(
        `breathingRewardConfigSignature-${today}`
      );

    if (
      storedSignature &&
      storedSignature !== signature
    ) {
      localStorage.removeItem(
        `breathingRewardedMilestones-${today}`
      );

      rewardedMilestonesRef.current =
        {};

      setRewardedMilestones({});
    }

    localStorage.setItem(
      `breathingRewardConfigSignature-${today}`,
      signature
    );

    rewardConfigRef.current = {
      rewardGoal,
      milestones:
        rewardMilestones,
    };
  }, [
    rewardGoal,
    rewardMilestones,
  ]);

  /* =========================================================
     USER SETTINGS SYNCHRONIZATION
  ========================================================= */

  useEffect(() => {
    const updateSettings = () => {
      const newGoal =
        getSavedGoal();

      const newSchedule =
        getSavedSchedule();

      const today =
        getToday();

      const savedDate =
        localStorage.getItem(
          "breathingDate"
        );

      let currentCompleted =
        0;

      if (
        savedDate === today
      ) {
        currentCompleted =
          Number(
            localStorage.getItem(
              "breathingCompleted"
            ) || 0
          );
      }

      setGoal(
        newGoal
      );

      setSchedule(
        newSchedule
      );

      setCompleted(
        currentCompleted
      );

      setRewardedMilestones(
        loadRewardedMilestones()
      );
    };

    window.addEventListener(
      "wellnessSettingsUpdated",
      updateSettings
    );

    window.addEventListener(
      "wellness-settings-updated",
      updateSettings
    );

    window.addEventListener(
      "breathing-settings-updated",
      updateSettings
    );

    window.addEventListener(
      "storage",
      updateSettings
    );

    window.addEventListener(
      "focus",
      updateSettings
    );

    window.addEventListener(
      "visibilitychange",
      updateSettings
    );

    updateSettings();

    return () => {
      window.removeEventListener(
        "wellnessSettingsUpdated",
        updateSettings
      );

      window.removeEventListener(
        "wellness-settings-updated",
        updateSettings
      );

      window.removeEventListener(
        "breathing-settings-updated",
        updateSettings
      );

      window.removeEventListener(
        "storage",
        updateSettings
      );

      window.removeEventListener(
        "focus",
        updateSettings
      );

      window.removeEventListener(
        "visibilitychange",
        updateSettings
      );
    };
  }, []);

  /* =========================================================
     NEW DAY RESET
  ========================================================= */

  useEffect(() => {
    const checkDay = () => {
      const today =
        getToday();

      const savedDate =
        localStorage.getItem(
          "breathingDate"
        );

      if (
        savedDate !== today
      ) {
        localStorage.setItem(
          "breathingDate",
          today
        );

        localStorage.setItem(
          "breathingCompleted",
          "0"
        );

        localStorage.removeItem(
          "breathingRewarded"
        );

        localStorage.removeItem(
          `breathingRewardedMilestones-${today}`
        );

        localStorage.removeItem(
          `breathingRewardConfigSignature-${today}`
        );

        setCompleted(0);

        rewardedMilestonesRef.current =
          {};

        setRewardedMilestones({});

        setCurrentReward(null);

        setPendingReward(null);

        setShowReward(false);

        setShowGoalComplete(false);

        setWorkingTowardRewardGoal(
          false
        );
      }
    };

    const timer =
      setInterval(
        checkDay,
        60000
      );

    return () =>
      clearInterval(timer);
  }, []);

  /* =========================================================
     SAVE REWARDED MILESTONES
  ========================================================= */

  useEffect(() => {
    const key =
      `breathingRewardedMilestones-${getToday()}`;

    localStorage.setItem(
      key,
      JSON.stringify(
        rewardedMilestones
      )
    );

    rewardedMilestonesRef.current =
      rewardedMilestones;
  }, [
    rewardedMilestones,
  ]);

  /* =========================================================
     NEXT SCHEDULED TIME
  ========================================================= */

  const getNextScheduledTime =
    () => {
      const activeSchedule =
        schedule.slice(
          0,
          goal
        );

      if (
        activeSchedule.length ===
        0
      ) {
        return null;
      }

      if (
        completed >=
        activeSchedule.length
      ) {
        return null;
      }

      return (
        activeSchedule[
          completed
        ] ||
        activeSchedule[
          activeSchedule.length - 1
        ]
      );
    };

  const nextTime =
    getNextScheduledTime();

  /* =========================================================
     START BREATHING
  ========================================================= */

  const startBreathing = () => {
    if (allGoalsComplete) {
      return;
    }

    setPhase(
      "INHALE"
    );

    setRound(1);

    setPreviewRemaining(3);

    setIsPreviewing(true);

    setIsRoundPause(false);

    setRoundPauseRemaining(3);

    setIsPaused(false);

    setShowExercise(true);

    playSound(600);
  };

  /* =========================================================
     CLOSE EXERCISE
  ========================================================= */

  const closeExercise = () => {
    setShowExercise(false);

    setPhase(
      "INHALE"
    );

    setRound(1);

    setIsPreviewing(false);

    setPreviewRemaining(3);

    setIsRoundPause(false);

    setRoundPauseRemaining(3);

    setIsPaused(false);
  };

  /* =========================================================
     ESCAPE KEY
  ========================================================= */

  useEffect(() => {
    if (!showExercise) {
      return;
    }

    const handleKeyDown = (
      event
    ) => {
      if (
        event.key === "Escape"
      ) {
        closeExercise();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    showExercise,
  ]);

  /* =========================================================
     INITIAL PREVIEW
  ========================================================= */

  useEffect(() => {
    if (
      !showExercise ||
      !isPreviewing ||
      isPaused
    ) {
      return;
    }

    if (
      previewRemaining > 0
    ) {
      playSound(
        previewRemaining === 1
          ? 900
          : 600
      );

      const timer =
        setTimeout(() => {
          setPreviewRemaining(
            (value) =>
              value - 1
          );
        }, 1000);

      return () =>
        clearTimeout(timer);
    }

    setIsPreviewing(false);

    setPhase(
      "INHALE"
    );

    setRound(1);
  }, [
    showExercise,
    isPreviewing,
    previewRemaining,
    isPaused,
  ]);

  /* =========================================================
     ROUND PAUSE
  ========================================================= */

  useEffect(() => {
    if (
      !showExercise ||
      !isRoundPause ||
      isPaused
    ) {
      return;
    }

    if (
      roundPauseRemaining > 0
    ) {
      playSound(
        roundPauseRemaining === 1
          ? 900
          : 550
      );

      const timer =
        setTimeout(() => {
          setRoundPauseRemaining(
            (value) =>
              value - 1
          );
        }, 1000);

      return () =>
        clearTimeout(timer);
    }

    setIsRoundPause(false);

    setRound(2);

    setPhase(
      "INHALE"
    );

    playSound(600);
  }, [
    showExercise,
    isRoundPause,
    roundPauseRemaining,
    isPaused,
  ]);

  /* =========================================================
     FIND NEW REWARD MILESTONES
  ========================================================= */

  const getNewlyReachedMilestones =
    (
      previousCompleted,
      newCompleted
    ) => {
      const latestConfig =
        rewardConfigRef.current;

      const currentRewardGoal =
        Number(
          latestConfig.rewardGoal
        );

      const currentMilestones =
        latestConfig.milestones;

      if (
        currentRewardGoal <= 0 ||
        !Array.isArray(
          currentMilestones
        )
      ) {
        return [];
      }

      const previousProgress =
        Math.min(
          (previousCompleted /
            currentRewardGoal) *
            100,
          100
        );

      const newProgress =
        Math.min(
          (newCompleted /
            currentRewardGoal) *
            100,
          100
        );

      const latestRewarded =
        loadRewardedMilestones();

      rewardedMilestonesRef.current =
        latestRewarded;

      return currentMilestones
        .filter(
          (milestone) =>
            newProgress >=
              milestone.threshold &&
            previousProgress <
              milestone.threshold
        )
        .filter(
          (milestone) =>
            !latestRewarded[
              String(
                milestone.threshold
              )
            ]
        )
        .sort(
          (a, b) =>
            a.threshold -
            b.threshold
        );
    };

  /* =========================================================
     COMPLETE SESSION
  ========================================================= */

  const completeSession =
    () => {
      if (allGoalsComplete) {
        return;
      }

      setShowExercise(false);

      setIsPreviewing(false);

      setIsRoundPause(false);

      setIsPaused(false);

      const previousCompleted =
        Number(
          localStorage.getItem(
            "breathingCompleted"
          ) || completed
        );

      const newCompleted =
        previousCompleted + 1;

      setCompleted(
        newCompleted
      );

      localStorage.setItem(
        "breathingCompleted",
        String(newCompleted)
      );

      if (onAction) {
        onAction(
          "breathing"
        );
      }

      const reachedPersonalGoal =
        !workingTowardRewardGoal &&
        goal > 0 &&
        previousCompleted <
          goal &&
        newCompleted >= goal;

      const newlyReached =
        getNewlyReachedMilestones(
          previousCompleted,
          newCompleted
        );

      if (
        newlyReached.length > 0
      ) {
        const latestRewarded =
          loadRewardedMilestones();

        const updatedRewarded = {
          ...latestRewarded,
        };

        newlyReached.forEach(
          (milestone) => {
            updatedRewarded[
              String(
                milestone.threshold
              )
            ] = true;
          }
        );

        const today =
          getToday();

        localStorage.setItem(
          `breathingRewardedMilestones-${today}`,
          JSON.stringify(
            updatedRewarded
          )
        );

        rewardedMilestonesRef.current =
          updatedRewarded;

        setRewardedMilestones(
          updatedRewarded
        );

        const highestMilestone =
          newlyReached[
            newlyReached.length - 1
          ];

        newlyReached.forEach(
          (milestone) => {
            if (
              onDailyGoalComplete
            ) {
              onDailyGoalComplete({
                type:
                  "breathing_milestone",

                threshold:
                  milestone.threshold,

                reward:
                  milestone.xp,
              });
            }
          }
        );

        if (
          reachedPersonalGoal
        ) {
          setPendingReward(
            highestMilestone
          );

          setCurrentReward(null);

          setShowReward(false);

          setTimeout(() => {
            setShowGoalComplete(
              true
            );
          }, 250);
        } else {
          setPendingReward(null);

          setCurrentReward(
            highestMilestone
          );

          setShowGoalComplete(
            false
          );

          setTimeout(() => {
            setShowReward(
              true
            );
          }, 150);
        }

        return;
      }

      if (
        reachedPersonalGoal
      ) {
        setPendingReward(null);

        setTimeout(() => {
          setShowGoalComplete(
            true
          );
        }, 250);
      }
    };

  /* =========================================================
     BREATHING TIMER
  ========================================================= */

  useEffect(() => {
    if (
      !showExercise ||
      isPreviewing ||
      isRoundPause ||
      isPaused
    ) {
      return;
    }

    const timer =
      setTimeout(() => {
        if (
          phase === "INHALE"
        ) {
          setPhase("HOLD");

          playSound(700);

          return;
        }

        if (
          phase === "HOLD"
        ) {
          setPhase("EXHALE");

          playSound(500);

          return;
        }

        if (
          phase === "EXHALE"
        ) {
          if (
            round === 1
          ) {
            setIsRoundPause(
              true
            );

            setRoundPauseRemaining(
              3
            );

            playSound(
              1100,
              0.25
            );

            return;
          }

          playSound(
            1200,
            0.35
          );

          completeSession();
        }
      }, currentPhase.duration * 1000);

    return () =>
      clearTimeout(timer);
  }, [
    showExercise,
    isPreviewing,
    isRoundPause,
    phase,
    round,
    isPaused,
  ]);

  /* =========================================================
     CONTINUE TOWARD REWARD GOAL
  ========================================================= */

  const continueTowardRewardGoal =
    () => {
      setWorkingTowardRewardGoal(
        true
      );

      setShowGoalComplete(
        false
      );

      if (pendingReward) {
        const reward =
          pendingReward;

        setPendingReward(
          null
        );

        setCurrentReward(
          reward
        );

        setTimeout(() => {
          setShowReward(
            true
          );
        }, 300);
      }
    };

  /* =========================================================
     DONE FOR TODAY
  ========================================================= */

  const finishForToday = () => {
    setShowGoalComplete(
      false
    );

    setPendingReward(
      null
    );

    setCurrentReward(
      null
    );
  };

  /* =========================================================
     RESET TODAY
  ========================================================= */

  const resetToday = () => {
    const today =
      getToday();

    localStorage.setItem(
      "breathingDate",
      today
    );

    localStorage.setItem(
      "breathingCompleted",
      "0"
    );

    localStorage.removeItem(
      "breathingRewarded"
    );

    localStorage.removeItem(
      `breathingRewardedMilestones-${today}`
    );

    rewardedMilestonesRef.current =
      {};

    setCompleted(0);

    setRewardedMilestones({});

    setCurrentReward(null);

    setPendingReward(null);

    setShowReward(false);

    setShowGoalComplete(false);

    setWorkingTowardRewardGoal(
      false
    );

    closeExercise();
  };

  /* =========================================================
     EXPOSE RESET FUNCTION
  ========================================================= */

  useEffect(() => {
    window.resetBreathingToday =
      resetToday;

    return () => {
      delete window.resetBreathingToday;
    };
  });

  /* =========================================================
     LISTEN FOR RESET EVENT
  ========================================================= */

  useEffect(() => {
    const handleReset =
      () => {
        resetToday();
      };

    window.addEventListener(
      "breathing-progress-reset",
      handleReset
    );

    return () => {
      window.removeEventListener(
        "breathing-progress-reset",
        handleReset
      );
    };
  });

  /* =========================================================
     DAILY GOAL COMPLETION
  ========================================================= */

  const dailyGoalComplete =
    personalGoalComplete;

  /* =========================================================
     SHOULD OFFER CONTINUE
  ========================================================= */

  const shouldOfferContinue =
    goal < rewardGoal &&
    completed >= goal &&
    !rewardGoalComplete;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <>
      {/* ==================================================
          MAIN CARD
      ================================================== */}

      <motion.div
        className="breathing-card"
        whileHover={{
          scale: 1.02,
        }}
        transition={{
          duration: 0.2,
        }}
      >
        {/* HEADER */}

        <div className="breathing-card-header">
          <div>
            <div className="breathing-card-title">
              <Wind size={20} />

              BREATHE
            </div>

            <div className="breathing-card-subtitle">
              Take a moment to
              slow down.
            </div>
          </div>
        </div>

        {/* VISUAL */}

        <div className="breathing-card-visual">
          <motion.div
            className="breathing-orb"
            animate={{
              scale:
                phase ===
                "INHALE"
                  ? [
                      0.6,
                      1.25,
                    ]
                  : phase ===
                    "HOLD"
                  ? 1.25
                  : [
                      1.25,
                      0.6,
                    ],
            }}
            transition={{
              duration:
                currentPhase.duration,
              ease:
                "easeInOut",
            }}
          >
            <div className="breathing-orb-inner" />
          </motion.div>
        </div>

        {/* PROGRESS */}

        <div className="breathing-progress">
          <div className="breathing-progress-title">
            <span>
              {workingTowardRewardGoal
                ? "REWARD GOAL PROGRESS"
                : "TODAY'S BREATHING"}
            </span>

            <span className="flex items-center gap-2">
              {nextTime &&
                !dailyGoalComplete &&
                !workingTowardRewardGoal && (
                  <span className="text-xs font-normal opacity-70 bg-black/5 px-1.5 py-0.5 rounded">
                    Next:{" "}
                    {nextTime}
                  </span>
                )}

              <span>
                {completed} /{" "}
                {activeProgressGoal}
              </span>
            </span>
          </div>

          <div className="breathing-progress-track">
            <motion.div
              className="breathing-progress-fill"
              animate={{
                width: `${progress}%`,
              }}
              transition={{
                duration: 0.5,
              }}
            />
          </div>
        </div>

        {/* START / COMPLETE */}

        {!allGoalsComplete ? (
          <motion.button
            className="breathing-start-button"
            onClick={
              startBreathing
            }
            whileHover={{
              scale: 1.03,
            }}
            whileTap={{
              scale: 0.96,
            }}
          >
            <Wind size={17} />

            {workingTowardRewardGoal
              ? "CONTINUE BREATHING"
              : "START BREATHING"}
          </motion.button>
        ) : (
          <div className="breathing-complete-state">
            <Check size={16} />

            DAILY GOAL COMPLETE
          </div>
        )}
      </motion.div>

      {/* ==================================================
          BREATHING EXERCISE MODAL
      ================================================== */}

      <AnimatePresence>
        {showExercise && (
          <motion.div
            className="breathing-overlay"
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
              className="breathing-modal"
              initial={{
                scale: 0.85,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.85,
                opacity: 0,
              }}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              {/* CLOSE */}

              <button
                type="button"
                className="breathing-close"
                onClick={
                  closeExercise
                }
                aria-label="Close breathing exercise"
              >
                <X size={20} />
              </button>

              {/* PREVIEW */}

              {isPreviewing ? (
                <>
                  <div className="breathing-modal-label">
                    GET READY
                  </div>

                  <h2>
                    BREATHE
                  </h2>

                  <p className="breathing-description">
                    Your breathing
                    exercise is
                    about to begin.
                  </p>

                  <div className="breathing-preview">
                    <div className="breathing-preview-item">
                      <div className="breathing-preview-circle inhale">
                        IN
                      </div>

                      <div className="breathing-preview-text">
                        <strong>
                          Breathe In
                        </strong>

                        <span>
                          4 seconds
                        </span>
                      </div>
                    </div>

                    <div className="breathing-preview-item">
                      <div className="breathing-preview-circle hold">
                        HOLD
                      </div>

                      <div className="breathing-preview-text">
                        <strong>
                          Hold
                        </strong>

                        <span>
                          4 seconds
                        </span>
                      </div>
                    </div>

                    <div className="breathing-preview-item">
                      <div className="breathing-preview-circle exhale">
                        OUT
                      </div>

                      <div className="breathing-preview-text">
                        <strong>
                          Breathe Out
                        </strong>

                        <span>
                          6 seconds
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="breathing-preview-countdown">
                    {
                      previewRemaining
                    }
                  </div>
                </>
              ) : isRoundPause ? (
                <>
                  <div className="breathing-modal-label">
                    ROUND COMPLETE
                  </div>

                  <h2>
                    WELL DONE
                  </h2>

                  <p className="breathing-description">
                    Take a short moment
                    to relax.
                  </p>

                  <div className="breathing-pause-circle">
                    <motion.div
                      animate={{
                        scale: [
                          1,
                          1.08,
                          1,
                        ],
                      }}
                      transition={{
                        duration: 2,
                        repeat:
                          Infinity,
                        ease:
                          "easeInOut",
                      }}
                    >
                      🌿
                    </motion.div>
                  </div>

                  <div className="breathing-round-pause-countdown">
                    {
                      roundPauseRemaining
                    }
                  </div>
                </>
              ) : (
                <>
                  <div className="breathing-modal-label">
                    BREATHE
                  </div>

                  <h2>
                    {
                      currentPhase.name
                    }
                  </h2>

                  <p className="breathing-description">
                    {
                      currentPhase.description
                    }
                  </p>

                  <div className="breathing-modal-circle">
                    <motion.div
                      key={`${round}-${phase}-${isPaused}`}
                      className="breathing-main-orb"
                      initial={{
                        scale:
                          currentPhase.from,
                      }}
                      animate={{
                        scale:
                          currentPhase.to,
                      }}
                      transition={{
                        duration: isPaused ? 0 : currentPhase.duration,
                        ease:
                          "easeInOut",
                      }}
                    >
                      <div className="breathing-main-orb-inner" />
                    </motion.div>
                  </div>

                  <div className="breathing-round">
                    ROUND {round} / 2
                  </div>

                  <div className="breathing-phases">
                    <span
                      className={
                        phase ===
                        "INHALE"
                          ? "active"
                          : ""
                      }
                    >
                      IN
                    </span>

                    <span
                      className={
                        phase ===
                        "HOLD"
                          ? "active"
                          : ""
                      }
                    >
                      HOLD
                    </span>

                    <span
                      className={
                        phase ===
                        "EXHALE"
                          ? "active"
                          : ""
                      }
                    >
                      OUT
                    </span>
                  </div>
                </>
              )}

              {/* PAUSE / RESUME BUTTON */}
              {!isRoundPause && (
                <div className="breathing-pause-container">
                  <button
                    type="button"
                    className={`breathing-pause-button ${isPaused ? "is-paused" : ""}`}
                    onClick={() => setIsPaused(!isPaused)}
                  >
                    {isPaused ? (
                      <>
                        <Play size={16} /> RESUME
                      </>
                    ) : (
                      <>
                        <Pause size={16} /> PAUSE
                      </>
                    )}
                  </button>
                </div>
              )}

              <p className="breathing-tip">
                {isPaused
                  ? "Exercise is paused. Click Resume to continue."
                  : "Follow the circle and breathe at a comfortable pace."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================
          PERSONAL GOAL COMPLETE MODAL
      ================================================== */}

      <AnimatePresence>
        {showGoalComplete && (
          <motion.div
            className="breathing-reward-overlay"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            onClick={
              finishForToday
            }
          >
            <motion.div
              className="breathing-reward-popup"
              initial={{
                scale: 0.7,
                y: 30,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                y: 0,
                opacity: 1,
              }}
              exit={{
                scale: 0.7,
                y: 30,
                opacity: 0,
              }}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="breathing-reward-icon">
                🌿
              </div>

              <h2>
                DAILY GOAL COMPLETE!
              </h2>

              <p>
                Great job! You completed
                your personal breathing
                goal of{" "}
                <strong>
                  {goal} sessions
                </strong>.
              </p>

              {shouldOfferContinue ? (
                <>
                  <p
                    style={{
                      marginTop: 8,
                    }}
                  >
                    Your reward goal is{" "}
                    <strong>
                      {rewardGoal} sessions
                    </strong>
                    . You can continue
                    breathing to earn the
                    remaining rewards.
                  </p>

                  <button
                    type="button"
                    onClick={
                      continueTowardRewardGoal
                    }
                  >
                    CONTINUE BREATHING
                  </button>

                  <button
                    type="button"
                    onClick={
                      finishForToday
                    }
                    style={{
                      marginTop: 8,
                      opacity: 0.8,
                    }}
                  >
                    DONE FOR TODAY
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={
                    finishForToday
                  }
                >
                  DONE FOR TODAY
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================
          REWARD MODAL
      ================================================== */}

      <AnimatePresence>
        {showReward &&
          currentReward && (
            <motion.div
              className="breathing-reward-overlay"
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              onClick={() =>
                setShowReward(false)
              }
            >
              <motion.div
                className="breathing-reward-popup"
                initial={{
                  scale: 0.7,
                  y: 30,
                  opacity: 0,
                }}
                animate={{
                  scale: 1,
                  y: 0,
                  opacity: 1,
                }}
                exit={{
                  scale: 0.7,
                  y: 30,
                  opacity: 0,
                }}
                onClick={(event) =>
                  event.stopPropagation()
                }
              >
                <div className="breathing-reward-icon">
                  🌿
                </div>

                <h2>
                  NICE WORK!
                </h2>

                <p>
                  You reached{" "}
                  <strong>
                    {
                      currentReward.threshold
                    }%
                  </strong>{" "}
                  of your daily
                  breathing reward
                  goal.
                </p>

                <div className="breathing-xp">
                  +
                  {
                    currentReward.xp
                  }{" "}
                  XP
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowReward(
                      false
                    )
                  }
                >
                  AWESOME!
                </button>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>
    </>
  );
}