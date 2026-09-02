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
} from "lucide-react";

import "./EyeBreakCard.css";

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
  new Date().toDateString();

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
  /* =======================================================
     INITIAL DATA
  ======================================================= */

  const dailyData =
    loadDailyData();

  const initialRewardConfig =
    loadEyeBreakRewardConfig();

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
    useRef(
      initialRewardConfig
    );

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
     DAILY GOAL POPUP
  ======================================================= */

  const [
    showGoalComplete,
    setShowGoalComplete,
  ] = useState(false);

  const [
    pendingReward,
    setPendingReward,
  ] = useState(null);

  /*
    false:
      progress uses personal goal

    true:
      progress uses admin reward goal
  */
  const [
    workingTowardRewardGoal,
    setWorkingTowardRewardGoal,
  ] = useState(false);

  /* =======================================================
     UI STATE
  ======================================================= */

  const [
    showExercise,
    setShowExercise,
  ] = useState(false);

  const [
    isBreakDue,
    setIsBreakDue,
  ] = useState(false);

  /* =======================================================
     EXERCISE STATE
  ======================================================= */

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

  const currentExercise =
    EXERCISES[exerciseIndex];

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

  /*
    THIS IS THE IMPORTANT PART.

    Before CONTINUE:
      active goal = personal goal

    After CONTINUE:
      active goal = reward goal

    Example:
      personal = 3
      reward   = 4

      before continue -> 3 timeline balls
      after continue  -> 4 timeline balls
  */
  const activeProgressGoal =
    workingTowardRewardGoal
      ? Number(rewardGoal)
      : Number(goal);

  const safeActiveProgressGoal =
    Math.max(
      activeProgressGoal || 0,
      1
    );

  /*
    Progress percentage is ALWAYS based
    on the currently active goal.
  */
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

  /*
    Create exactly as many balls as
    the active goal requires.
  */
  const timelineItems =
    Array.from(
      {
        length:
          safeActiveProgressGoal,
      },
      (_, index) => ({
        index,

        /*
          Existing personal schedule is used first.

          If reward goal is larger than the
          personal schedule, create an extra
          reward slot automatically.
        */
        time:
          schedule[index] ||
          `BREAK ${index + 1}`,
      })
    );

  /*
    Continue is offered ONLY when:

      personal goal < reward goal
      personal goal has been completed
      reward goal has NOT been completed
  */
  const shouldOfferContinue =
    Number(goal) <
      Number(rewardGoal) &&
    completed >=
      Number(goal) &&
    completed <
      Number(rewardGoal);

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

      /*
        If admin changes the reward
        configuration, today's previously
        awarded milestones are reset so
        the new configuration can be used.
      */
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

  /* =========================================================
     USER GOAL + SCHEDULE SYNCHRONIZATION
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

  /* =========================================================
     NEW DAY CHECK
  ========================================================= */

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

  /* =========================================================
     SAVE REWARDED MILESTONES
  ========================================================= */

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

  /* =========================================================
     SCHEDULE SLOT COMPLETION
  ========================================================= */

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

  /* =========================================================
     SCHEDULE CHECK
  ========================================================= */

  useEffect(() => {
    const checkSchedule = () => {
      const now =
        new Date();

      const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();

      /*
        While working toward reward goal,
        check reward-goal slots too.
      */
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

  /* =========================================================
     MARK CURRENT SCHEDULE SLOT COMPLETE
  ========================================================= */

  const markCurrentSlotCompleted =
    () => {
      const now =
        new Date();

      const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();

      /*
        Use active goal so reward-goal
        continuation can also use its
        additional schedule slots.
      */
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

  /* =========================================================
     GET NEWLY REACHED REWARD MILESTONES
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

      /*
        IMPORTANT:

        Reward percentage is ALWAYS
        calculated from ADMIN REWARD GOAL.

        Example:
          reward goal = 4
          completed = 2

          2 / 4 = 50%
      */
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
     START EXERCISE
  ========================================================= */

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

    setShowExercise(true);
  };

  /* =========================================================
     CLOSE EXERCISE
  ========================================================= */

  const closeExercise = () => {
    setShowExercise(false);

    setExerciseIndex(0);

    setRemaining(
      EXERCISES[0].duration
    );

    setIsPreparing(false);

    setIsTransitioning(false);

    setTransitionRemaining(2);
  };

  /* =========================================================
     COMPLETE EYE BREAK
  ========================================================= */

  const completeEyeBreak =
    () => {
      if (allGoalsComplete) {
        return;
      }

      setShowExercise(false);

      setIsPreparing(false);

      setIsTransitioning(false);

      const previousCompleted =
        Number(
          localStorage.getItem(
            "eyeBreakCompleted"
          ) || completed
        );

      const newCompleted =
        previousCompleted + 1;

      /*
        Progress is never capped.
        Even if the reward goal is 4,
        completed can become 5, 6, etc.
      */
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

      /*
        Personal goal completion is
        detected only when we are still
        working toward the personal goal.

        This prevents the personal
        completion popup from appearing
        again after CONTINUE.
      */
      const reachedPersonalGoal =
        !workingTowardRewardGoal &&
        goal > 0 &&
        previousCompleted <
          goal &&
        newCompleted >= goal;

      /*
        Reward milestones are calculated
        independently using ADMIN reward
        goal.
      */
      const newlyReached =
        getNewlyReachedMilestones(
          previousCompleted,
          newCompleted
        );

      /* =====================================================
         PROCESS REWARDS
      ===================================================== */

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

        /*
          Show the highest newly-earned
          milestone in the popup.
        */
        const highestMilestone =
          newlyReached[
            newlyReached.length - 1
          ];

        /*
          Award XP for EVERY newly
          reached milestone.
        */
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

        /*
          If personal goal and reward
          milestone happen together,
          show the personal goal popup
          FIRST.

          The reward is stored as
          pendingReward and shown after
          CONTINUE or DONE.
        */
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
          /*
            No goal-complete popup is
            blocking the reward, so show
            the reward popup directly.
          */
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
        /*
          Personal goal reached but no
          reward milestone was triggered.
        */
        setTimeout(() => {
          setShowGoalComplete(
            true
          );
        }, 250);
      }
    };

  /* =========================================================
     ESCAPE KEY
  ========================================================= */

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

  /* =========================================================
     EXERCISE TIMER
  ========================================================= */

  useEffect(() => {
    if (!showExercise) {
      return;
    }

    /* -------------------------------------------------------
       PREPARATION
    ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       TRANSITION
    ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       EXERCISE COUNTDOWN
    ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       NEXT EXERCISE
    ------------------------------------------------------- */

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

    /* -------------------------------------------------------
       COMPLETE FULL EYE BREAK
    ------------------------------------------------------- */

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
  ]);

  /* =========================================================
     CONTINUE TOWARD REWARD GOAL
  ========================================================= */

  const continueTowardRewardGoal =
    () => {
      /*
        This is the key switch.

        Personal goal remains unchanged.

        Only the ACTIVE DISPLAY GOAL
        changes to the reward goal.
      */
      setWorkingTowardRewardGoal(
        true
      );

      /*
        Close personal-goal popup.
      */
      setShowGoalComplete(
        false
      );

      /*
        If a reward was earned at the
        same time as the personal goal,
        show it after the goal popup.
      */
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

    setShowReward(false);
  };

  /* =========================================================
     RESET TODAY
  ========================================================= */

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

  /* =========================================================
     EXPOSE RESET FUNCTION
  ========================================================= */

  useEffect(() => {
    window.resetEyeBreakToday =
      resetToday;

    return () => {
      delete window.resetEyeBreakToday;
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

  /* =========================================================
     NEXT BREAK
  ========================================================= */

  const getNextBreak = () => {
    const now =
      new Date();

    const currentMinutes =
      now.getHours() * 60 +
      now.getMinutes();

    /*
      Use the active goal when determining
      the next break.
    */
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

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <>
      {/* ==================================================
          MAIN CARD
      ================================================== */}

      <motion.div
        className="eye-break-card"
        whileHover={{
          scale: 1.02,
        }}
        transition={{
          duration: 0.2,
        }}
      >
        {/* ==================================================
            HEADER
        ================================================== */}

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

        {/* ==================================================
            EYES
        ================================================== */}

        <div className="eye-card-eyes">
          <AnimatedEye />
          <AnimatedEye />
        </div>

        {/* ==================================================
            TIMELINE / PROGRESS
        ================================================== */}

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

            {/* ----------------------------------------------
                PROGRESS LINE
            ---------------------------------------------- */}

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

            {/* ----------------------------------------------
                PROGRESS BALLS
            ---------------------------------------------- */}

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

                    {/* TIME */}

                    <div className="eye-timeline-time">
                      {item.time}
                    </div>

                    {/* BALL */}

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

                    {/* STATUS */}

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

        {/* ==================================================
            NEXT BREAK
        ================================================== */}

        <div className="eye-next-break">

          <Clock size={13} />

          <span>
            {isBreakDue
              ? "Eye break is ready"
              : `Next break: ${getNextBreak()}`}
          </span>

        </div>

        {/* ==================================================
            START BUTTON
        ================================================== */}

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

      {/* ==================================================
          EXERCISE MODAL
      ================================================== */}

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

              {/* ------------------------------------------
                  PREPARING
              ------------------------------------------ */}

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

              /* ------------------------------------------
                 TRANSITIONING
              ------------------------------------------ */

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

              /* ------------------------------------------
                 NORMAL EXERCISE
              ------------------------------------------ */

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

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================
          DAILY GOAL COMPLETE MODAL
      ================================================== */}

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

      {/* ==================================================
          REWARD MODAL
      ================================================== */}

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