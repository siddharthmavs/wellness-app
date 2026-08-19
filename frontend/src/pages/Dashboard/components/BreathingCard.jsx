import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Wind,
  Check,
  X,
} from "lucide-react";

import "./BreathingCard.css";

const DEFAULT_GOAL = 3;
const DEFAULT_SCHEDULE = ["10:00", "14:00", "18:00", "20:00", "22:00"];

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
    duration: 2,
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

const getSavedGoal = () => {
  const saved = Number(
    localStorage.getItem("breathingGoal")
  );

  return saved > 0 ? saved : DEFAULT_GOAL;
};

const getSavedSchedule = () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem("breathingSchedule")
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
    localStorage.getItem("breathingDate");

  if (savedDate !== today) {
    localStorage.setItem("breathingDate", today);
    localStorage.setItem("breathingCompleted", "0");
    localStorage.removeItem("breathingRewarded");

    return {
      completed: 0,
      rewarded: false,
    };
  }

  const completed = Number(
    localStorage.getItem("breathingCompleted") || 0
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
  frequency = 600,
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
      0.05,
      context.currentTime + 0.03
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
     BREATHING STATE
  ========================================================= */

  const [phase, setPhase] =
    useState("INHALE");

  const [round, setRound] =
    useState(1);

  /* =======================================================
     INITIAL PREVIEW
  ========================================================= */

  const [isPreviewing, setIsPreviewing] =
    useState(false);

  const [previewRemaining, setPreviewRemaining] =
    useState(3);

  /* =======================================================
     ROUND PAUSE
  ========================================================= */

  const [isRoundPause, setIsRoundPause] =
    useState(false);

  const [roundPauseRemaining, setRoundPauseRemaining] =
    useState(3);

  const currentPhase =
    PHASES[phase];

  /* =========================================================
     SYNCHRONIZE WITH GLOBAL SETTINGS
  ========================================================= */

  useEffect(() => {
    const updateSettings = () => {
      const newGoal = getSavedGoal();
      const newSchedule = getSavedSchedule();

      const today = getToday();
      const savedDate = localStorage.getItem("breathingDate");
      let currentCompleted = 0;

      if (savedDate === today) {
        currentCompleted = Number(
          localStorage.getItem("breathingCompleted") || 0
        );
      }

      setGoal(newGoal);
      setSchedule(newSchedule);
      setCompleted(currentCompleted);

      const goalIsComplete = currentCompleted >= newGoal;

      setRewarded(goalIsComplete);

      if (goalIsComplete) {
        localStorage.setItem("breathingRewarded", "true");
      } else {
        localStorage.removeItem("breathingRewarded");
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
     CALCULATE NEXT SCHEDULED TIME
  ========================================================= */

  const getNextScheduledTime = () => {
    const activeSchedule = schedule.slice(0, goal);
    if (activeSchedule.length === 0) return null;

    if (completed >= activeSchedule.length) return null;

    const nextTime = activeSchedule[completed] || activeSchedule[activeSchedule.length - 1];
    return nextTime;
  };

  const nextTime = getNextScheduledTime();

  /* =========================================================
     START BREATHING
  ========================================================= */

  const startBreathing = () => {
    setPhase("INHALE");
    setRound(1);
    setPreviewRemaining(3);
    setIsPreviewing(true);
    setIsRoundPause(false);
    setRoundPauseRemaining(3);
    setShowExercise(true);

    playSound(600);
  };

  /* =========================================================
     CLOSE EXERCISE
  ========================================================= */

  const closeExercise = () => {
    setShowExercise(false);
    setPhase("INHALE");
    setRound(1);
    setIsPreviewing(false);
    setPreviewRemaining(3);
    setIsRoundPause(false);
    setRoundPauseRemaining(3);
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
     INITIAL 3 SECOND PREVIEW
  ========================================================= */

  useEffect(() => {
    if (
      !showExercise ||
      !isPreviewing
    ) {
      return;
    }

    if (previewRemaining > 0) {
      playSound(
        previewRemaining === 1
          ? 900
          : 600
      );

      const timer =
        setTimeout(() => {
          setPreviewRemaining(
            (value) => value - 1
          );
        }, 1000);

      return () =>
        clearTimeout(timer);
    }

    setIsPreviewing(false);
    setPhase("INHALE");
    setRound(1);
  }, [
    showExercise,
    isPreviewing,
    previewRemaining,
  ]);

  /* =========================================================
     ROUND PAUSE
  ========================================================= */

  useEffect(() => {
    if (
      !showExercise ||
      !isRoundPause
    ) {
      return;
    }

    if (roundPauseRemaining > 0) {
      playSound(
        roundPauseRemaining === 1
          ? 900
          : 550
      );

      const timer =
        setTimeout(() => {
          setRoundPauseRemaining(
            (value) => value - 1
          );
        }, 1000);

      return () =>
        clearTimeout(timer);
    }

    setIsRoundPause(false);
    setRound(2);
    setPhase("INHALE");

    playSound(600);
  }, [
    showExercise,
    isRoundPause,
    roundPauseRemaining,
  ]);

  /* =========================================================
     BREATHING TIMER
  ========================================================= */

  useEffect(() => {
    if (
      !showExercise ||
      isPreviewing ||
      isRoundPause
    ) {
      return;
    }

    const timer =
      setTimeout(() => {

        if (phase === "INHALE") {
          setPhase("HOLD");
          playSound(700);
          return;
        }

        if (phase === "HOLD") {
          setPhase("EXHALE");
          playSound(500);
          return;
        }

        if (phase === "EXHALE") {

          if (round === 1) {
            setIsRoundPause(true);
            setRoundPauseRemaining(3);
            playSound(1100, 0.25);
            return;
          }

          playSound(1200, 0.35);
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
  ]);

  /* =========================================================
     COMPLETE SESSION
  ========================================================= */

  const completeSession = () => {
    setShowExercise(false);
    setIsPreviewing(false);
    setIsRoundPause(false);

    const newCompleted = completed + 1;
    setCompleted(newCompleted);

    localStorage.setItem(
      "breathingCompleted",
      String(newCompleted)
    );

    if (onAction) {
      onAction("breathing");
    }

    if (
      newCompleted >= goal &&
      !rewarded
    ) {
      setRewarded(true);

      localStorage.setItem(
        "breathingRewarded",
        "true"
      );

      setShowReward(true);

      if (onDailyGoalComplete) {
        onDailyGoalComplete({
          type: "breathing_daily_goal",
          reward: 50,
        });
      }
    }
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
      <motion.div
        className="breathing-card"
        whileHover={{
          scale: 1.02,
        }}
      >
        <div className="breathing-card-header">
          <div>
            <div className="breathing-card-title">
              <Wind size={20} />
              BREATHE
            </div>

            <div className="breathing-card-subtitle">
              Take a moment to slow down.
            </div>
          </div>
        </div>

        <div className="breathing-card-visual">
          <motion.div
            className="breathing-orb"
            animate={{
              scale:
                phase === "INHALE"
                  ? [0.6, 1.25]
                  : phase === "HOLD"
                  ? 1.25
                  : [1.25, 0.6],
            }}
            transition={{
              duration: currentPhase.duration,
              ease: "easeInOut",
            }}
          >
            <div className="breathing-orb-inner" />
          </motion.div>
        </div>

        <div className="breathing-progress">
          <div className="breathing-progress-title">
            <span>TODAY'S BREATHING</span>

            <span className="flex items-center gap-2">
              {nextTime && completed < goal && (
                <span className="text-xs font-normal opacity-70 bg-black/5 px-1.5 py-0.5 rounded">
                  Next: {nextTime}
                </span>
              )}
              <span>{completed} / {goal}</span>
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

        {!rewarded ? (
          <motion.button
            className="breathing-start-button"
            onClick={startBreathing}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
          >
            <Wind size={17} />
            START BREATHING
          </motion.button>
        ) : (
          <div className="breathing-complete-state">
            <Check size={16} />
            DAILY GOAL COMPLETE
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showExercise && (
          <motion.div
            className="breathing-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeExercise}
          >
            <motion.div
              className="breathing-modal"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="breathing-close"
                onClick={closeExercise}
                aria-label="Close breathing exercise"
              >
                <X size={20} />
              </button>

              {isPreviewing ? (
                <>
                  <div className="breathing-modal-label">GET READY</div>
                  <h2>BREATHE</h2>
                  <p className="breathing-description">
                    Your breathing exercise is about to begin.
                  </p>
                  <div className="breathing-preview">
                    <div className="breathing-preview-item">
                      <div className="breathing-preview-circle inhale">IN</div>
                      <div className="breathing-preview-text">
                        <strong>Breathe In</strong>
                        <span>4 seconds</span>
                      </div>
                    </div>
                    <div className="breathing-preview-item">
                      <div className="breathing-preview-circle hold">HOLD</div>
                      <div className="breathing-preview-text">
                        <strong>Hold</strong>
                        <span>2 seconds</span>
                      </div>
                    </div>
                    <div className="breathing-preview-item">
                      <div className="breathing-preview-circle exhale">OUT</div>
                      <div className="breathing-preview-text">
                        <strong>Breathe Out</strong>
                        <span>6 seconds</span>
                      </div>
                    </div>
                  </div>
                  <div className="breathing-preview-countdown">{previewRemaining}</div>
                  <p className="breathing-tip">Get comfortable and prepare to follow the circle.</p>
                </>
              ) : isRoundPause ? (
                <>
                  <div className="breathing-modal-label">ROUND COMPLETE</div>
                  <h2>WELL DONE</h2>
                  <p className="breathing-description">Take a short moment to relax.</p>
                  <div className="breathing-pause-circle">
                    <motion.div
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      🌿
                    </motion.div>
                  </div>
                  <div className="breathing-round-pause-countdown">{roundPauseRemaining}</div>
                  <p className="breathing-tip">Round 2 is starting soon.</p>
                </>
              ) : (
                <>
                  <div className="breathing-modal-label">BREATHE</div>
                  <h2>{currentPhase.name}</h2>
                  <p className="breathing-description">{currentPhase.description}</p>
                  <div className="breathing-modal-circle">
                    <motion.div
                      key={`${round}-${phase}`}
                      className="breathing-main-orb"
                      initial={{ scale: currentPhase.from }}
                      animate={{ scale: currentPhase.to }}
                      transition={{ duration: currentPhase.duration, ease: "easeInOut" }}
                    >
                      <div className="breathing-main-orb-inner" />
                    </motion.div>
                  </div>
                  <div className="breathing-round">ROUND {round} / 2</div>
                  <div className="breathing-phases">
                    <span className={phase === "INHALE" ? "active" : ""}>IN</span>
                    <span className={phase === "HOLD" ? "active" : ""}>HOLD</span>
                    <span className={phase === "EXHALE" ? "active" : ""}>OUT</span>
                  </div>
                  <p className="breathing-tip">Follow the circle and breathe at a comfortable pace.</p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReward && (
          <motion.div
            className="breathing-reward-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="breathing-reward-popup"
              initial={{ scale: 0.7, y: 30 }}
              animate={{ scale: 1, y: 0 }}
            >
              <div className="breathing-reward-icon">🌿</div>
              <h2>NICE WORK!</h2>
              <p>You completed your daily breathing goal.</p>
              <div className="breathing-xp">+50 XP</div>
              <button onClick={() => setShowReward(false)}>AWESOME!</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}