import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  PersonStanding,
  RotateCcw,
  Hand,
  X,
} from "lucide-react";

import handStretching from "./assets/hand-stretch.png";
import finger from "./assets/finger-exercise.png";
import neck from "./assets/neck-stretch.png";
import walking from "./assets/walking.png";
import shoulder from "./assets/shoulder-rolling.png";

import "./MoveResetCard.css";

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const DEFAULT_GOAL = 3;

const DEFAULT_SCHEDULE = [
  "10:30",
  "14:00",
  "17:00",
  "19:00",
  "21:00",
];

/* =========================================================
   ACTIVITIES
========================================================= */

const ACTIVITIES = [
  {
    name: "Hand Stretching",
    type: "hands",
    duration: 5,
    image: handStretching,
    description:
      "Gently stretch your hands and wrists to release tension.",
  },
  {
    name: "Finger Stretch",
    type: "finger",
    duration: 5,
    image: finger,
    description:
      "Slowly stretch and relax each finger to loosen your hands.",
  },
  {
    name: "Neck Relax",
    type: "neck",
    duration: 5,
    image: neck,
    description:
      "Gently tilt your head from side to side. Keep your shoulders relaxed.",
  },
  {
    name: "Shoulder Rolling",
    type: "shoulder",
    duration: 5,
    image: shoulder,
    description:
      "Slowly roll your shoulders backward and release any tension.",
  },
  {
    name: "Walking",
    type: "walking",
    duration: 5,
    image: walking,
    description:
      "Take a few easy steps to get your body moving and reset.",
  },
];

/* =========================================================
   HELPERS
========================================================= */

const getToday = () =>
  new Date().toDateString();

const getSavedGoal = () => {
  const saved = Number(
    localStorage.getItem("moveResetGoal")
  );

  return saved > 0 ? saved : DEFAULT_GOAL;
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
    // Ignore invalid storage.
  }

  return DEFAULT_SCHEDULE;
};

const loadDailyData = () => {
  const today = getToday();

  const savedDate =
    localStorage.getItem("moveResetDate");

  if (savedDate !== today) {
    localStorage.setItem("moveResetDate", today);
    localStorage.setItem("moveResetCompleted", "0");
    localStorage.removeItem("moveResetRewarded");

    return {
      completed: 0,
      rewarded: false,
    };
  }

  const completed = Number(
    localStorage.getItem("moveResetCompleted") || 0
  );

  const goal = getSavedGoal();
  const rewarded = completed >= goal;

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

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(
      0.0001,
      context.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.07,
      context.currentTime + 0.02
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(
      context.currentTime + duration
    );

    setTimeout(() => {
      context.close().catch(() => {});
    }, duration * 1000 + 100);
  } catch {
    // Audio is optional.
  }
};

/* =========================================================
   COMPONENT
========================================================= */

