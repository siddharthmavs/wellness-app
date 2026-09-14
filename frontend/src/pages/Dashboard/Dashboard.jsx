
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

import {
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

import { useAuthStore } from "../../store";
import { api } from "../../lib/api";
import { toast } from "sonner";

import ActionCards from "./components/ActionCards";

/* =========================================================
   DASHBOARD
========================================================= */

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
      const { data } = await api.get(
        "/challenges"
      );

      setChallenges(
        Array.isArray(data)
          ? data
          : []
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
        await api.post(
          "/activities",
          {
            type,
          }
        );

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
    const numericXP =
      Number(xp) || 0;

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
    <main className="dashboard-page">

      {/* =================================================
          DASHBOARD CONTENT
      ================================================= */}

      <div
        className="
          dashboard-container
          max-w-7xl
          mx-auto
          px-4
          md:px-6
          py-8
        "
      >

        {/* =================================================
            HERO ROW
        ================================================= */}

        <section className="relative z-10">

          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-3
              gap-6
              mb-8
            "
          >

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
                  className="
                    text-sm
                    font-semibold
                    mb-2
                  "
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
                >
                  A calm start makes
                  a strong day.
                </h1>

                <p className="font-hand text-lg">
                  your daily ritual,
                  one small step at a
                  time
                </p>

                <div
                  className="
                    flex
                    gap-2
                    mt-5
                    flex-wrap
                  "
                >

                  <span
                    className="
                      px-3
                      py-1
                      rounded-full
                      text-xs
                      font-semibold
                    "
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
                  >
                    {user?.points || 0} pts
                  </span>

                  <span
                    className="
                      px-3
                      py-1
                      rounded-full
                      text-xs
                      font-semibold
                  "
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
                {user?.wellness_score || 50}

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
                className="
                  mt-4
                  h-3
                  overflow-hidden
                "
                style={{
                  borderRadius: 999,
                  background:
                    "var(--cozy-bg)",
                }}
              >
                <div
                  className="h-full transition-all"
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

          {/* =================================================
              DAILY KNOWLEDGE
          ================================================= */}

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

        {/* =================================================
            TODAY'S RITUALS
        ================================================= */}

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
          >
            Today's rituals
          </h2>

          <div
            className="
              relative
              z-40
              overflow-visible
            "
          >
            <ActionCards
              onAction={doAction}
              onWaterReward={
                handleWaterReward
              }
            />
          </div>

        </section>

        {/* =================================================
            BOTTOM ROW
        ================================================= */}

        <section
          className="
            relative
            grid
            grid-cols-1
            lg:grid-cols-2
            gap-6
          "
        >

          <EyeCareTimer
            onBreakComplete={() =>
              doAction("eye_care")
            }
          />

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
                <div
                  className="
                    text-xs
                    font-bold
                    opacity-50
                  "
                >
                  No challenges available
                  right now.
                </div>
              ) : (
                challenges.map(
                  (challenge) => (
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
                  )
                )
              )}

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}

