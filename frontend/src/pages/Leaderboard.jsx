import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api, resolveAvatar } from "../lib/api";
import { EmptyState } from "../components/Skeleton";

const PERIODS = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "Week" },
  { id: "monthly", label: "Month" },
  { id: "all", label: "All-time" },
];

const VIEWS = [
  { id: "individual", label: "Solo" },
  { id: "teams", label: "Teams" },
];

const MEDAL_BG = [
  "bg-brutal-yellow",
  "bg-brutal-cyan",
  "bg-brutal-pink",
];

const MEDAL_LABEL = ["", "", ""];

/* =========================================================
   FILTER BUTTON
   Same pink active color for every selection
========================================================= */

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        px-4
        py-2
        rounded-xl
        border-[2px]
        font-display
        font-bold
        text-sm
        transition-all
        duration-200
        cursor-pointer
        select-none
      "
      style={{
        background: active
          ? "var(--cozy-accent)"
          : "var(--cozy-surface)",

        color: active
          ? "#FFFFFF"
          : "var(--cozy-text)",

        borderColor: active
          ? "var(--cozy-accent)"
          : "var(--cozy-border)",

        boxShadow: active
          ? "0 4px 10px rgba(242, 181, 167, 0.25)"
          : "0 2px 6px rgba(61, 68, 55, 0.06)",
      }}
    >
      {children}
    </button>
  );
}

/* =========================================================
   LEADERBOARD
========================================================= */

