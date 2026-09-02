import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
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
} from "lucide-react";

import "./WaterCard.css";

const DRINK_AMOUNTS = [100, 250, 500];

const WATER_GOAL_KEY = "waterGoal";
const REWARD_CONFIG_KEY = "wellness-reward-config";

const DEFAULT_WATER_GOAL = 2000;
const DEFAULT_WATER_REWARD_GOAL = 2000;

const DEFAULT_WATER_REWARDS = [
  { threshold: 50, xp: 10 },
  { threshold: 75, xp: 20 },
  { threshold: 100, xp: 50 },
];

export default function WaterCard({
  onWaterReward,
}) {
  const getToday = () => new Date().toDateString();
  const todayRef = useRef(getToday());

  /* =========================================
     GULP SOUND
  ========================================= */

  const gulpSound = useRef(null);

  useEffect(() => {
    const audio = new Audio("/sounds/water-gulp.mp3");
    audio.volume = 0.7;
    gulpSound.current = audio;

    return () => {
      audio.pause();
      gulpSound.current = null;
    };
  }, []);

  /* =========================================
     PERSONAL WATER GOAL
  ========================================= */

  const [waterGoal, setWaterGoal] = useState(() => {
    const saved = localStorage.getItem(WATER_GOAL_KEY);
    return saved ? Number(saved) : DEFAULT_WATER_GOAL;
  });

  /* =========================================
     ADMIN REWARD GOAL
  ========================================= */

  const [rewardGoal, setRewardGoal] = useState(() => {
    try {
      const saved = localStorage.getItem(REWARD_CONFIG_KEY);
      if (!saved) return DEFAULT_WATER_REWARD_GOAL;

      const parsed = JSON.parse(saved);
      const configuredGoal = Number(parsed?.water?.rewardGoal);

      return Number.isFinite(configuredGoal) && configuredGoal > 0
        ? configuredGoal
        : DEFAULT_WATER_REWARD_GOAL;
    } catch {
      return DEFAULT_WATER_REWARD_GOAL;
    }
  });

  const [
    workingTowardRewardGoal,
    setWorkingTowardRewardGoal,
  ] = useState(false);

  /* =========================================
     WATER CONSUMED
  ========================================= */

  const [waterConsumed, setWaterConsumed] = useState(() => {
    const currentDay = getToday();
    const savedDate = localStorage.getItem("waterDate");

    if (savedDate !== currentDay) {
      localStorage.setItem("waterDate", currentDay);
      localStorage.setItem("waterConsumed", "0");
      localStorage.removeItem(`waterRewardedMilestones-${currentDay}`);
      return 0;
    }

    return Number(localStorage.getItem("waterConsumed") || 0);
  });

  /* =========================================
     ADMIN REWARD MILESTONES
  ========================================= */

  const [waterRewards, setWaterRewards] = useState(DEFAULT_WATER_REWARDS);

  const [rewardedMilestones, setRewardedMilestones] = useState(() => {
    const currentDay = getToday();
    try {
      return (
        JSON.parse(
          localStorage.getItem(`waterRewardedMilestones-${currentDay}`)
        ) || {}
      );
    } catch {
      return {};
    }
  });

  /* =========================================
     MODAL STATE
  ========================================= */

  const [showDrinkModal, setShowDrinkModal] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [showGoalComplete, setShowGoalComplete] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [currentReward, setCurrentReward] = useState(null);
  const [pendingReward, setPendingReward] = useState(null);

  /* =========================================
     LOAD ADMIN REWARD SETTINGS
  ========================================= */

  const loadWaterRewards = useCallback(() => {
    try {
      const saved = localStorage.getItem(REWARD_CONFIG_KEY);

      if (!saved) {
        setRewardGoal(DEFAULT_WATER_REWARD_GOAL);
        setWaterRewards(DEFAULT_WATER_REWARDS);
        return;
      }

      const parsed = JSON.parse(saved);
      const configuredRewardGoal = Number(parsed?.water?.rewardGoal);

      setRewardGoal(
        Number.isFinite(configuredRewardGoal) && configuredRewardGoal > 0
          ? configuredRewardGoal
          : DEFAULT_WATER_REWARD_GOAL
      );

      const milestones = parsed?.water?.milestones;

      if (Array.isArray(milestones) && milestones.length > 0) {
        const validMilestones = milestones
          .map((item) => ({
            threshold: Number(item.threshold),
            xp: Number(item.xp),
          }))
          .filter(
            (item) =>
              Number.isFinite(item.threshold) &&
              Number.isFinite(item.xp) &&
              item.threshold > 0 &&
              item.threshold <= 100 &&
              item.xp >= 0
          )
          .sort((a, b) => a.threshold - b.threshold);

        setWaterRewards(
          validMilestones.length > 0
            ? validMilestones
            : DEFAULT_WATER_REWARDS
        );
      } else {
        setWaterRewards(DEFAULT_WATER_REWARDS);
      }
    } catch (error) {
      console.error("Failed to load water reward rules:", error);
      setRewardGoal(DEFAULT_WATER_REWARD_GOAL);
      setWaterRewards(DEFAULT_WATER_REWARDS);
    }
  }, []);

  /* =========================================
     LISTEN FOR ADMIN REWARD CHANGES
  ========================================= */

  useEffect(() => {
    loadWaterRewards();

    const handleRewardsUpdated = (event) => {
      const waterConfig = event?.detail?.water;
      const updatedRewardGoal = Number(waterConfig?.rewardGoal);

      if (Number.isFinite(updatedRewardGoal) && updatedRewardGoal > 0) {
        setRewardGoal(updatedRewardGoal);
      } else {
        setRewardGoal(DEFAULT_WATER_REWARD_GOAL);
      }

      const updatedRewards = waterConfig?.milestones;

      if (Array.isArray(updatedRewards)) {
        const normalized = updatedRewards
          .map((item) => ({
            threshold: Number(item.threshold),
            xp: Number(item.xp),
          }))
          .filter(
            (item) =>
              Number.isFinite(item.threshold) &&
              Number.isFinite(item.xp) &&
              item.threshold > 0 &&
              item.threshold <= 100 &&
              item.xp >= 0
          )
          .sort((a, b) => a.threshold - b.threshold);

        setWaterRewards(
          normalized.length > 0 ? normalized : DEFAULT_WATER_REWARDS
        );
      } else {
        loadWaterRewards();
      }
    };

    window.addEventListener("wellnessRewardsUpdated", handleRewardsUpdated);
    window.addEventListener("storage", loadWaterRewards);

    return () => {
      window.removeEventListener("wellnessRewardsUpdated", handleRewardsUpdated);
      window.removeEventListener("storage", loadWaterRewards);
    };
  }, [loadWaterRewards]);

  /* =========================================
     SYNC PERSONAL WATER GOAL
  ========================================= */

  useEffect(() => {
    const loadWaterGoal = () => {
      const savedGoal = localStorage.getItem(WATER_GOAL_KEY);
      if (!savedGoal) return;

      const newGoal = Number(savedGoal);
      if (!newGoal || newGoal < 500) return;

      setWaterGoal(newGoal);
    };

    window.addEventListener("water-settings-updated", loadWaterGoal);
    window.addEventListener("storage", loadWaterGoal);

    return () => {
      window.removeEventListener("water-settings-updated", loadWaterGoal);
      window.removeEventListener("storage", loadWaterGoal);
    };
  }, []);

  /* =========================================
     LISTEN FOR WATER PROGRESS RESET
  ========================================= */

  useEffect(() => {
    const handleWaterReset = () => {
      setWaterConsumed(0);
      setRewardedMilestones({});
      setCurrentReward(null);
      setShowReward(false);
      setShowGoalComplete(false);
      setWorkingTowardRewardGoal(false);
    };

    window.addEventListener(
      "water-progress-reset",
      handleWaterReset
    );

    return () => {
      window.removeEventListener(
        "water-progress-reset",
        handleWaterReset
      );
    };
  }, []);

  /* =========================================
     CHECK FOR NEW DAY
  ========================================= */

  useEffect(() => {
    const checkDay = () => {
      const currentDay = getToday();

      if (todayRef.current !== currentDay) {
        todayRef.current = currentDay;
        localStorage.setItem("waterDate", currentDay);
        localStorage.setItem("waterConsumed", "0");
        localStorage.removeItem(`waterRewardedMilestones-${currentDay}`);

        setWaterConsumed(0);
        setRewardedMilestones({});
        setCurrentReward(null);
        setShowReward(false);
        setShowGoalComplete(false);
        setWorkingTowardRewardGoal(false);
      }
    };

    const interval = setInterval(checkDay, 60000);
    return () => clearInterval(interval);
  }, []);

  /* =========================================
     SAVE WATER PROGRESS & MILESTONES
  ========================================= */

  useEffect(() => {
    localStorage.setItem("waterConsumed", String(waterConsumed));
  }, [waterConsumed]);

  useEffect(() => {
    const currentDay = todayRef.current;
    localStorage.setItem(
      `waterRewardedMilestones-${currentDay}`,
      JSON.stringify(rewardedMilestones)
    );
  }, [rewardedMilestones]);

  /* =========================================
     ACTIVE DISPLAY GOAL & CALCULATIONS
  ========================================= */

  const activeGoal = workingTowardRewardGoal ? rewardGoal : waterGoal;

  const personalGoalComplete = waterConsumed >= waterGoal;
  const rewardGoalComplete = waterConsumed >= rewardGoal;
  const allGoalsComplete = personalGoalComplete && rewardGoalComplete;

  const progress =
    activeGoal > 0 ? Math.min((waterConsumed / activeGoal) * 100, 100) : 0;

  const personalGoalProgress =
    waterGoal > 0 ? Math.min((waterConsumed / waterGoal) * 100, 100) : 0;

  const remaining = Math.max(activeGoal - waterConsumed, 0);
  const bottleLevel = 100 - progress;

  /* =========================================
     FIND NEWLY REACHED REWARD MILESTONES
  ========================================= */

  const getNewlyReachedMilestones = (previousAmount, newAmount) => {
    if (!rewardGoal) return [];

    const previousProgress = Math.min(
      (previousAmount / rewardGoal) * 100,
      100
    );
    const newProgress = Math.min((newAmount / rewardGoal) * 100, 100);

    return waterRewards
      .filter(
        (milestone) =>
          newProgress >= milestone.threshold &&
          previousProgress < milestone.threshold
      )
      .filter((milestone) => !rewardedMilestones[String(milestone.threshold)])
      .sort((a, b) => a.threshold - b.threshold);
  };

  /* =========================================
     DRINK WATER
  ========================================= */

  const drinkWater = (amount) => {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0 || allGoalsComplete) return;

    if (gulpSound.current) {
      gulpSound.current.currentTime = 0;
      gulpSound.current.play().catch(() => {});
    }

    const previousAmount = waterConsumed;
    const newAmount = waterConsumed + numericAmount;

    const newlyReached = getNewlyReachedMilestones(
      previousAmount,
      newAmount
    );

   const reachedPersonalGoal =
    !workingTowardRewardGoal &&
    waterGoal > 0 &&
    previousAmount < waterGoal &&
    newAmount >= waterGoal; 

    setWaterConsumed(newAmount);
    setCustomAmount("");
    setShowDrinkModal(false);

    if (reachedPersonalGoal) {
      setTimeout(() => {
        setShowGoalComplete(true);
      }, 300);
    }

    if (newlyReached.length > 0) {
      const updatedRewarded = { ...rewardedMilestones };
      newlyReached.forEach((milestone) => {
        updatedRewarded[String(milestone.threshold)] = true;
      });

      setRewardedMilestones(updatedRewarded);

      const highestMilestone = newlyReached[newlyReached.length - 1];

      if (reachedPersonalGoal) {
        setPendingReward(highestMilestone);
      } else {
        setCurrentReward(highestMilestone);
        setShowReward(true);
      }

      newlyReached.forEach((milestone) => {
        if (onWaterReward) {
          onWaterReward(milestone.xp);
        }
      });
    }
  };

  const continueTowardRewardGoal = () => {
    setWorkingTowardRewardGoal(true);
    setShowGoalComplete(false);

    if (pendingReward) {
      setCurrentReward(pendingReward);
      setPendingReward(null);

      setTimeout(() => {
        setShowReward(true);
      }, 300);
    }
  };

  const finishForToday = () => {
    setShowGoalComplete(false);
    setPendingReward(null);
  };

  /* =========================================
     RENDER
  ========================================= */

  return (
    <>
      <motion.div
        className="water-card"
        whileHover={{ scale: 1.02 }}
      >
        <div className="water-card-header">
          <div>
            <div className="water-card-label">
              <Droplet size={20} className="water-droplet-icon" />
              DRINK WATER
            </div>
            <div className="water-card-subtitle">
              {allGoalsComplete
                ? "All goals complete! 🏆"
                : remaining > 0
                ? `${remaining} ml left today`
                : workingTowardRewardGoal
                ? "Reward goal complete! 🏆"
                : "Daily goal complete! 🎉"}
            </div>
          </div>
        </div>

        <div className="water-card-content">
          <div className="bottle-section">
            <div className="bottle">
              <div className="bottle-cap" />
              <div className="bottle-body">
                <motion.div
                  className="bottle-liquid"
                  animate={{ height: `${bottleLevel}%` }}
                  transition={{ duration: 0.8, ease: "easeInOut" }}
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
            <div className="bottle-percent">{Math.round(progress)}%</div>
          </div>

          <div className="water-info">
            <div className="water-goal-label">
              {workingTowardRewardGoal ? "REWARD GOAL" : "DAILY GOAL"}
            </div>

            <div className="water-goal">
              {activeGoal}
              <span>ml</span>
            </div>

            <div className="water-consumed">{waterConsumed} ml consumed</div>

            <div className="water-progress">
              <motion.div
                className="water-progress-fill"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>

            <div className="water-progress-text">
              <span>{waterConsumed} ml</span>
              <span>{activeGoal} ml</span>
            </div>

            {!workingTowardRewardGoal &&
              personalGoalProgress >= 100 &&
              rewardGoal > waterGoal && (
                <div className="reward-goal-note">
                  🏆 Reward goal: {rewardGoal} ml
                </div>
              )}

            {!workingTowardRewardGoal &&
              rewardGoalComplete &&
              rewardGoal <= waterGoal && (
                <div className="reward-goal-note">
                  🏆 Reward goal complete
                </div>
              )}

            <button
              className="drink-button"
              onClick={() => setShowDrinkModal(true)}
              disabled={allGoalsComplete}
            >
              {allGoalsComplete ? (
                <>✓ ALL GOALS COMPLETE</>
              ) : (
                <>
                  <Plus size={18} />
                  DRINK WATER
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* DRINK AMOUNT MODAL */}
      <AnimatePresence>
        {showDrinkModal && (
          <motion.div
            className="action-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDrinkModal(false)}
          >
            <motion.div
              className="action-modal"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setShowDrinkModal(false)}
              >
                <X size={18} />
              </button>

              <div className="modal-water-icon">
                <Droplet size={28} />
              </div>

              <h3>How much did you drink?</h3>

              <div className="drink-options">
                {DRINK_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => drinkWater(amount)}
                  >
                    +{amount} ml
                  </button>
                ))}
              </div>

              <div className="custom-drink">
                <input
                  type="number"
                  min="1"
                  placeholder="Custom amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
                <button onClick={() => drinkWater(customAmount)}>
                  ADD
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PERSONAL GOAL COMPLETE POPUP */}
      <AnimatePresence>
        {showGoalComplete && (
          <motion.div
            className="action-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="xp-modal"
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="reward-icon">
                <Droplet size={38} />
              </div>

              <h2>🎉 Daily Goal Complete!</h2>

              <p>
                You've reached your personal goal of{" "}
                <strong>{waterGoal} ml</strong>.
              </p>

              <p>
                🏆 Reward Goal: <strong>{rewardGoal} ml</strong>
              </p>

              <p className="reward-text">
                If you'd like to continue, you can work toward the remaining
                reward milestones.
              </p>

              <div className="goal-complete-actions">
                {waterConsumed < rewardGoal && (
                  <button
                    className="awesome-button"
                    onClick={continueTowardRewardGoal}
                  >
                    CONTINUE DRINKING
                  </button>
                )}

                <button
                  className="awesome-button"
                  onClick={finishForToday}
                >
                  DONE FOR TODAY
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* XP REWARD */}
      <AnimatePresence>
        {showReward && currentReward && (
          <motion.div
            className="action-modal-overlay reward-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="xp-modal"
              initial={{ scale: 0.5, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              <motion.div
                className="reward-sparkle"
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.15, 1],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Sparkles size={42} />
              </motion.div>

              <div className="reward-icon">
                <Droplet size={38} />
              </div>

              <h2>Wellness Milestone!</h2>

              <p>
                You reached <strong>{currentReward.threshold}%</strong> of your
                reward goal.
              </p>

              <p className="reward-goal-popup-note">
                Reward goal: <strong>{rewardGoal} ml</strong>
              </p>

              <div className="xp-earned">+{currentReward.xp} XP</div>

              <p className="reward-text">
                Amazing hydration! Keep your streak going. 💧
              </p>

              <button
                className="awesome-button"
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