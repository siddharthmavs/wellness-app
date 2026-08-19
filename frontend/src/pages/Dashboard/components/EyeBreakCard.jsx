
import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eye,
  Check,
  Clock,
} from "lucide-react";

import "./EyeBreakCard.css";

const DEFAULT_GOAL = 3;

const DEFAULT_SCHEDULE = [
  "10:00",
  "13:00",
  "16:00",
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

const getSavedGoal = () => {
  const saved = Number(
    localStorage.getItem("eyeBreakGoal")
  );

  return saved > 0
    ? saved
    : DEFAULT_GOAL;
};

const getSavedSchedule = () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem("eyeBreakSchedule")
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

const loadDailyData = () => {
  const today = getToday();

  const savedDate =
    localStorage.getItem(
      "eyeBreakDate"
    );

  /*
    If this is a new day, reset only today's
    progress. Goal and schedule remain unchanged.
  */

  if (savedDate !== today) {
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

    return {
      completed: 0,
      rewarded: false,
    };
  }

  const completed = Number(
    localStorage.getItem(
      "eyeBreakCompleted"
    ) || 0
  );

  const goal = getSavedGoal();

  /*
    IMPORTANT:
    Rewarded is calculated from the CURRENT goal.

    This prevents:

    old goal = 2
    completed = 2
    new goal = 3

    from remaining in "goal complete" state.
  */

  const rewarded =
    completed >= goal;

  return {
    completed,
    rewarded,
  };
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

    if (!AudioContext) return;

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
      audioContext.close().catch(() => {});
    }, duration * 1000 + 100);
  } catch {
    // Audio is optional.
  }
};

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function EyeBreakCard({
  onAction,
  onDailyGoalComplete,
}) {
  const dailyData = loadDailyData();

  /* =======================================================
     SETTINGS
  ======================================================= */

  const [goal, setGoal] = useState(
    getSavedGoal
  );

  const [schedule, setSchedule] =
    useState(getSavedSchedule);

  /* =======================================================
     DAILY STATE
  ======================================================= */

  const [completed, setCompleted] =
    useState(dailyData.completed);

  const [rewarded, setRewarded] =
    useState(
      dailyData.completed >= getSavedGoal()
    );

  /* =======================================================
     UI STATE
  ======================================================= */

  const [showExercise, setShowExercise] =
    useState(false);

  const [showReward, setShowReward] =
    useState(false);

  const [isBreakDue, setIsBreakDue] =
    useState(false);

  /* =======================================================
     EXERCISE STATE
  ======================================================= */

  const [exerciseIndex, setExerciseIndex] =
    useState(0);

  const [remaining, setRemaining] =
    useState(
      EXERCISES[0].duration
    );

  const [isPreparing, setIsPreparing] =
    useState(false);

  const [isTransitioning, setIsTransitioning] =
    useState(false);

  const [
    transitionRemaining,
    setTransitionRemaining,
  ] = useState(2);

  const currentExercise =
    EXERCISES[exerciseIndex];

  /* =========================================================
     SYNCHRONIZE WITH GLOBAL SETTINGS
     
     This is the important fix.

     When the user changes:
     
     2 → 3 goal
     
     and already has:
     
     2 completed
     
     we recalculate:
     
     2 >= 3 → false
     
     so the card becomes active again.
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

      if (savedDate === today) {
        currentCompleted = Number(
          localStorage.getItem(
            "eyeBreakCompleted"
          ) || 0
        );
      }

      /*
        Update goal and schedule.
      */

      setGoal(newGoal);
      setSchedule(newSchedule);
      setCompleted(currentCompleted);

      /*
        IMPORTANT:
        Always calculate rewarded using
        the NEW goal.

        Example:

        completed = 2
        newGoal = 3

        2 >= 3 = false

        Therefore the goal is no longer
        complete.
      */

      const goalIsComplete =
        currentCompleted >= newGoal;

      setRewarded(
        goalIsComplete
      );

      if (goalIsComplete) {
        localStorage.setItem(
          "eyeBreakRewarded",
          "true"
        );
      } else {
        localStorage.removeItem(
          "eyeBreakRewarded"
        );

        setShowReward(false);
      }
    };

    /*
      Global settings event.
    */

    window.addEventListener(
      "wellnessSettingsUpdated",
      updateSettings
    );

    /*
      Also synchronize when the user
      returns to the card/page.
    */

    window.addEventListener(
      "focus",
      updateSettings
    );

    window.addEventListener(
      "visibilitychange",
      updateSettings
    );

    /*
      Initial synchronization.
    */

    updateSettings();

    return () => {
      window.removeEventListener(
        "wellnessSettingsUpdated",
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
     KEEP REWARDED SYNCHRONIZED
     
     This also catches changes to completed
     or goal independently.
  ========================================================= */

  useEffect(() => {
    if (completed >= goal) {
      setRewarded(true);

      localStorage.setItem(
        "eyeBreakRewarded",
        "true"
      );
    } else {
      setRewarded(false);

      localStorage.removeItem(
        "eyeBreakRewarded"
      );

      /*
        If the goal becomes larger than
        completed, the old reward popup
        should disappear.
      */

      setShowReward(false);
    }
  }, [
    completed,
    goal,
  ]);

  /* =========================================================
     SCHEDULE SLOT COMPLETION
  ========================================================= */

  const isBreakCompletedForSlot = (
    time
  ) => {
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
      const now = new Date();

      const currentMinutes =
        now.getHours() * 60 +
        now.getMinutes();

      const activeSchedule =
        schedule.slice(0, goal);

      const due =
        activeSchedule.some(
          (time) => {
            if (!time) return false;

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

      setIsBreakDue(due);
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
    completed,
  ]);

  /* =========================================================
     MARK CURRENT SCHEDULE SLOT COMPLETE
  ========================================================= */

  const markCurrentSlotCompleted = () => {
    const now = new Date();

    const currentMinutes =
      now.getHours() * 60 +
      now.getMinutes();

    const activeSchedule =
      schedule.slice(0, goal);

    const slot =
      activeSchedule.find(
        (time) => {
          if (!time) return false;

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

    if (!slot) return;

    try {
      const slots =
        JSON.parse(
          localStorage.getItem(
            "eyeBreakCompletedSlots"
          ) || "[]"
        );

      if (!slots.includes(slot)) {
        slots.push(slot);

        localStorage.setItem(
          "eyeBreakCompletedSlots",
          JSON.stringify(slots)
        );
      }
    } catch {
      // Ignore storage errors.
    }
  };

  /* =========================================================
     START EXERCISE
  ========================================================= */

  const startExercise = () => {
    setExerciseIndex(0);

    setRemaining(
      EXERCISES[0].duration
    );

    /*
      Start with the 3-second
      preparation screen.
    */

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
     ESCAPE KEY
  ========================================================= */

  useEffect(() => {
    if (!showExercise) return;

    const handleKeyDown = (
      event
    ) => {
      if (event.key === "Escape") {
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
  }, [showExercise]);

  /* =========================================================
     EXERCISE TIMER
  ========================================================= */

  useEffect(() => {
    if (!showExercise) return;

    /* =====================================================
       PREPARATION
    ===================================================== */

    if (isPreparing) {
      if (transitionRemaining > 0) {
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

    /* =====================================================
       TRANSITION
    ===================================================== */

    if (isTransitioning) {
      if (transitionRemaining > 0) {
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
        EXERCISES[nextIndex].duration
      );

      setIsTransitioning(false);

      return;
    }

    /* =====================================================
       EXERCISE COUNTDOWN
    ===================================================== */

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

    /* =====================================================
       CURRENT EXERCISE FINISHED
    ===================================================== */

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

    /* =====================================================
       LAST EXERCISE FINISHED
    ===================================================== */

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
     COMPLETE EYE BREAK
  ========================================================= */

  const completeEyeBreak = () => {
    setShowExercise(false);

    setIsPreparing(false);

    setIsTransitioning(false);

    const newCompleted =
      completed + 1;

    /*
      Update React state.
    */

    setCompleted(
      newCompleted
    );

    /*
      Persist today's progress.
    */

    localStorage.setItem(
      "eyeBreakCompleted",
      String(newCompleted)
    );

    /*
      Mark the current schedule slot.
    */

    markCurrentSlotCompleted();

    /*
      Normal XP action.
    */

    if (onAction) {
      onAction("eye_care");
    }

    /*
      Daily goal completion.

      This ONLY happens when the NEW
      completion count reaches the
      CURRENT goal.
    */

    if (
      newCompleted >= goal &&
      !rewarded
    ) {
      setRewarded(true);

      localStorage.setItem(
        "eyeBreakRewarded",
        "true"
      );

      setShowReward(true);

      if (onDailyGoalComplete) {
        onDailyGoalComplete({
          type:
            "eye_care_daily_goal",
          reward: 50,
        });
      }
    }
  };

  /* =========================================================
     RESET TODAY
  ========================================================= */

  const resetToday = () => {
    localStorage.setItem(
      "eyeBreakDate",
      getToday()
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

    setCompleted(0);

    setRewarded(false);

    setShowReward(false);

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
     NEXT BREAK
  ========================================================= */

  const getNextBreak = () => {
    const now = new Date();

    const currentMinutes =
      now.getHours() * 60 +
      now.getMinutes();

    const activeSchedule =
      schedule.slice(0, goal);

    const next =
      activeSchedule.find(
        (time) => {
          if (!time) return false;

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

    return next || "Tomorrow";
  };

  /* =========================================================
     PROGRESS
  ========================================================= */

  const progress =
    goal > 0
      ? Math.min(
          (completed / goal) * 100,
          100
        )
      : 0;

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

        {/* HEADER */}

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

        {/* EYES */}

        <div className="eye-card-eyes">
          <AnimatedEye />
          <AnimatedEye />
        </div>

        {/* TODAY'S TIMELINE */}

        <div className="eye-timeline-section">

          <div className="eye-timeline-heading">
            <span>
              TODAY'S EYE BREAKS
            </span>

            <strong>
              {completed} / {goal}
            </strong>
          </div>

          <div
            className="eye-timeline"
            style={{
              "--timeline-count": goal,
            }}
          >

            {goal > 1 && (
              <div className="eye-timeline-track">
                <div
                  className="eye-timeline-track-fill"
                  style={{
                    width: `${
                      Math.min(
                        Math.max(
                          completed - 1,
                          0
                        ) /
                          (goal - 1),
                        1
                      ) * 100
                    }%`,
                  }}
                />
              </div>
            )}

            {schedule
              .slice(0, goal)
              .map(
                (
                  time,
                  index
                ) => {
                  const done =
                    index <
                    completed;

                  const next =
                    index ===
                      completed &&
                    !done;

                  return (
                    <div
                      className="eye-timeline-item"
                      key={index}
                    >

                      <div className="eye-timeline-time">
                        {time ||
                          "--:--"}
                      </div>

                      <motion.div
                        className={`eye-timeline-dot ${
                          done
                            ? "completed"
                            : next
                            ? "next"
                            : ""
                        }`}
                        animate={
                          next
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
                          next
                            ? {
                                duration: 1.5,
                                repeat:
                                  Infinity,
                                ease:
                                  "easeInOut",
                              }
                            : {}
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
                            : next
                            ? "next-status"
                            : ""
                        }`}
                      >
                        {done
                          ? "DONE"
                          : next
                          ? "NEXT"
                          : "UPCOMING"}
                      </div>

                    </div>
                  );
                }
              )}

          </div>
        </div>

        {/* NEXT BREAK */}

        <div className="eye-next-break">
          <Clock size={13} />

          <span>
            {isBreakDue
              ? "Eye break is ready"
              : `Next break: ${getNextBreak()}`}
          </span>
        </div>

        {/* START */}

        {!rewarded ? (
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
              onClick={(e) =>
                e.stopPropagation()
              }
            >

              {/* CLOSE */}

              <button
                className="eye-exercise-close"
                onClick={
                  closeExercise
                }
                aria-label="Close eye exercise"
              >
                ×
              </button>

              {/* PREPARATION */}

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

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================
          REWARD
      ================================================== */}

      <AnimatePresence>
        {showReward && (
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
          >

            <motion.div
              className="eye-reward-popup"
              initial={{
                scale: 0.7,
                y: 30,
              }}
              animate={{
                scale: 1,
                y: 0,
              }}
            >

              <div className="reward-eyes">
                👀
              </div>

              <h2>
                EYES RESTED!
              </h2>

              <p>
                You completed your
                daily eye-break goal.
              </p>

              <div className="xp-reward">
                +50 XP
              </div>

              <button
                onClick={() =>
                  setShowReward(false)
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