export default function Leaderboard() {
  const [period, setPeriod] = useState("all");
  const [view, setView] = useState("individual");

  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    if (view === "individual") {
      api
        .get(`/leaderboard?period=${period}`)
        .then(({ data }) => {
          setUsers(data);
        });
    } else {
      api
        .get("/leaderboard/teams")
        .then(({ data }) => {
          setTeams(data);
        });
    }
  }, [period, view]);

  const podium =
    view === "individual"
      ? users.slice(0, 3)
      : [];

  const rest =
    view === "individual"
      ? users.slice(3)
      : [];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <motion.div
        initial={{
          y: -20,
          opacity: 0,
          rotate: -2,
        }}
        animate={{
          y: 0,
          opacity: 1,
          rotate: -1,
        }}
        transition={{
          duration: 0.45,
          ease: "easeOut",
        }}
        className="
          px-6
          py-5
          mb-6
          inline-block
          relative
          rounded-2xl
          border-[2px]
          shadow-cozy-lg
        "
        style={{
        background: "var(--cozy-card)",
        borderColor: "var(--cozy-border)",
        color: "var(--cozy-text)",
        }}
      >
        <h1
          className="
            font-display
            font-black
            uppercase
            leading-none
            text-4xl
            md:text-6xl
            m-0
            p-0
          "
          style={{
            color: "var(--cozy-text)",
          }}
        >
          TOP CHAMPS
        </h1>

        <p
          className="
            text-[10px]
            md:text-xs
            uppercase
            tracking-[0.18em]
            mt-3
            font-bold
            m-0
          "
          style={{
            color: "var(--cozy-muted)",
          }}
        >
          Celebrating progress, one wellness win at a time.
        </p>
      </motion.div>

      {/* =====================================================
          SOLO / TEAMS
      ===================================================== */}

      <div
        className="flex gap-2 mb-3 flex-wrap"
        data-testid="leaderboard-views"
      >
        {VIEWS.map((v) => (
          <FilterButton
            key={v.id}
            active={view === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </FilterButton>
        ))}
      </div>

      {/* =====================================================
          PERIOD FILTERS
      ===================================================== */}

      {view === "individual" && (
        <div
          className="flex gap-2 mb-6 flex-wrap"
          data-testid="leaderboard-filters"
        >
          {PERIODS.map((p) => (
            <FilterButton
              key={p.id}
              active={period === p.id}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </FilterButton>
          ))}
        </div>
      )}

      {/* =====================================================
          INDIVIDUAL PODIUM
      ===================================================== */}

      {view === "individual" && podium.length > 0 && (
        <div
          className="
            grid
            grid-cols-3
            gap-3
            md:gap-6
            mb-8
          "
          data-testid="podium"
        >
          {[1, 0, 2].map((idx) => {
            const u = podium[idx];

            if (!u) {
              return <div key={idx} />;
            }

            const heights = [
              "h-32 md:h-44",
              "h-44 md:h-56",
              "h-28 md:h-36",
            ];

            const height =
              idx === 0
                ? heights[1]
                : idx === 1
                ? heights[0]
                : heights[2];

            return (
              <motion.div
                key={u.id}
                initial={{
                  y: 30,
                  opacity: 0,
                  rotate:
                    idx === 0
                      ? 0
                      : idx === 1
                      ? -2
                      : 2,
                }}
                animate={{
                  y: 0,
                  opacity: 1,
                  rotate:
                    idx === 0
                      ? 0
                      : idx === 1
                      ? -1
                      : 1,
                }}
                className={`
                  ${MEDAL_BG[idx]}
                  border-[4px]
                  border-black
                  shadow-brutal-lg
                  p-3
                  text-center
                  flex
                  flex-col
                  justify-end
                  ${height}
                `}
                data-testid={`podium-${idx}`}
              >
                <div className="text-3xl md:text-5xl">
                  {MEDAL_LABEL[idx]}
                </div>

                <img
                  src={resolveAvatar(u.avatar)}
                  alt={u.name}
                  className="
                    w-12
                    h-12
                    md:w-16
                    md:h-16
                    mx-auto
                    border-[3px]
                    border-black
                    bg-white
                    my-2
                  "
                />

                <div
                  className="
                    font-display
                    font-black
                    text-sm
                    md:text-lg
                    uppercase
                    truncate
                  "
                >
                  {u.name}
                </div>

                <div className="font-black text-xs">
                  {u.points}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* =====================================================
          INDIVIDUAL LEADERBOARD
      ===================================================== */}

      {view === "individual" ? (
        <div
          className="space-y-3"
          data-testid="leaderboard-list"
        >
          {rest.map((u, i) => {
            const tilt = i % 2 === 0 ? -1 : 1;

            return (
              <motion.div
                key={u.id}
                initial={{
                  opacity: 0,
                  x: -20,
                  rotate: tilt - 1,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                  rotate: tilt,
                }}
                whileHover={{
                  rotate: 0,
                  scale: 1.01,
                }}
                transition={{
                  delay: i * 0.04,
                }}
                data-testid={`leaderboard-row-${i}`}
                className="
                  flex
                  items-center
                  gap-4
                  p-3
                  rounded-xl
                  border-[2px]
                  shadow-cozy
                "
                style={{
                  background: "var(--cozy-surface)",
                  borderColor: "var(--cozy-border)",
                  color: "var(--cozy-text)",
                }}
              >
                <div
                  className="
                    font-display
                    font-black
                    text-3xl
                    w-12
                    text-center
                  "
                  style={{
                    color: "var(--cozy-text)",
                  }}
                >
                  #{i + 4}
                </div>

                <img
                  src={resolveAvatar(u.avatar)}
                  alt={u.name}
                  className="
                    w-12
                    h-12
                    rounded-lg
                    border-[2px]
                  "
                  style={{
                    borderColor: "var(--cozy-border)",
                    background: "var(--cozy-bg)",
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div
                    className="
                      font-display
                      font-black
                      text-lg
                      uppercase
                      truncate
                    "
                    style={{
                      color: "var(--cozy-text)",
                    }}
                  >
                    {u.name}
                  </div>

                  <div
                    className="
                      text-xs
                      font-bold
                      uppercase
                    "
                    style={{
                      color: "var(--cozy-muted)",
                    }}
                  >
                    {u.department} · {u.streak || 0}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className="
                      font-display
                      font-black
                      text-2xl
                      leading-none
                    "
                    style={{
                      color: "var(--cozy-primary)",
                    }}
                  >
                    {u.points}
                  </div>

                  <div
                    className="
                      text-[10px]
                      font-bold
                      uppercase
                    "
                    style={{
                      color: "var(--cozy-muted)",
                    }}
                  >
                    pts
                  </div>
                </div>
              </motion.div>
            );
          })}

          {users.length === 0 && (
            <EmptyState
              emoji=""
              title="No data yet"
              subtitle="Go earn some points, champ."
            />
          )}
        </div>
      ) : (
        /* =====================================================
           TEAM LEADERBOARD
        ===================================================== */

        <div
          className="space-y-3"
          data-testid="team-leaderboard"
        >
          {teams.map((t, i) => (
            <motion.div
              key={t.team}
              initial={{
                opacity: 0,
                x: -20,
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              transition={{
                delay: i * 0.04,
              }}
              className={`
                flex
                items-center
                gap-4
                p-4
                border-[4px]
                border-black
                shadow-brutal-lg
                ${
                  i < 3
                    ? MEDAL_BG[i]
                    : ""
                }
              `}
              style={
                i >= 3
                  ? {
                      background:
                        "var(--cozy-surface)",
                      color:
                        "var(--cozy-text)",
                      borderColor:
                        "var(--cozy-border)",
                    }
                  : undefined
              }
            >
              <div
                className="
                  font-display
                  font-black
                  text-4xl
                  w-14
                  text-center
                "
              >
                {i < 3
                  ? MEDAL_LABEL[i]
                  : `#${i + 1}`}
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className="
                    font-display
                    font-black
                    text-2xl
                    uppercase
                    truncate
                  "
                >
                  {t.team}
                </div>

                <div
                  className="text-xs font-bold uppercase"
                  style={{
                    color:
                      i < 3
                        ? "inherit"
                        : "var(--cozy-muted)",
                  }}
                >
                  {t.members} member
                  {t.members === 1 ? "" : "s"} · avg
                  wellness {t.avg_wellness}
                </div>
              </div>

              <div className="text-right">
                <div
                  className="
                    font-display
                    font-black
                    text-3xl
                    leading-none
                  "
                >
                  {t.points}
                </div>

                <div className="text-xs font-bold uppercase">
                  team pts
                </div>
              </div>
            </motion.div>
          ))}

          {teams.length === 0 && (
            <div
              className="
                text-center
                py-10
                font-bold
                uppercase
              "
              style={{
                color: "var(--cozy-muted)",
              }}
            >
              No teams yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}