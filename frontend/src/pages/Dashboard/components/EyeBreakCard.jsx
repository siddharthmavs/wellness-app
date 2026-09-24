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
  Eye,
  Check,
  Clock,
  Play,
  Pause,
} from "lucide-react";

import "./EyeBreakCard.css";
import { businessNow } from "../../../lib/userStorage";

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_GOAL = 3;

const DEFAULT_SCHEDULE = [
  "10:00",
  "13:00",
  "16:00",
];

const REWARD_CONFIG_KEY =
  "wellness-reward-config";

const DEFAULT_REWARD_GOAL = 3;

const DEFAULT_EYE_REWARDS = [
  {
    threshold: 50,
    xp: 10,
  },
  {
    threshold: 75,
    xp: 20,
  },
  {
    threshold: 100,
    xp: 50,
  },
];

const EXERCISES = [
  {
    name: "Blink",
    type: "blink",
    duration: 5,
  },
  {
    name: "Look Left",
    type: "left",
    duration: 5,
  },
  {
    name: "Look Right",
    type: "right",
    duration: 5,
  },
  {
    name: "Look Up",
    type: "up",
    duration: 5,
  },
  {
    name: "Look Down",
    type: "down",
    duration: 5,
  },
  {
    name: "Relax",
    type: "center",
    duration: 5,
  },
  {
    name: "Final Blink",
    type: "blink",
    duration: 5,
  },
];

/* =========================================================
   HELPERS
========================================================= */

const getToday = () =>
  businessNow().toDateString();

/* =========================================================
   PERSONAL GOAL
========================================================= */

const getSavedGoal = () => {
  try {
    const saved = Number(
      localStorage.getItem(
        "eyeBreakGoal"
      )
    );

    return saved > 0
      ? saved
      : DEFAULT_GOAL;
  } catch {
    return DEFAULT_GOAL;
  }
};

/* =========================================================
   PERSONAL SCHEDULE
========================================================= */

const getSavedSchedule = () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        "eyeBreakSchedule"
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

/* =========================================================
   ADMIN REWARD CONFIG
========================================================= */

const loadEyeBreakRewardConfig = () => {
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
          DEFAULT_EYE_REWARDS,
      };
    }

    const parsed =
      JSON.parse(saved);

    const savedRewardGoal =
      Number(
        parsed?.eyeBreak?.rewardGoal
      );

    const rewardGoal =
      savedRewardGoal > 0
        ? savedRewardGoal
        : DEFAULT_REWARD_GOAL;

    const savedMilestones =
      parsed?.eyeBreak?.milestones;

    const milestones =
      Array.isArray(
        savedMilestones
      )
        ? savedMilestones
            .map((item) => ({
              threshold: Number(
                item?.threshold
              ),
              xp: Number(item?.xp),
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
          : DEFAULT_EYE_REWARDS,
    };
  } catch {
    return {
      rewardGoal:
        DEFAULT_REWARD_GOAL,
      milestones:
        DEFAULT_EYE_REWARDS,
    };
  }
};

/* =========================================================
   TODAY'S PROGRESS
========================================================= */

