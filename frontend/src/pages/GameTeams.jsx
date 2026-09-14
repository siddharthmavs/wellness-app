
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, resolveAvatar } from "../lib/api";
import { toast } from "sonner";
import { useAuthStore } from "../store";

export default function GameTeams() {
  const { user } = useAuthStore();

  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState("standings");
  const [wagerAmount, setWagerAmount] = useState(50);
  const [targetTeamId, setTargetTeamId] = useState("");

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const teamsRes = await api.get("/game-teams");
      setTeams(teamsRes.data || []);
    } catch (err) {
      toast.error("Failed to load team data");
    }
  };

  const myTeam = teams.find((t) =>
    t.members?.includes(user?.id)
  );

  const MEDAL_LABEL = ["🥇", "🥈", "🥉"];

  const handleChallengeTeam = async (e) => {
    e.preventDefault();

    if (!myTeam) {
      return toast.error("You must be on a team to challenge others!");
    }

    if (!targetTeamId) {
      return toast.error("Select a rival team to challenge.");
    }

    if (Number(wagerAmount) < 10) {
      return toast.error("Minimum wager is 10 points.");
    }

    try {
      await api.post("/game-teams/challenge", {
        challenger_team_id: myTeam.id,
        target_team_id: targetTeamId,
        wager: Number(wagerAmount),
      });

      toast.success(
        "🔥 Challenge sent! May the best team win."
      );

      setTargetTeamId("");
      setWagerAmount(50);

      fetchTeams();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Failed to issue challenge"
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">

      {/* Header */}
      <motion.div
        initial={{ rotate: -2, opacity: 0 }}
        animate={{ rotate: -1, opacity: 1 }}
        className="bg-brutal-pink text-white border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
      >
        <h1 className="font-display font-black text-5xl uppercase leading-none">
          GAME TEAMS
        </h1>

        <p className="text-xs uppercase tracking-widest mt-2">
          Office teams & friendly competition
        </p>
      </motion.div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap gap-3 mb-6">

        <button
          onClick={() => setActiveTab("standings")}
          className={`font-black uppercase px-5 py-2 border-[4px] border-black shadow-brutal transition-all ${
            activeTab === "standings"
              ? "bg-yellow-300 translate-x-1 translate-y-1 shadow-none"
              : "bg-white"
          }`}
        >
          🏆 Standings & Rosters
        </button>

        <button
          onClick={() => setActiveTab("battles")}
          className={`font-black uppercase px-5 py-2 border-[4px] border-black shadow-brutal transition-all ${
            activeTab === "battles"
              ? "bg-yellow-300 translate-x-1 translate-y-1 shadow-none"
              : "bg-white"
          }`}
        >
          ⚔️ Team Battles
        </button>

      </div>

      {/* User's Current Team Banner */}
      {myTeam && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`bg-brutal-${myTeam.color} border-[4px] border-black shadow-brutal-lg p-5 mb-6`}
          data-testid="my-team"
        >
          <div className="text-xs font-black uppercase tracking-widest">
            You're assigned to
          </div>

          <div className="font-display font-black text-4xl uppercase">
            {myTeam.name}
          </div>

          <div className="mt-2 font-black">
            ⚡ {myTeam.team_points} team pts · 👥{" "}
            {myTeam.members?.length || 0} members
          </div>
        </motion.div>
      )}

      {/* =====================================================
          TAB 1: STANDINGS
      ===================================================== */}
      {activeTab === "standings" && (
        <>
          <h2 className="font-display font-black text-2xl uppercase mb-3">
            Team Standings
          </h2>

          <div
            className="space-y-3"
            data-testid="teams-list"
          >
            {teams.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`border-[4px] border-black shadow-brutal-lg p-5 bg-brutal-${t.color} ${
                  myTeam?.id === t.id
                    ? "ring-4 ring-black"
                    : ""
                }`}
              >
                {/* Team Header */}
                <div className="flex items-center gap-4 mb-3">

                  <div className="font-display font-black text-4xl">
                    {i < 3
                      ? MEDAL_LABEL[i]
                      : `#${i + 1}`}
                  </div>

                  <div className="flex-1">
                    <div className="font-display font-black text-2xl uppercase">
                      {t.name}
                    </div>

                    <div className="text-xs font-bold uppercase">
                      {t.members?.length || 0} members
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-display font-black text-3xl leading-none">
                      {t.team_points}
                    </div>

                    <div className="text-[10px] font-bold uppercase">
                      team pts
                    </div>
                  </div>

                </div>

                {/* Members */}
                <div className="flex flex-wrap gap-1">
                  {(t.member_details || []).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-1 bg-white border-[2px] border-black px-1.5 py-0.5"
                    >
                      <img
                        src={resolveAvatar(m.avatar)}
                        alt=""
                        className="w-5 h-5 border-[1px] border-black"
                      />

                      <span className="font-black text-[10px] uppercase">
                        {m.name}
                      </span>
                    </div>
                  ))}
                </div>

              </motion.div>
            ))}

            {teams.length === 0 && (
              <div className="text-center font-bold uppercase py-10">
                No teams available yet.
              </div>
            )}
          </div>
        </>
      )}

      {/* =====================================================
          TAB 2: TEAM BATTLES
      ===================================================== */}
      {activeTab === "battles" && (
        <div className="space-y-6">

          <div className="bg-white border-[4px] border-black shadow-brutal-lg p-6">

            <h3 className="font-display font-black text-2xl uppercase mb-1">
              🔥 Team Challenge
            </h3>

            <p className="text-xs font-bold uppercase text-gray-600 mb-4">
              Challenge another team to a match. The winning
              team takes the wagered points!
            </p>

            <form
              onSubmit={handleChallengeTeam}
              className="space-y-4"
            >

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Target Team */}
                <div>
                  <label className="block text-xs font-black uppercase mb-1">
                    Target Rival Team
                  </label>

                  <select
                    className="w-full border-[3px] border-black p-2 font-bold uppercase bg-white shadow-brutal"
                    value={targetTeamId}
                    onChange={(e) =>
                      setTargetTeamId(e.target.value)
                    }
                  >
                    <option value="">
                      -- Choose Rival Team --
                    </option>

                    {teams
                      .filter(
                        (t) => t.id !== myTeam?.id
                      )
                      .map((t) => (
                        <option
                          key={t.id}
                          value={t.id}
                        >
                          {t.name} ({t.team_points} pts)
                        </option>
                      ))}
                  </select>
                </div>

                {/* Wager */}
                <div>
                  <label className="block text-xs font-black uppercase mb-1">
                    Points Wager
                  </label>

                  <input
                    type="number"
                    min="10"
                    max="500"
                    className="w-full border-[3px] border-black p-2 font-bold uppercase bg-white shadow-brutal"
                    value={wagerAmount}
                    onChange={(e) =>
                      setWagerAmount(e.target.value)
                    }
                  />
                </div>

              </div>

              <button
                type="submit"
                className="bg-brutal-pink text-white font-black uppercase px-6 py-3 border-[3px] border-black shadow-brutal hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              >
                Send Battle Challenge ⚡
              </button>

            </form>
          </div>

        </div>
      )}

    </div>
  );
}