export default function MoveResetCard({
  onAction,
  onDailyGoalComplete,
}) {
  const dailyData = loadDailyData();

  /* =======================================================
     SETTINGS
  ========================================================= */

  const [goal, setGoal] = useState(getSavedGoal);
  const [schedule, setSchedule] = useState(getSavedSchedule);

  /* =======================================================
     DAILY STATE
  ========================================================= */

  const [completed, setCompleted] =
    useState(dailyData.completed);

  const [rewarded, setRewarded] =
    useState(dailyData.rewarded);

  /* =======================================================
     UI STATE
  ========================================================= */

  const [showExercise, setShowExercise] =
    useState(false);

  const [showReward, setShowReward] =
    useState(false);

  /* =======================================================
     EXERCISE STATE
  ========================================================= */

  const [activityIndex, setActivityIndex] =
    useState(0);

  const [remaining, setRemaining] =
    useState(
      ACTIVITIES[0].duration
    );

  const [isPreparing, setIsPreparing] =
    useState(false);

  const [isTransitioning, setIsTransitioning] =
    useState(false);

  const [
    transitionRemaining,
    setTransitionRemaining,
  ] = useState(2);

  const currentActivity =
    ACTIVITIES[activityIndex];

  const nextActivity =
    ACTIVITIES[activityIndex + 1];

  /* =========================================================
     SYNCHRONIZE WITH GLOBAL SETTINGS
  ========================================================= */

  useEffect(() => {
    const updateSettings = () => {
      const newGoal = getSavedGoal();
      const newSchedule = getSavedSchedule();

      const today = getToday();
      const savedDate =
        localStorage.getItem("moveResetDate");

      let currentCompleted = 0;

      if (savedDate === today) {
        currentCompleted = Number(
          localStorage.getItem("moveResetCompleted") || 0
        );
      }

      setGoal(newGoal);
      setSchedule(newSchedule);
      setCompleted(currentCompleted);

      const goalIsComplete =
        currentCompleted >= newGoal;

      setRewarded(goalIsComplete);

      if (goalIsComplete) {
        localStorage.setItem(
          "moveResetRewarded",
          "true"
        );
      } else {
        localStorage.removeItem(
          "moveResetRewarded"
        );
        setShowReward(false);
      }
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
  ========================================================= */

  useEffect(() => {
    if (completed >= goal) {
      setRewarded(true);
      localStorage.setItem(
        "moveResetRewarded",
        "true"
      );
    } else {
      setRewarded(false);
      localStorage.removeItem(
        "moveResetRewarded"
      );
      setShowReward(false);
    }
  }, [completed, goal]);

  /* =========================================================
     START EXERCISE
  ========================================================= */

  const startExercise = () => {
    setActivityIndex(0);
    setRemaining(ACTIVITIES[0].duration);
    setIsPreparing(true);
    setIsTransitioning(false);
    setTransitionRemaining(3);
    setShowExercise(true);

    playSound(750, 0.15);
  };

  /* =========================================================
     CLOSE EXERCISE
  ========================================================= */

  const closeExercise = () => {
    setShowExercise(false);
    setActivityIndex(0);
    setRemaining(ACTIVITIES[0].duration);
    setIsPreparing(false);
    setIsTransitioning(false);
    setTransitionRemaining(2);
  };

  /* =========================================================
     ESCAPE KEY
  ========================================================= */

  useEffect(() => {
    if (!showExercise) return;

    const handleKeyDown = (event) => {
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

    if (isPreparing) {
      if (transitionRemaining > 0) {
        playSound(
          transitionRemaining === 1 ? 900 : 550
        );

        const timer = setTimeout(() => {
          setTransitionRemaining(
            (value) => value - 1
          );
        }, 1000);

        return () => clearTimeout(timer);
      }

      setIsPreparing(false);
      setRemaining(ACTIVITIES[0].duration);
      return;
    }

    if (isTransitioning) {
      if (transitionRemaining > 0) {
        playSound(
          transitionRemaining === 1 ? 900 : 550
        );

        const timer = setTimeout(() => {
          setTransitionRemaining(
            (value) => value - 1
          );
        }, 1000);

        return () => clearTimeout(timer);
      }

      const nextIndex = activityIndex + 1;

      if (nextIndex >= ACTIVITIES.length) {
        return;
      }

      setActivityIndex(nextIndex);
      setRemaining(ACTIVITIES[nextIndex].duration);
      setIsTransitioning(false);
      return;
    }

    if (remaining > 0) {
      playSound(
        remaining === 1 ? 950 : 650
      );

      const timer = setTimeout(() => {
        setRemaining(
          (value) => value - 1
        );
      }, 1000);

      return () => clearTimeout(timer);
    }

    if (activityIndex < ACTIVITIES.length - 1) {
      playSound(1100, 0.25);
      setIsTransitioning(true);
      setTransitionRemaining(2);
      return;
    }

    completeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showExercise,
    remaining,
    activityIndex,
    isPreparing,
    isTransitioning,
    transitionRemaining,
  ]);

  /* =========================================================
     COMPLETE SESSION
  ========================================================= */

  const completeSession = () => {
    setShowExercise(false);
    setIsPreparing(false);
    setIsTransitioning(false);

    const newCompleted = completed + 1;
    setCompleted(newCompleted);

    localStorage.setItem(
      "moveResetCompleted",
      String(newCompleted)
    );

    if (onAction) {
      onAction("stand");
    }

    if (newCompleted >= goal && !rewarded) {
      setRewarded(true);
      localStorage.setItem(
        "moveResetRewarded",
        "true"
      );

      setShowReward(true);

      if (onDailyGoalComplete) {
        onDailyGoalComplete({
          type: "move_reset_daily_goal",
          reward: 50,
        });
      }
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <>
      <motion.div
        className="move-reset-card"
        whileHover={{
          scale: 1.02,
        }}
      >
        <div className="move-card-header">
          <div>
            <div className="move-card-title">
              <PersonStanding size={20} />
              MOVE & RESET
            </div>

            <div className="move-card-subtitle">
              A little movement goes a long way.
            </div>
          </div>
        </div>

        <div className="move-activity-progress">
          <div className="move-progress-title">
            <span>TODAY'S MOVEMENT</span>
            <span>
              {completed} / {goal}
            </span>
          </div>

          <div className="move-activity-icons">
            {schedule
              .slice(0, goal)
              .map((time, index) => {
                const done = index < completed;
                const next = index === completed;

                const Icon =
                  index === 0
                    ? PersonStanding
                    : index === 1
                    ? RotateCcw
                    : Hand;

                return (
                  <React.Fragment key={index}>
                    <div className="move-progress-item">
                      <div className="move-time">
                        {time}
                      </div>

                      <motion.div
                        className={`move-progress-circle ${
                          done
                            ? "completed"
                            : next
                            ? "current"
                            : ""
                        }`}
                        animate={
                          next
                            ? {
                                scale: [1, 1.08, 1],
                              }
                            : {
                                scale: 1,
                              }
                        }
                        transition={
                          next
                            ? {
                                duration: 1.5,
                                repeat: Infinity,
                              }
                            : {}
                        }
                      >
                        {done ? (
                          <Check size={16} />
                        ) : (
                          <Icon size={17} />
                        )}
                      </motion.div>

                      <div
                        className={`move-status ${
                          done
                            ? "done"
                            : next
                            ? "next"
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

                    {index < goal - 1 && (
                      <div
                        className={`move-connector ${
                          index < completed
                            ? "completed"
                            : ""
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
          </div>
        </div>

        {!rewarded ? (
          <motion.button
            className="move-start-button"
            onClick={startExercise}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
          >
            <PersonStanding size={17} />
            START MOVE
          </motion.button>
        ) : (
          <div className="move-complete-state">
            <Check size={16} />
            DAILY GOAL COMPLETE
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showExercise && (
          <motion.div
            className="move-exercise-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeExercise}
          >
            <motion.div
              className="move-exercise-modal"
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                className="move-exercise-close"
                onClick={closeExercise}
                aria-label="Close exercise"
              >
                <X size={20} />
              </button>

              {isPreparing ? (
                <>
                  <div className="move-small-label">
                    GET READY
                  </div>
                  <h2>{ACTIVITIES[0].name}</h2>
                  <div className="move-mascot-wrapper">
                    <motion.img
                      src={ACTIVITIES[0].image}
                      alt={ACTIVITIES[0].name}
                      className="move-exercise-mascot"
                    />
                  </div>
                  <div className="move-countdown">
                    {transitionRemaining}
                  </div>
                  <p>Get ready for your first movement.</p>
                </>
              ) : isTransitioning && nextActivity ? (
                <>
                  <div className="move-small-label">
                    NEXT MOVEMENT
                  </div>
                  <h2>{nextActivity.name}</h2>
                  <div className="move-mascot-wrapper">
                    <motion.img
                      src={nextActivity.image}
                      alt={nextActivity.name}
                      className="move-exercise-mascot"
                    />
                  </div>
                  <div className="move-countdown">
                    {transitionRemaining}
                  </div>
                  <p>Get ready for the next movement.</p>
                </>
              ) : (
                <>
                  <div className="move-small-label">
                    MOVE & RESET
                  </div>
                  <h2>{currentActivity.name}</h2>
                  <div className="move-mascot-wrapper">
                    <motion.img
                      src={currentActivity.image}
                      alt={currentActivity.name}
                      className="move-exercise-mascot"
                    />
                  </div>
                  <div className="move-countdown">
                    {remaining}s
                  </div>
                  <div className="move-exercise-dots">
                    {ACTIVITIES.map((_, index) => (
                      <span
                        key={index}
                        className={
                          index <= activityIndex
                            ? "active"
                            : ""
                        }
                      />
                    ))}
                  </div>
                  <p className="move-exercise-description">
                    {currentActivity.description}
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReward && (
          <motion.div
            className="move-reward-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="move-reward-popup"
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
            >
              <div className="reward-mascot">
                <img src={shoulder} alt="Happy mascot" />
              </div>
              <h2>NICE WORK!</h2>
              <p>You completed your daily movement goal.</p>
              <div className="move-xp">+50 XP</div>
              <button
                onClick={() => setShowReward(false)}
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