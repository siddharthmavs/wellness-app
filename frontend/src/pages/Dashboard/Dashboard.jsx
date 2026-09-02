import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

import {
  BrutalButton,
  BrutalBadge,
} from "../../components/brutal";

import { EyeCareTimer } from "../../components/EyeCareTimer";
import WeeklyInsightsCard from "../../components/WeeklyInsightsCard";

import {
  DidYouKnowCard,
  WordOfDayCard,
  SpotlightCard,
} from "../../components/DashboardCards";

import { CompanionMascot } from "../../components/CompanionMascot";
import {
  IconLeaf,
  IconSparkle,
} from "../../components/HandDrawn";

import { useAuthStore } from "../../store";
import { api } from "../../lib/api";
import { toast } from "sonner";

import {
  Sparkles,
  Cloud,
} from "lucide-react";

import ActionCards from "./components/ActionCards";

export default function Dashboard() {
  const { user, setUser } = useAuthStore();

  const [challenges, setChallenges] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [insight, setInsight] = useState("");

  /* =========================================================
     LOAD CHALLENGES
  ========================================================= */

  const loadChallenges = async () => {
    try {
      const { data } =
        await api.get("/challenges");

      setChallenges(
        Array.isArray(data) ? data : []
      );
    } catch (error) {
      console.error(
        "Failed to load challenges:",
        error
      );
    }
  };

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    loadChallenges();
  }, []);

  /* =========================================================
     WELLNESS ACTION
  ========================================================= */

  const doAction = async (type) => {
    try {
      const { data } =
        await api.post("/activities", {
          type,
        });

      setUser({
        ...user,
        points: data.points,
        level: data.level,
        wellness_score:
          data.wellness_score,
        streak: data.streak,
      });

      toast.success(
        "Action logged successfully!"
      );

      await loadChallenges();
    } catch (error) {
      console.error(
        "Action failed:",
        error
      );

      toast.error(
        "Unable to log the action."
      );
    }
  };

  /* =========================================================
     WATER REWARD
  ========================================================= */

  const handleWaterReward = (xp) => {
    const numericXP = Number(xp) || 0;

    if (numericXP <= 0) {
      return;
    }

    setUser({
      ...user,
      points:
        (user?.points || 0) +
        numericXP,
    });

    toast.success(
      `+${numericXP} XP earned!`
    );
  };

  /* =========================================================
     AI INSIGHT
  ========================================================= */

  const getInsight = async () => {
    if (aiLoading) {
      return;
    }

    setAiLoading(true);

    try {
      const { data } =
        await api.post(
          "/ai/mood-insight",
          {}
        );

      setInsight(
        data?.insight ||
          "Your wellness data is looking interesting. Keep going!"
      );
    } catch (error) {
      console.error(
        "AI insight failed:",
        error
      );

      setInsight(
        "AI took a nap. Try again."
      );
    } finally {
      setAiLoading(false);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <main className="relative min-h-screen">
      <div
        className="
          max-w-7xl
          mx-auto
          px-4
          md:px-6
          py-8
          relative
          leaf-bg
        "
      >
        {/* =====================================================
            BACKGROUND DECORATIONS

            These stay behind dashboard content.
        ===================================================== */}

        <div
          className="
            fixed
            top-28
            left-[3%]
            opacity-20
            floaty-1
            pointer-events-none
            z-0
            hidden
            xl:block
            text-cozy-muted
          "
          aria-hidden="true"
        >
          <Cloud size={68} />
        </div>

        <div
          className="
            fixed
            top-40
            right-[6%]
            opacity-25
            floaty-2
            pointer-events-none
            z-0
            hidden
            lg:block
          "
          aria-hidden="true"
        >
          <IconSparkle size={48} />
        </div>

        <div
          className="
            fixed
            top-[55%]
            left-[2%]
            opacity-25
            floaty-3
            pointer-events-none
            z-0
            hidden
            lg:block
          "
          aria-hidden="true"
        >
          <IconLeaf size={60} />
        </div>

        <div
          className="
            fixed
            top-[45%]
            right-[3%]
            opacity-20
            floaty-1
            pointer-events-none
            z-0
            hidden
            xl:block
            text-cozy-muted
          "
          aria-hidden="true"
        >
          <Cloud size={80} />
        </div>

        <div
          className="
            fixed
            bottom-32
            left-[5%]
            opacity-25
            floaty-2
            pointer-events-none
            z-0
            hidden
            lg:block
          "
          aria-hidden="true"
        >
          <IconSparkle size={56} />
        </div>

        <div
          className="
            fixed
            bottom-16
            right-[8%]
            opacity-25
            floaty-3
            pointer-events-none
            z-0
            hidden
            lg:block
          "
          aria-hidden="true"
        >
          <IconLeaf size={64} />
        </div>

        {/* =====================================================
            ALL NORMAL DASHBOARD CONTENT
            z-10

            This is intentionally below ActionCards.
        ===================================================== */}

        <section className="relative z-10">
          {/* ===================================================
              HERO ROW
          =================================================== */}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* HERO CARD */}

            <motion.div
              initial={{
                y: -12,
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              className="
                md:col-span-2
                relative
                overflow-hidden
                p-6
                md:p-8
              "
              style={{
                background:
                  "linear-gradient(135deg, #F7D9C4 0%, #F2B5A7 100%)",
                borderRadius: 28,
                boxShadow:
                  "var(--shadow-cozy-lg)",
              }}
              data-testid="hero-card"
            >
              <div className="relative z-10 max-w-md">
                <div
                  className="text-sm font-semibold mb-2"
                  style={{
                    color:
                      "var(--cozy-text)",
                    opacity: 0.7,
                  }}
                >
                  {new Date().getHours() < 12
                    ? "Good morning"
                    : new Date().getHours() < 18
                    ? "Good afternoon"
                    : "Good evening"}
                  ,{" "}
                  {user?.name
                    ?.split(" ")[0] ||
                    "friend"}
                </div>

                <h1
                  className="
                    font-display
                    text-4xl
                    md:text-5xl
                    leading-tight
                    mb-4
                  "
                  style={{
                    color:
                      "var(--cozy-text)",
                  }}
                >
                  A calm start makes
                  a strong day.
                </h1>

                <p
                  className="font-hand text-lg"
                  style={{
                    color:
                      "var(--cozy-text)",
                    opacity: 0.8,
                  }}
                >
                  your daily ritual,
                  one small step at a
                  time
                </p>

                <div className="flex gap-2 mt-5 flex-wrap">
                  <span
                    className="
                      px-3
                      py-1
                      rounded-full
                      text-xs
                      font-semibold
                    "
                    style={{
                      background:
                        "rgba(255,255,255,0.5)",
                    }}
                  >
                    {user?.streak || 0}{" "}
                    day streak
                  </span>

                  <span
                    className="
                      px-3
                      py-1
                      rounded-full
                      text-xs
                      font-semibold
                    "
                    style={{
                      background:
                        "rgba(255,255,255,0.5)",
                    }}
                  >
                    {user?.points || 0}{" "}
                    pts
                  </span>

                  <span
                    className="
                      px-3
                      py-1
                      rounded-full
                      text-xs
                      font-semibold
                    "
                    style={{
                      background:
                        "rgba(255,255,255,0.5)",
                    }}
                  >
                    Level{" "}
                    {user?.level || 1}
                  </span>
                </div>
              </div>

              <div
                className="
                  absolute
                  right-4
                  bottom-0
                  opacity-90
                  pointer-events-none
                  z-0
                "
              >
                <CompanionMascot
                  state={
                    (user?.wellness_score ||
                      50) >= 60
                      ? "happy"
                      : (user?.wellness_score ||
                          50) >= 40
                      ? "idle"
                      : "sad"
                  }
                  size={140}
                />
              </div>
            </motion.div>

            {/* WELLNESS SCORE */}

            <motion.div
              initial={{
                y: -12,
                opacity: 0,
              }}
              animate={{
                y: 0,
                opacity: 1,
              }}
              className="p-6"
              style={{
                background:
                  "var(--cozy-surface)",
                borderRadius: 24,
                boxShadow:
                  "var(--shadow-cozy)",
                border:
                  "1px solid var(--cozy-border)",
              }}
              data-testid="wellness-score-card"
            >
              <div
                className="
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wider
                  mb-2
                "
                style={{
                  color:
                    "var(--cozy-muted)",
                }}
              >
                Wellness Garden
              </div>

              <div
                className="
                  font-display
                  text-6xl
                  leading-none
                "
                style={{
                  color:
                    "var(--cozy-primary-dark)",
                }}
              >
                {user?.wellness_score ||
                  50}

                <span
                  className="text-2xl"
                  style={{
                    color:
                      "var(--cozy-muted)",
                  }}
                >
                  /100
                </span>
              </div>

              <div
                className="mt-4 h-3 overflow-hidden"
                style={{
                  borderRadius: 999,
                  background:
                    "var(--cozy-bg)",
                }}
              >
                <div
                  className="
                    h-full
                    transition-all
                  "
                  style={{
                    width: `${
                      user?.wellness_score ||
                      50
                    }%`,
                    background:
                      "linear-gradient(90deg, #7FAE62 0%, #A8D189 100%)",
                    borderRadius: 999,
                  }}
                />
              </div>

              <p
                className="
                  mt-3
                  text-xs
                  font-medium
                "
                style={{
                  color:
                    "var(--cozy-muted)",
                }}
              >
                Nurture with small
                daily acts
              </p>
            </motion.div>
          </div>

          {/* ===================================================
              DAILY KNOWLEDGE
          =================================================== */}

          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-3
              gap-6
              mb-8
            "
          >
            <DidYouKnowCard />
            <WordOfDayCard />
            <SpotlightCard />
          </div>
        </section>

        {/* =====================================================
            QUICK ACTIONS / WELLNESS CARDS

            IMPORTANT:
            This is intentionally z-40.

            The modal components used by:
              - WaterCard
              - EyeBreakCard
              - MoveResetCard
              - BreatheCard

            live inside ActionCards.

            Giving this section a higher stacking layer keeps
            those modals above the dashboard's lower cards.
        ===================================================== */}

        <section
          className="
            relative
            z-40
            overflow-visible
            mb-10
          "
        >
          <h2
            className="
              font-display
              text-2xl
              mb-4
            "
            style={{
              color:
                "var(--cozy-text)",
            }}
          >
            Today's rituals
          </h2>

          <div className="relative z-40 overflow-visible">
            <ActionCards
              onAction={doAction}
              onWaterReward={
                handleWaterReward
              }
            />
          </div>
        </section>

        {/* =====================================================
            BOTTOM ROW

            Kept at z-10 so it stays below ActionCards/modal
            stacking layer.
        ===================================================== */}

        
          <section
            className="
              relative
              grid
              grid-cols-1
              lg:grid-cols-2
              gap-6
            "
          >
            
          {/* EYE CARE TIMER */}

          <EyeCareTimer
            onBreakComplete={() =>
              doAction("eye_care")
            }
          />

          {/* WEEKLY INSIGHTS */}

          <WeeklyInsightsCard />

          {/* TODAY'S CHALLENGES */}

          <div
            className="
              bg-white
              border-[4px]
              border-black
              shadow-brutal-lg
              rounded-[4px]
              p-5
            "
            data-testid="challenges-card"
          >
            <h3
              className="
                font-display
                font-black
                uppercase
                text-xl
                mb-3
              "
            >
              Today's Challenges
            </h3>

            <div className="space-y-2">
              {challenges.length === 0 ? (
                <div className="text-xs font-bold opacity-50">
                  No challenges available
                  right now.
                </div>
              ) : (
                challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="
                      border-[3px]
                      border-black
                      p-3
                      rounded-[2px]
                      flex
                      items-center
                      justify-between
                      gap-2
                      bg-brutal-yellow/30
                    "
                  >
                    <div>
                      <div
                        className="
                          font-black
                          text-sm
                          uppercase
                        "
                      >
                        {challenge.title}
                      </div>

                      <div
                        className="
                          text-xs
                          font-bold
                        "
                      >
                        {challenge.progress}/
                        {challenge.target}{" "}
                        done
                      </div>
                    </div>

                    {challenge.done ? (
                      <BrutalBadge color="green">
                        DONE +
                        {challenge.reward}
                      </BrutalBadge>
                    ) : (
                      <BrutalBadge color="pink">
                        +
                        {challenge.reward}{" "}
                        PTS
                      </BrutalBadge>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ===================================================
              AI INSIGHT
          =================================================== */}

          <div
            className="
              bg-brutal-cyan
              border-[4px]
              border-black
              shadow-brutal-lg
              rounded-[4px]
              p-5
            "
            data-testid="ai-insight-card"
          >
            <h3
              className="
                font-display
                font-black
                uppercase
                text-xl
                mb-3
                flex
                items-center
                gap-2
              "
            >
              <Sparkles className="w-5 h-5" />
              AI Vibe Check
            </h3>

            <p
              className="
                text-sm
                font-semibold
                min-h-[80px]
              "
            >
              {insight ||
                "Tap below for a brutally honest take on your recent moods."}
            </p>

            <BrutalButton
              data-testid="ai-insight-btn"
              color="black"
              onClick={getInsight}
              disabled={aiLoading}
              className="mt-3 w-full"
            >
              {aiLoading
                ? " THINKING..."
                : " GET INSIGHT"}
            </BrutalButton>
          </div>
        </section>
      </div>
    </main>
  );
}