const loadDailyData = () => {
  const today =
    getToday();

  try {
    const savedDate =
      localStorage.getItem(
        "eyeBreakDate"
      );

    if (
      savedDate !== today
    ) {
      localStorage.setItem(
        "eyeBreakDate",
        today
      );

      localStorage.setItem(
        "eyeBreakCompleted",
        "0"
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

      localStorage.removeItem(
        `eyeBreakRewardConfigSignature-${today}`
      );

      return {
        completed: 0,
      };
    }

    return {
      completed: Math.max(
        Number(
          localStorage.getItem(
            "eyeBreakCompleted"
          ) || 0
        ),
        0
      ),
    };
  } catch {
    return {
      completed: 0,
    };
  }
};

/* =========================================================
   TODAY'S REWARDED MILESTONES
========================================================= */

const loadRewardedMilestones = () => {
  const today =
    getToday();

  try {
    const saved =
      localStorage.getItem(
        `eyeBreakRewardedMilestones-${today}`
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

/* =========================================================
   REWARD CONFIG SIGNATURE
========================================================= */

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
  frequency = 650,
  duration = 0.12
) => {
  try {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const audioContext =
      new AudioContext();

    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();

    oscillator.type = "sine";

    oscillator.frequency.value =
      frequency;

    gain.gain.setValueAtTime(
      0.0001,
      audioContext.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.07,
      audioContext.currentTime + 0.02
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime +
        duration
    );

    oscillator.connect(gain);

    gain.connect(
      audioContext.destination
    );

    oscillator.start();

    oscillator.stop(
      audioContext.currentTime +
        duration
    );

    setTimeout(() => {
      audioContext
        .close()
        .catch(() => {});
    }, duration * 1000 + 100);
  } catch {
    // Sound is optional.
  }
};

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function EyeBreakCard({
  onAction,
  onDailyGoalComplete,
}) {
  const dailyData =
    loadDailyData();

  const initialRewardConfig =
    loadEyeBreakRewardConfig();

  const [goal, setGoal] =
    useState(getSavedGoal);

  const [schedule, setSchedule] =
    useState(getSavedSchedule);

  const [completed, setCompleted] =
    useState(
      dailyData.completed
    );

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
    useRef(
      initialRewardConfig
    );

  const [
    currentReward,
    setCurrentReward,
  ] = useState(null);

  const [
    showReward,
    setShowReward,
  ] = useState(false);

  const [
    showGoalComplete,
    setShowGoalComplete,
  ] = useState(false);

  const [
    pendingReward,
    setPendingReward,
  ] = useState(null);

  const [
    workingTowardRewardGoal,
    setWorkingTowardRewardGoal,
  ] = useState(false);

  const [
    showExercise,
    setShowExercise,
  ] = useState(false);

  const [
    isBreakDue,
    setIsBreakDue,
  ] = useState(false);

  const [
    exerciseIndex,
    setExerciseIndex,
  ] = useState(0);

  const [
    remaining,
    setRemaining,
  ] = useState(
    EXERCISES[0].duration
  );

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
  ] = useState(2);

  // Pause state tracking for manual clicks and tab/app visibility changes
  const [isPaused, setIsPaused] = useState(false);

  const currentExercise =
    EXERCISES[exerciseIndex];

  const personalGoalComplete =
    goal > 0 &&
    completed >= goal;

  const rewardGoalComplete =
    rewardGoal > 0 &&
    completed >= rewardGoal;

  const allGoalsComplete =
    personalGoalComplete &&
    rewardGoalComplete;

  const activeProgressGoal =
    workingTowardRewardGoal
      ? Number(rewardGoal)
      : Number(goal);

  const safeActiveProgressGoal =
    Math.max(
      activeProgressGoal || 0,
      1
    );

  const progress =
    Math.min(
      Math.max(
        (completed /
          safeActiveProgressGoal) *
          100,
        0
      ),
      100
    );

  const timelineItems =
    Array.from(
      {
        length:
          safeActiveProgressGoal,
      },
      (_, index) => ({
        index,
        time:
          schedule[index] ||
          `BREAK ${index + 1}`,
      })
    );

  const shouldOfferContinue =
    Number(goal) <
      Number(rewardGoal) &&
    completed >=
      Number(goal) &&
    completed <
      Number(rewardGoal);

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
        loadEyeBreakRewardConfig();

      const eventConfig =
        event?.detail?.eyeBreak;

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
                  threshold:
                    Number(
                      item?.threshold
                    ),
                  xp: Number(
                    item?.xp
                  ),
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
                    item.threshold <=
                      100 &&
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
            eventMilestones.length >
            0
              ? eventMilestones
              : DEFAULT_EYE_REWARDS,
        };
      }

      const previousSignature =
        getRewardConfigSignature(
          rewardConfigRef.current
            .rewardGoal,
          rewardConfigRef.current
            .milestones
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
          `eyeBreakRewardedMilestones-${today}`
        );

        localStorage.setItem(
          `eyeBreakRewardConfigSignature-${today}`,
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
        `eyeBreakRewardConfigSignature-${today}`
      );

    if (
      storedSignature &&
      storedSignature !==
        signature
    ) {
      localStorage.removeItem(
        `eyeBreakRewardedMilestones-${today}`
      );

      rewardedMilestonesRef.current =
        {};

      setRewardedMilestones({});
    }

    localStorage.setItem(
      `eyeBreakRewardConfigSignature-${today}`,
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
          "eyeBreakDate"
        );

      let currentCompleted = 0;

      if (
        savedDate === today
      ) {
        currentCompleted =
          Number(
            localStorage.getItem(
              "eyeBreakCompleted"
            ) || 0
          );
      }

      setGoal(newGoal);

      setSchedule(
        newSchedule
      );

      setCompleted(
        Math.max(
          currentCompleted,
          0
        )
      );
    };

    window.addEventListener(
      "wellnessSettingsUpdated",
      updateSettings
    );

    window.addEventListener(
      "eye-settings-updated",
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
        "eye-settings-updated",
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

  useEffect(() => {
    const checkDay = () => {
      const today =
        getToday();

      const savedDate =
        localStorage.getItem(
          "eyeBreakDate"
        );

      if (
        savedDate !== today
      ) {
        localStorage.setItem(
          "eyeBreakDate",
          today
        );

        localStorage.setItem(
          "eyeBreakCompleted",
          "0"
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

        localStorage.removeItem(
          `eyeBreakRewardConfigSignature-${today}`
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
      }
    };

    const interval =
      setInterval(
        checkDay,
        60000
      );

    return () =>
      clearInterval(interval);
  }, []);

  useEffect(() => {
    const today =
      getToday();

    const key =
      `eyeBreakRewardedMilestones-${today}`;

    try {
      localStorage.setItem(
        key,
        JSON.stringify(
          rewardedMilestones
        )
      );
    } catch {
      // Ignore storage errors.
    }

    rewardedMilestonesRef.current =
      rewardedMilestones;
  }, [
    rewardedMilestones,
  ]);

  const isBreakCompletedForSlot =
    (time) => {
      try {
        const completedSlots =
          JSON.parse(
            localStorage.getItem(
              "eyeBreakCompletedSlots"
            ) || "[]"
          );

        return completedSlots.includes(
          time
        );
      } catch {
        return false;
      }
    };

  useEffect(() => {
    const checkSchedule = () => {
      const now =
        new Date();

      const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();

      const scheduleGoal =
        workingTowardRewardGoal
          ? safeActiveProgressGoal
          : Number(goal);

      const activeSchedule =
        schedule.slice(
          0,
          scheduleGoal
        );

      const due =
        activeSchedule.some(
          (time) => {
            if (!time) {
              return false;
            }

            const [
              hours,
              minutes,
            ] = time
              .split(":")
              .map(Number);

            const breakMinutes =
              hours * 60 +
              minutes;

            return (
              currentMinutes >=
                breakMinutes &&
              !isBreakCompletedForSlot(
                time
              )
            );
          }
        );

      setIsBreakDue(
        due &&
          !allGoalsComplete
      );
    };

    checkSchedule();

    const timer =
      setInterval(
        checkSchedule,
        30000
      );

    return () =>
      clearInterval(timer);
  }, [
    schedule,
    goal,
    safeActiveProgressGoal,
    workingTowardRewardGoal,
    completed,
    allGoalsComplete,
  ]);

  const markCurrentSlotCompleted =
    () => {
      const now =
        new Date();

      const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();

      const scheduleGoal =
        workingTowardRewardGoal
          ? safeActiveProgressGoal
          : Number(goal);

      const activeSchedule =
        schedule.slice(
          0,
          scheduleGoal
        );

      const slot =
        activeSchedule.find(
          (time) => {
            if (!time) {
              return false;
            }

            const [
              hours,
              minutes,
            ] = time
              .split(":")
              .map(Number);

            const breakMinutes =
              hours * 60 +
              minutes;

            return (
              currentMinutes >=
                breakMinutes &&
              !isBreakCompletedForSlot(
                time
              )
            );
          }
        );

      if (!slot) {
        return;
      }

      try {
        const slots =
          JSON.parse(
            localStorage.getItem(
              "eyeBreakCompletedSlots"
            ) || "[]"
          );

        if (
          !slots.includes(slot)
        ) {
          slots.push(slot);

          localStorage.setItem(
            "eyeBreakCompletedSlots",
            JSON.stringify(
              slots
            )
          );
        }
      } catch {
        // Ignore storage errors.
      }
    };

    const getNewlyReachedMilestones = (
    previousCompleted,
    newCompleted
  ) => {
    const latestConfig =
      rewardConfigRef.current;

    const currentRewardGoal =
      Number(latestConfig.rewardGoal);

    const currentMilestones =
      latestConfig.milestones;

    if (
      currentRewardGoal <= 0 ||
      !Array.isArray(currentMilestones)
    ) {
      return [];
    }

    // Eye Break rewards are COUNT-BASED:
    // 1 break = milestone 1
    // 2 breaks = milestone 2
    // 3 breaks = milestone 3
    // 4 breaks = milestone 4
    const previousCount = Math.min(
      Number(previousCompleted) || 0,
      currentRewardGoal
    );

    const newCount = Math.min(
      Number(newCompleted) || 0,
      currentRewardGoal
    );

    const latestRewarded =
      loadRewardedMilestones();

    rewardedMilestonesRef.current =
      latestRewarded;

    return currentMilestones
      .filter(
        (milestone) =>
          newCount >=
            Number(milestone.threshold) &&
          previousCount <
            Number(milestone.threshold)
      )
      .filter(
        (milestone) =>
          !latestRewarded[
            String(milestone.threshold)
          ]
      )
      .sort(
        (a, b) =>
          Number(a.threshold) -
          Number(b.threshold)
      );
  };
  
  const startExercise = () => {
    if (allGoalsComplete) {
      return;
    }

    setExerciseIndex(0);

    setRemaining(
      EXERCISES[0].duration
    );

    setIsPreparing(true);

    setIsTransitioning(false);

    setTransitionRemaining(3);

    setIsPaused(false);

    setShowExercise(true);
  };

  const closeExercise = () => {
    setShowExercise(false);

    setExerciseIndex(0);

    setRemaining(
      EXERCISES[0].duration
    );

    setIsPreparing(false);

    setIsTransitioning(false);

    setTransitionRemaining(2);

    setIsPaused(false);
  };

  const completeEyeBreak =
    () => {
      if (allGoalsComplete) {
        return;
      }

      setShowExercise(false);

      setIsPreparing(false);

      setIsTransitioning(false);

      setIsPaused(false);

      const previousCompleted =
        Number(
          localStorage.getItem(
            "eyeBreakCompleted"
          ) || completed
        );

      const newCompleted =
        previousCompleted + 1;

      setCompleted(
        newCompleted
      );

      localStorage.setItem(
        "eyeBreakCompleted",
        String(newCompleted)
      );

      markCurrentSlotCompleted();

      if (onAction) {
        onAction(
          "eye_care"
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
          `eyeBreakRewardedMilestones-${today}`,
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
                  "eye_care_milestone",

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

          setTimeout(() => {
            setShowReward(
              true
            );
          }, 150);
        }
      } else if (
        reachedPersonalGoal
      ) {
        setTimeout(() => {
          setShowGoalComplete(
            true
          );
        }, 250);
      }
    };

  useEffect(() => {
    if (!showExercise) {
      return;
    }

    const handleKeyDown =
      (event) => {
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

  useEffect(() => {
    if (!showExercise || isPaused) {
      return;
    }

    if (isPreparing) {
      if (
        transitionRemaining > 0
      ) {
        const timer =
          setTimeout(() => {
            setTransitionRemaining(
              (previous) =>
                previous - 1
            );
          }, 1000);

        return () =>
          clearTimeout(timer);
      }

      setIsPreparing(false);

      setRemaining(
        EXERCISES[0].duration
      );

      return;
    }

    if (isTransitioning) {
      if (
        transitionRemaining > 0
      ) {
        const timer =
          setTimeout(() => {
            setTransitionRemaining(
              (previous) =>
                previous - 1
            );
          }, 1000);

        return () =>
          clearTimeout(timer);
      }

      const nextIndex =
        exerciseIndex + 1;

      if (
        nextIndex >=
        EXERCISES.length
      ) {
        return;
      }

      setExerciseIndex(
        nextIndex
      );

      setRemaining(
        EXERCISES[nextIndex]
          .duration
      );

      setIsTransitioning(false);

      return;
    }

    if (remaining > 0) {
      playSound(
        remaining === 1
          ? 900
          : 650,
        0.12
      );

      const timer =
        setTimeout(() => {
          setRemaining(
            (previous) =>
              previous - 1
          );
        }, 1000);

      return () =>
        clearTimeout(timer);
    }

    if (
      exerciseIndex <
      EXERCISES.length - 1
    ) {
      playSound(
        1100,
        0.25
      );

      setIsTransitioning(true);

      setTransitionRemaining(2);

      return;
    }

    playSound(
      1200,
      0.35
    );

    completeEyeBreak();
  }, [
    showExercise,
    remaining,
    exerciseIndex,
    isPreparing,
    isTransitioning,
    transitionRemaining,
    isPaused,
  ]);

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

    setShowReward(false);
  };

  const resetToday = () => {
    const today =
      getToday();

    localStorage.setItem(
      "eyeBreakDate",
      today
    );

    localStorage.setItem(
      "eyeBreakCompleted",
      "0"
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

    setIsBreakDue(false);

    closeExercise();
  };

  useEffect(() => {
    window.resetEyeBreakToday =
      resetToday;

    return () => {
      delete window.resetEyeBreakToday;
    };
  });

  useEffect(() => {
    const handleReset =
      () => {
        resetToday();
      };

    window.addEventListener(
      "eye-progress-reset",
      handleReset
    );

    return () => {
      window.removeEventListener(
        "eye-progress-reset",
        handleReset
      );
    };
  });

  const getNextBreak = () => {
    const now =
      new Date();

    const currentMinutes =
      now.getHours() * 60 +
      now.getMinutes();

    const scheduleGoal =
      workingTowardRewardGoal
        ? safeActiveProgressGoal
        : Number(goal);

    const activeSchedule =
      schedule.slice(
        0,
        scheduleGoal
      );

    const next =
      activeSchedule.find(
        (time) => {
          if (!time) {
            return false;
          }

          const [
            hours,
            minutes,
          ] = time
            .split(":")
            .map(Number);

          return (
            hours * 60 +
              minutes >
            currentMinutes
          );
        }
      );

    return (
      next || "Tomorrow"
    );
  };

  return (
    <>
      <motion.div
        className="eye-break-card"
        whileHover={{
          scale: 1.02,
        }}
        transition={{
          duration: 0.2,
        }}
      >
        <div className="eye-card-header">
          <div>
            <div className="eye-card-title">
              <Eye
                size={20}
                className="eye-title-icon"
              />

              EYE BREAK
            </div>

            <div className="eye-card-subtitle">
              Give your eyes some love 👀
            </div>
          </div>
        </div>

        <div className="eye-card-eyes">
          <AnimatedEye />
          <AnimatedEye />
        </div>

        <div className="eye-timeline-section">

          <div className="eye-timeline-heading">

            <span>
              {workingTowardRewardGoal
                ? "REWARD GOAL PROGRESS"
                : "TODAY'S EYE BREAKS"}
            </span>

            <strong>
              {completed} /{" "}
              {safeActiveProgressGoal}
            </strong>

          </div>

          <div
            className="eye-timeline"
            style={{
              "--timeline-count":
                safeActiveProgressGoal,
            }}
          >

            {safeActiveProgressGoal >
              1 && (
              <div className="eye-timeline-track">

                <div
                  className="eye-timeline-track-fill"
                  style={{
                    width: `${progress}%`,
                  }}
                />

              </div>
            )}

            {timelineItems.map(
              (item) => {
                const done =
                  item.index <
                  completed;

                const isNext =
                  item.index ===
                    completed &&
                  !done;

                return (
                  <div
                    className="eye-timeline-item"
                    key={
                      `eye-timeline-${item.index}`
                    }
                  >

                    <div className="eye-timeline-time">
                      {item.time}
                    </div>

                    <motion.div
                      className={`eye-timeline-dot ${
                        done
                          ? "completed"
                          : isNext
                          ? "next"
                          : ""
                      }`}
                      animate={
                        isNext
                          ? {
                              scale: [
                                1,
                                1.12,
                                1,
                              ],
                            }
                          : {
                              scale: 1,
                            }
                      }
                      transition={
                        isNext
                          ? {
                              duration:
                                1.5,
                              repeat:
                                Infinity,
                              ease:
                                "easeInOut",
                            }
                          : {
                              duration:
                                0.2,
                            }
                      }
                    >
                      {done && (
                        <Check
                          size={11}
                          strokeWidth={4}
                        />
                      )}
                    </motion.div>

                    <div
                      className={`eye-timeline-status ${
                        done
                          ? "done"
                          : isNext
                          ? "next-status"
                          : ""
                      }`}
                    >
                      {done
                        ? "DONE"
                        : isNext
                        ? "NEXT"
                        : "UPCOMING"}
                    </div>

                  </div>
                );
              }
            )}

          </div>
        </div>

        <div className="eye-next-break">

          <Clock size={13} />

          <span>
            {isBreakDue
              ? "Eye break is ready"
              : `Next break: ${getNextBreak()}`}
          </span>

        </div>

        {!allGoalsComplete ? (
          <motion.button
            className={`eye-start-button ${
              isBreakDue
                ? "eye-break-due"
                : ""
            }`}
            onClick={
              startExercise
            }
            animate={
              isBreakDue
                ? {
                    scale: [
                      1,
                      1.03,
                      1,
                    ],
                    boxShadow: [
                      "0 4px 0 #000",
                      "0 4px 0 #000, 0 0 18px rgba(79, 157, 255, 0.65)",
                      "0 4px 0 #000",
                    ],
                  }
                : {
                    scale: 1,
                    boxShadow:
                      "0 4px 0 #000",
                  }
            }
            transition={
              isBreakDue
                ? {
                    duration: 1.8,
                    repeat:
                      Infinity,
                    ease:
                      "easeInOut",
                  }
                : {
                    duration: 0.2,
                  }
            }
            whileHover={{
              scale: 1.04,
            }}
            whileTap={{
              scale: 0.96,
              y: 3,
            }}
          >
            <Eye size={17} />

            <span>
              {isBreakDue
                ? "START EYE BREAK"
                : "START BREAK"}
            </span>

            {isBreakDue && (
              <span className="eye-break-pulse-dot" />
            )}
          </motion.button>
        ) : (
          <div className="eye-complete-state">

            <Check size={16} />

            DAILY GOAL COMPLETE

          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showExercise && (
          <motion.div
            className="eye-exercise-overlay"
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
              closeExercise
            }
          >
            <motion.div
              className="eye-exercise-modal"
              initial={{
                scale: 0.8,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.8,
                opacity: 0,
              }}
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <button
                type="button"
                className="eye-exercise-close"
                onClick={
                  closeExercise
                }
                aria-label="Close eye exercise"
              >
                ×
              </button>

              {isPreparing ? (
                <>
                  <div className="exercise-complete-label">
                    👀 GET READY
                  </div>

                  <h2 className="next-exercise-title">
                    FIRST
                  </h2>

                  <div className="next-exercise-name">
                    {
                      EXERCISES[0]
                        .name
                    }
                  </div>

                  <div className="exercise-eyes">

                    <AnimatedEye
                      movement={
                        EXERCISES[0]
                          .type
                      }
                      large
                    />

                    <AnimatedEye
                      movement={
                        EXERCISES[0]
                          .type
                      }
                      large
                    />

                  </div>

                  <div className="transition-countdown">
                    {
                      transitionRemaining
                    }
                  </div>

                  <p>
                    Get ready for your
                    first eye movement
                  </p>
                </>
              ) : isTransitioning ? (
                <>
                  <div className="exercise-complete-label">
                    ✓{" "}
                    {
                      currentExercise.name
                    }
                  </div>

                  <h2 className="next-exercise-title">
                    NEXT
                  </h2>

                  <div className="next-exercise-name">
                    {
                      EXERCISES[
                        exerciseIndex +
                          1
                      ].name
                    }
                  </div>

                  <div className="exercise-eyes">

                    <AnimatedEye
                      movement={
                        EXERCISES[
                          exerciseIndex +
                            1
                        ].type
                      }
                      large
                    />

                    <AnimatedEye
                      movement={
                        EXERCISES[
                          exerciseIndex +
                            1
                        ].type
                      }
                      large
                    />

                  </div>

                  <div className="transition-countdown">
                    {
                      transitionRemaining
                    }
                  </div>

                  <p>
                    Get ready for the
                    next movement
                  </p>
                </>
              ) : (
                <>
                  <div className="exercise-small-title">
                    EYE RESET
                  </div>

                  <h2>
                    {
                      currentExercise.name
                    }
                  </h2>

                  <div className="exercise-eyes">

                    <AnimatedEye
                      movement={
                        currentExercise.type
                      }
                      large
                    />

                    <AnimatedEye
                      movement={
                        currentExercise.type
                      }
                      large
                    />

                  </div>

                  <div className="exercise-countdown">
                    {remaining}s
                  </div>

                  <div className="exercise-progress">

                    {EXERCISES.map(
                      (
                        _,
                        index
                      ) => (
                        <span
                          key={
                            index
                          }
                          className={
                            index <=
                            exerciseIndex
                              ? "active"
                              : ""
                          }
                        />
                      )
                    )}

                  </div>

                  <p>
                    Follow the movement
                    slowly and
                    comfortably.
                  </p>
                </>
              )}

              {/* UNIVERSAL PAUSE / RESUME BUTTON */}
              <div style={{ marginTop: "16px", display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  onClick={() => setIsPaused(!isPaused)}
                  className="eye-pause-resume-button"
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

              <div style={{ marginTop: "8px", fontSize: "11px", opacity: 0.7, fontWeight: 600, textAlign: "center" }}>
                {isPaused
                  ? "Exercise is paused. Click Resume to continue."
                  : "Follow the steps and move at a comfortable pace."}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGoalComplete && (
          <motion.div
            className="eye-reward-overlay"
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
              className="eye-reward-popup"
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

              <div className="reward-eyes">
                👀
              </div>

              <h2>
                DAILY GOAL COMPLETE!
              </h2>

              <p>
                Great job! You completed
                your personal eye-break
                goal of{" "}
                <strong>
                  {goal} breaks
                </strong>
                .
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
                      {rewardGoal} breaks
                    </strong>
                    . You can continue
                    to earn the remaining
                    rewards.
                  </p>

                  <button
                    type="button"
                    onClick={
                      continueTowardRewardGoal
                    }
                  >
                    CONTINUE BREAKS
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

      <AnimatePresence>
        {showReward &&
          currentReward && (
            <motion.div
              className="eye-reward-overlay"
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
                className="eye-reward-popup"
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

                <div className="reward-eyes">
                  👀
                </div>

                <h2>
                  EYES RESTED!
                </h2>

                <p>
                  You reached{" "}
                  <strong>
                    {
                      currentReward.threshold
                    }%
                  </strong>{" "}
                  of your daily
                  eye-break reward goal.
                </p>

                <div className="xp-reward">
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
                  NICE!
                </button>

              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>
    </>
  );
}

/* =========================================================
   ANIMATED EYE
========================================================= */

function AnimatedEye({
  movement = "center",
  large = false,
}) {
  const pupilPositions = {
    left: {
      x: -14,
      y: 0,
    },

    right: {
      x: 14,
      y: 0,
    },

    up: {
      x: 0,
      y: -10,
    },

    down: {
      x: 0,
      y: 10,
    },

    center: {
      x: 0,
      y: 0,
    },

    blink: {
      x: 0,
      y: 0,
    },
  };

  const position =
    pupilPositions[movement] ||
    pupilPositions.center;

  return (
    <div
      className={`animated-eye ${
        large ? "large" : ""
      }`}
    >
      <div className="eye-white">

        <motion.div
          className="eye-pupil"
          animate={{
            x: position.x,
            y: position.y,
          }}
          transition={{
            duration: 0.7,
            ease: "easeInOut",
          }}
        >
          <div className="eye-highlight" />
        </motion.div>

      </div>

      <motion.div
        className="eye-lid"
        animate={
          movement === "blink"
            ? {
                scaleY: [
                  0,
                  1,
                  0,
                  1,
                  0,
                ],
              }
            : {
                scaleY: 0,
              }
        }
        transition={
          movement === "blink"
            ? {
                duration: 1.5,
                ease: "easeInOut",
              }
            : {
                duration: 0.2,
              }
        }
      />

    </div>
  );
}