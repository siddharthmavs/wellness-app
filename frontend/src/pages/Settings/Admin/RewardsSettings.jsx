import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Droplets,
  Eye,
  PersonStanding,
  Wind,
  Save,
  Check,
  ArrowLeft,
  Plus,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const REWARD_CONFIG_KEY = "wellness-reward-config";

const DEFAULT_REWARDS = {
  water: {
    rewardGoal: "2000",
    unit: "ml",
    milestones: [
      { threshold: "50", xp: "10" },
      { threshold: "75", xp: "20" },
      { threshold: "100", xp: "50" },
    ],
  },
  eyeBreak: {
    rewardGoal: "3",
    unit: "breaks",
    milestones: [
      { threshold: "50", xp: "10" },
      { threshold: "75", xp: "20" },
      { threshold: "100", xp: "50" },
    ],
  },
  moveReset: {
    rewardGoal: "3",
    unit: "sessions",
    milestones: [
      { threshold: "50", xp: "10" },
      { threshold: "75", xp: "20" },
      { threshold: "100", xp: "50" },
    ],
  },
  breathing: {
    rewardGoal: "3",
    unit: "sessions",
    milestones: [
      { threshold: "50", xp: "5" },
      { threshold: "75", xp: "10" },
      { threshold: "100", xp: "20" },
    ],
  },
};

const ACTIVITY_META = {
  water: {
    title: "Water Hydration",
    description: "Set a company reward goal and award XP based on completion.",
    goalLabel: "Admin Reward Goal",
    goalDescription: "Used exclusively for calculating rewards.",
    goalPlaceholder: "2000",
    goalMin: 1,
    goalStep: 1,
    icon: Droplets,
    iconClass: "bg-blue-100 text-blue-600",
  },
  eyeBreak: {
    title: "Eye Break",
    description: "Set a fixed reward goal for daily eye breaks.",
    goalLabel: "Admin Reward Goal",
    goalDescription: "Used exclusively for calculating rewards.",
    goalPlaceholder: "3",
    goalMin: 1,
    goalStep: 1,
    icon: Eye,
    iconClass: "bg-amber-100 text-amber-600",
  },
  moveReset: {
    title: "Move & Reset",
    description: "Set a fixed reward goal for daily movement activity.",
    goalLabel: "Admin Reward Goal",
    goalDescription: "Used exclusively for calculating rewards.",
    goalPlaceholder: "3",
    goalMin: 1,
    goalStep: 1,
    icon: PersonStanding,
    iconClass: "bg-emerald-100 text-emerald-600",
  },
  breathing: {
    title: "Breathing",
    description: "Set a fixed reward goal for daily breathing exercises.",
    goalLabel: "Admin Reward Goal",
    goalDescription: "Used exclusively for calculating rewards.",
    goalPlaceholder: "3",
    goalMin: 1,
    goalStep: 1,
    icon: Wind,
    iconClass: "bg-purple-100 text-purple-600",
  },
};

const cloneRewards = (source) => JSON.parse(JSON.stringify(source));

const normalizeLoadedRewards = (saved) => {
  const normalized = cloneRewards(DEFAULT_REWARDS);
  Object.keys(normalized).forEach((key) => {
    if (saved?.[key]) {
      if (saved[key].rewardGoal !== undefined) {
        normalized[key].rewardGoal = String(saved[key].rewardGoal);
      }
      if (saved[key].unit !== undefined) {
        normalized[key].unit = String(saved[key].unit);
      }
      if (Array.isArray(saved[key].milestones)) {
        normalized[key].milestones = saved[key].milestones.map((item) => ({
          threshold: String(item.threshold ?? ""),
          xp: String(item.xp ?? ""),
        }));
      }
    }
  });
  return normalized;
};

