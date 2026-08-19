import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  motion,
  AnimatePresence,
} from "framer-motion";

import {
  Droplet,
  Plus,
  X,
  Sparkles,
  RotateCcw,
} from "lucide-react";

import "./WaterCard.css";

const DRINK_AMOUNTS = [100, 250, 500];

const WATER_GOAL_KEY = "waterGoal";

export default function WaterCard({
  onWaterReward,
}) {
  const today = new Date().toDateString();

  /* =========================================
     GULP SOUND
  ========================================= */

  const gulpSound = useRef(null);

  useEffect(() => {
    gulpSound.current = new Audio(
      "/sounds/water-gulp.mp3"
    );

    gulpSound.current.volume = 0.7;

    return () => {
      if (gulpSound.current) {
        gulpSound.current.pause();
        gulpSound.current = null;
      }
    };
  }, []);

  /* =========================================
     WATER GOAL

     The goal is now controlled by:
     Settings → Drink Water

     WaterCard only READS the saved goal.
  ========================================= */

  const [waterGoal, setWaterGoal] =
    useState(() => {
      const saved =
        localStorage.getItem(
          WATER_GOAL_KEY
        );

      return saved
        ? Number(saved)
        : 2000;
    });

  /* =========================================
     WATER CONSUMED
  ========================================= */

  const [waterConsumed, setWaterConsumed] =
    useState(() => {
      const savedDate =
        localStorage.getItem(
          "waterDate"
        );

      if (savedDate !== today) {
        localStorage.setItem(
          "waterDate",
          today
        );

        localStorage.setItem(
          "waterConsumed",
          "0"
        );

        localStorage.removeItem(
          "waterRewarded"
        );

        return 0;
      }

      return Number(
        localStorage.getItem(
          "waterConsumed"
        ) || 0
      );
    });

  /* =========================================
     MODAL STATE
  ========================================= */

  const [
    showDrinkModal,
    setShowDrinkModal,
  ] = useState(false);

  const [
    showReward,
    setShowReward,
  ] = useState(false);

  const [
    customAmount,
    setCustomAmount,
  ] = useState("");

  /* =========================================
     SYNC WATER GOAL

     Settings → Drink Water updates localStorage.

     This listener makes the existing WaterCard
     immediately reflect the new goal.
  ========================================= */

  useEffect(() => {
    const loadWaterGoal = () => {
      const savedGoal =
        localStorage.getItem(
          WATER_GOAL_KEY
        );

      if (!savedGoal) {
        return;
      }

      const newGoal =
        Number(savedGoal);

      if (!newGoal || newGoal < 500) {
        return;
      }

      setWaterGoal(newGoal);
    };

    /*
      Same-tab updates from WaterSettings.
    */
    window.addEventListener(
      "water-settings-updated",
      loadWaterGoal
    );

    /*
      Cross-tab localStorage updates.
    */
    window.addEventListener(
      "storage",
      loadWaterGoal
    );

    return () => {
      window.removeEventListener(
        "water-settings-updated",
        loadWaterGoal
      );

      window.removeEventListener(
        "storage",
        loadWaterGoal
      );
    };
  }, []);

  /* =========================================
     CHECK FOR NEW DAY
  ========================================= */

  useEffect(() => {
    const checkDay = () => {
      const currentDay =
        new Date().toDateString();

      const savedDay =
        localStorage.getItem(
          "waterDate"
        );

      if (savedDay !== currentDay) {
        localStorage.setItem(
          "waterDate",
          currentDay
        );

        localStorage.setItem(
          "waterConsumed",
          "0"
        );

        localStorage.removeItem(
          "waterRewarded"
        );

        setWaterConsumed(0);
        setShowReward(false);
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

  /* =========================================
     SAVE WATER PROGRESS
  ========================================= */

  useEffect(() => {
    localStorage.setItem(
      "waterConsumed",
      String(waterConsumed)
    );
  }, [waterConsumed]);

  /* =========================================
     CALCULATIONS
  ========================================= */

  const progress =
    waterGoal > 0
      ? Math.min(
          (waterConsumed /
            waterGoal) *
            100,
          100
        )
      : 0;

  const remaining =
    Math.max(
      waterGoal -
        waterConsumed,
      0
    );

  /*
    Bottle works opposite to progress.

    0% consumed   = full bottle
    100% consumed = empty bottle
  */

  const bottleLevel =
    100 - progress;

  /* =========================================
     DRINK WATER
  ========================================= */

  const drinkWater = (amount) => {
    const numericAmount =
      Number(amount);

    if (
      !numericAmount ||
      numericAmount <= 0
    ) {
      return;
    }

    /* PLAY GULP SOUND */

    if (gulpSound.current) {
      gulpSound.current.currentTime = 0;

      gulpSound.current
        .play()
        .catch(() => {
          // Browser may block audio playback.
        });
    }

    const previousAmount =
      waterConsumed;

    const newAmount =
      Math.min(
        waterConsumed +
          numericAmount,
        waterGoal
      );

    setWaterConsumed(
      newAmount
    );

    setCustomAmount("");
    setShowDrinkModal(false);

    /* GOAL REACHED */

    if (
      previousAmount <
        waterGoal &&
      newAmount >=
        waterGoal
    ) {
      const alreadyRewarded =
        localStorage.getItem(
          "waterRewarded"
        ) === "true";

      if (!alreadyRewarded) {
        localStorage.setItem(
          "waterRewarded",
          "true"
        );

        setTimeout(() => {
          setShowReward(true);

          if (onWaterReward) {
            onWaterReward(50);
          }
        }, 700);
      }
    }
  };

  /* =========================================
     RESET TODAY'S WATER

     Kept directly on the card for now
     so you can test it easily.

     This does NOT change the daily goal.
  ========================================= */

  const resetWaterToday = () => {
    localStorage.setItem(
      "waterDate",
      today
    );

    localStorage.setItem(
      "waterConsumed",
      "0"
    );

    localStorage.removeItem(
      "waterRewarded"
    );

    setWaterConsumed(0);
    setShowReward(false);
    setShowDrinkModal(false);
    setCustomAmount("");
  };

  return (
    <>
      {/* =====================================
          WATER CARD
      ===================================== */}

      <motion.div
        className="water-card"
        whileHover={{
          scale: 1.02,
        }}
      >
        {/* HEADER */}

        <div className="water-card-header">
          <div>
            <div className="water-card-label">
              <Droplet
                size={20}
                className="water-droplet-icon"
              />

              DRINK WATER
            </div>

            <div className="water-card-subtitle">
              {remaining > 0
                ? `${remaining} ml left today`
                : "Daily goal complete! 🎉"}
            </div>
          </div>
        </div>

        {/* WATER CONTENT */}

        <div className="water-card-content">

          {/* BOTTLE */}

          <div className="bottle-section">
            <div className="bottle">

              <div className="bottle-cap" />

              <div className="bottle-body">

                <motion.div
                  className="bottle-liquid"
                  animate={{
                    height: `${bottleLevel}%`,
                  }}
                  transition={{
                    duration: 0.8,
                    ease: "easeInOut",
                  }}
                >
                  <div className="liquid-wave wave-1" />

                  <div className="liquid-wave wave-2" />

                  <div className="bubbles">
                    <span />
                    <span />
                    <span />
                  </div>
                </motion.div>

                <div className="bottle-shine" />

              </div>
            </div>

            <div className="bottle-percent">
              {Math.round(progress)}%
            </div>
          </div>

          {/* INFORMATION */}

          <div className="water-info">

            <div className="water-goal-label">
              DAILY GOAL
            </div>

            <div className="water-goal">
              {waterGoal}

              <span>
                ml
              </span>
            </div>

            <div className="water-consumed">
              {waterConsumed} ml consumed
            </div>

            {/* PROGRESS */}

            <div className="water-progress">
              <motion.div
                className="water-progress-fill"
                animate={{
                  width: `${progress}%`,
                }}
                transition={{
                  duration: 0.6,
                }}
              />
            </div>

            <div className="water-progress-text">
              <span>
                {waterConsumed} ml
              </span>

              <span>
                {waterGoal} ml
              </span>
            </div>

            {/* DRINK BUTTON */}

            <button
              className="drink-button"
              disabled={
                progress >= 100
              }
              onClick={() =>
                setShowDrinkModal(
                  true
                )
              }
            >
              <Plus size={18} />

              {progress >= 100
                ? "GOAL COMPLETE"
                : "DRINK WATER"}
            </button>

            {/* RESET TODAY */}

            <button
              type="button"
              className="reset-water-button"
              onClick={resetWaterToday}
              title="Reset today's water"
              aria-label="Reset today's water"
            >
              <RotateCcw size={17} />
            </button>
            
          </div>
        </div>
      </motion.div>

      {/* =====================================
          DRINK AMOUNT MODAL
      ===================================== */}

      <AnimatePresence>
        {showDrinkModal && (
          <motion.div
            className="action-modal-overlay"
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
              setShowDrinkModal(
                false
              )
            }
          >
            <motion.div
              className="action-modal"
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
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <button
                className="modal-close"
                onClick={() =>
                  setShowDrinkModal(
                    false
                  )
                }
              >
                <X size={18} />
              </button>

              <div className="modal-water-icon">
                <Droplet size={28} />
              </div>

              <h3>
                How much did you drink?
              </h3>

              {/* PRESET AMOUNTS */}

              <div className="drink-options">
                {DRINK_AMOUNTS.map(
                  (amount) => (
                    <button
                      key={amount}
                      onClick={() =>
                        drinkWater(
                          amount
                        )
                      }
                    >
                      +{amount} ml
                    </button>
                  )
                )}
              </div>

              {/* CUSTOM AMOUNT */}

              <div className="custom-drink">
                <input
                  type="number"
                  min="1"
                  placeholder="Custom amount"
                  value={
                    customAmount
                  }
                  onChange={(e) =>
                    setCustomAmount(
                      e.target.value
                    )
                  }
                />

                <button
                  onClick={() =>
                    drinkWater(
                      customAmount
                    )
                  }
                >
                  ADD
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================
          XP REWARD
      ===================================== */}

      <AnimatePresence>
        {showReward && (
          <motion.div
            className="action-modal-overlay reward-overlay"
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
              className="xp-modal"
              initial={{
                scale: 0.5,
                opacity: 0,
                y: 40,
              }}
              animate={{
                scale: 1,
                opacity: 1,
                y: 0,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 18,
              }}
            >
              <motion.div
                className="reward-sparkle"
                animate={{
                  rotate: [
                    0,
                    10,
                    -10,
                    0,
                  ],
                  scale: [
                    1,
                    1.15,
                    1,
                  ],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                }}
              >
                <Sparkles size={42} />
              </motion.div>

              <div className="reward-icon">
                <Droplet size={38} />
              </div>

              <h2>
                Daily Goal Complete!
              </h2>

              <p>
                You drank{" "}
                {waterGoal} ml today.
              </p>

              <div className="xp-earned">
                +50 XP
              </div>

              <p className="reward-text">
                Amazing hydration!
                Keep your streak
                going. 💧
              </p>

              <button
                className="awesome-button"
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