const RewardsSettings = () => {
  const navigate = useNavigate();
  const [rewards, setRewards] = useState(() => cloneRewards(DEFAULT_REWARDS));
  const [savedRewards, setSavedRewards] = useState(() => cloneRewards(DEFAULT_REWARDS));
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REWARD_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const normalized = normalizeLoadedRewards(parsed);
        setRewards(normalized);
        setSavedRewards(cloneRewards(normalized));
      }
    } catch (error) {
      console.error("Failed to load reward configuration:", error);
      toast.error("Could not load saved reward rules.");
    }
  }, []);

  useEffect(() => {
    setHasChanges(JSON.stringify(rewards) !== JSON.stringify(savedRewards));
  }, [rewards, savedRewards]);

  const handleRewardGoalChange = (activity, value) => {
    setRewards((prev) => ({
      ...prev,
      [activity]: { ...prev[activity], rewardGoal: value },
    }));
    setErrors((prev) => ({ ...prev, [`${activity}-goal`]: "" }));
  };

  const handleMilestoneChange = (activity, index, field, value) => {
    setRewards((prev) => {
      const updatedMilestones = [...prev[activity].milestones];
      updatedMilestones[index] = { ...updatedMilestones[index], [field]: value };
      return {
        ...prev,
        [activity]: { ...prev[activity], milestones: updatedMilestones },
      };
    });
    setErrors((prev) => ({
      ...prev,
      [`${activity}-${index}`]: "",
      [`${activity}-duplicate`]: "",
      [`${activity}-order`]: "",
    }));
  };

  const addMilestone = (activity) => {
    setRewards((prev) => ({
      ...prev,
      [activity]: {
        ...prev[activity],
        milestones: [...prev[activity].milestones, { threshold: "", xp: "" }],
      },
    }));
  };

  const removeMilestone = (activity, index) => {
    setRewards((prev) => ({
      ...prev,
      [activity]: {
        ...prev[activity],
        milestones: prev[activity].milestones.filter((_, i) => i !== index),
      },
    }));
  };

  const validateRewards = () => {
    const newErrors = {};
    let isValid = true;

    Object.entries(rewards).forEach(([activity, config]) => {
      const rewardGoal = Number(config.rewardGoal);
      if (config.rewardGoal === "" || !Number.isFinite(rewardGoal) || rewardGoal <= 0) {
        newErrors[`${activity}-goal`] = "Reward goal must be greater than 0.";
        isValid = false;
      }

      if (!config.milestones.length) {
        newErrors[`${activity}-general`] = "Add at least one reward milestone.";
        isValid = false;
        return;
      }

      const numericThresholds = [];
      config.milestones.forEach((milestone, index) => {
        const threshold = Number(milestone.threshold);
        const xp = Number(milestone.xp);

        if (milestone.threshold === "" || !Number.isFinite(threshold) || threshold <= 0 || threshold > 100) {
          newErrors[`${activity}-${index}`] = "Threshold must be between 1% and 100%.";
          isValid = false;
        }

        if (milestone.xp === "" || !Number.isFinite(xp) || xp < 0) {
          newErrors[`${activity}-${index}`] = "XP must be 0 or greater.";
          isValid = false;
        }

        numericThresholds.push(threshold);
      });

      const uniqueThresholds = new Set(numericThresholds);
      if (uniqueThresholds.size !== numericThresholds.length) {
        newErrors[`${activity}-duplicate`] = "Each threshold must be unique.";
        isValid = false;
      }

      const sorted = [...numericThresholds].sort((a, b) => a - b);
      if (numericThresholds.some((val, idx) => val !== sorted[idx])) {
        newErrors[`${activity}-order`] = "Thresholds must be in increasing order.";
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!validateRewards()) {
      toast.error("Please fix the reward rules before saving.");
      return;
    }

    const formattedRewards = {};
    Object.entries(rewards).forEach(([activity, config]) => {
      formattedRewards[activity] = {
        rewardGoal: parseInt(config.rewardGoal, 10) || 0,
        unit: config.unit,
        milestones: config.milestones.map((m) => ({
          threshold: Number(m.threshold),
          xp: Number(m.xp),
        })),
      };
    });

    try {
      localStorage.setItem(REWARD_CONFIG_KEY, JSON.stringify(formattedRewards));
      setSavedRewards(cloneRewards(rewards));
      setErrors({});

      window.dispatchEvent(
        new CustomEvent("wellnessRewardsUpdated", { detail: formattedRewards })
      );

      toast.success("Reward rules updated successfully!");
    } catch (error) {
      console.error("Failed to save rewards:", error);
      toast.error("Could not save reward rules.");
    }
  };

  const handleReset = () => {
    setRewards(cloneRewards(DEFAULT_REWARDS));
    setErrors({});
    toast.info("Defaults restored. Click Save to apply them.");
  };

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <button
        type="button"
        onClick={() => navigate("/settings")}
        className="flex items-center gap-2 text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100 mb-6 transition-opacity"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: "var(--cozy-primary)", color: "white" }}
        >
          <Trophy className="w-7 h-7" />
        </div>
        <div>
          <h1 className="font-display font-black text-2xl md:text-3xl text-cozy-text">
            Rewards & Gamification
          </h1>
          <p className="text-xs md:text-sm opacity-60 mt-1 text-cozy-text">
            Set fixed admin reward goals and configure XP milestones for each wellness activity.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {Object.entries(ACTIVITY_META).map(([activity, meta]) => {
          const Icon = meta.icon;
          const milestones = rewards[activity].milestones;
          const goalError = errors[`${activity}-goal`];

          return (
            <div key={activity} className="bg-cozy-surface p-6 shadow-cozy border border-cozy-border rounded-[20px]">
              <div className="flex items-start gap-3 mb-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.iconClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-cozy-text">{meta.title}</h2>
                  <p className="text-xs opacity-60 mt-1 text-cozy-text">{meta.description}</p>
                </div>
              </div>

              <div className="mb-6 p-4 rounded-xl bg-cozy-bg border border-cozy-border">
                <label className="block text-[10px] font-black uppercase tracking-wider opacity-60 mb-2">
                  {meta.goalLabel}
                </label>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={meta.goalMin}
                    step={meta.goalStep}
                    value={rewards[activity].rewardGoal}
                    onChange={(e) => handleRewardGoalChange(activity, e.target.value)}
                    placeholder={meta.goalPlaceholder}
                    className={`w-full px-4 py-3 pr-20 rounded-xl bg-cozy-surface border ${
                      goalError ? "border-red-400" : "border-cozy-border"
                    } font-bold text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-black`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black opacity-50">
                    {rewards[activity].unit}
                  </span>
                </div>
                {goalError && <p className="text-[11px] font-semibold text-red-500 mt-2">{goalError}</p>}
              </div>

              <div className="space-y-3">
                {milestones.map((milestone, index) => {
                  const error = errors[`${activity}-${index}`];
                  return (
                    <motion.div
                      key={`${activity}-${index}`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 md:grid-cols-[1fr_1fr_48px] gap-3 items-start"
                    >
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={milestone.threshold}
                        onChange={(e) => handleMilestoneChange(activity, index, "threshold", e.target.value)}
                        placeholder="50"
                        className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm"
                      />
                      <input
                        type="number"
                        min="0"
                        value={milestone.xp}
                        onChange={(e) => handleMilestoneChange(activity, index, "xp", e.target.value)}
                        placeholder="10"
                        className="w-full px-4 py-3 rounded-xl bg-cozy-bg border border-cozy-border font-bold text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeMilestone(activity, index)}
                        disabled={milestones.length === 1}
                        className="h-[46px] rounded-xl flex items-center justify-center border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {error && <p className="md:col-span-3 text-[11px] font-semibold text-red-500">{error}</p>}
                    </motion.div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => addMilestone(activity)}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl border border-cozy-border text-xs font-black uppercase tracking-wide hover:bg-cozy-bg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Threshold
              </button>
            </div>
          );
        })}

        <div className="flex justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-3 rounded-xl border border-cozy-border font-bold text-sm text-cozy-text hover:bg-cozy-surface"
          >
            Reset to Defaults
          </button>
          <motion.button
            type="submit"
            disabled={!hasChanges}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
              hasChanges ? "bg-black text-white cursor-pointer" : "bg-cozy-surface opacity-50 cursor-not-allowed"
            }`}
          >
            {hasChanges ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4 text-emerald-600" />}
            {hasChanges ? "Save Reward Rules" : "Saved"}
          </motion.button>
        </div>
      </form>
    </main>
  );
};

export default RewardsSettings;