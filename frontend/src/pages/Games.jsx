import React, { lazy, Suspense, useState } from "react";
import { motion } from "framer-motion";
import { BrutalBadge, BrutalCard } from "../components/brutal";
import { formatTime, peekProgress } from "../games/platformer/systems/SaveManager";

// The game (and Phaser itself) lives in its own chunk — nothing game-related
// is downloaded or executed until someone presses play.
const TrickstepLauncher = lazy(() => import("../games/platformer/GameLauncher"));

const TOTAL_LEVELS = 8;

const GAMES = [
  {
    id: "trickstep",
    name: "👟 Trickstep",
    tagline: "Reach the door. Trust nothing.",
    desc: "A devious little platformer full of traps, fake floors and doors that lie. 8 levels of unexpected-but-fair chaos.",
    color: "yellow",
  },
];

export default function Games() {
  const [active, setActive] = useState(null);
  // read once per visit; progress only changes while the game is open
  const [progress, setProgress] = useState(() => peekProgress());

  const exitGame = () => {
    setProgress(peekProgress());
    setActive(null);
  };

  if (active === "trickstep") {
    return (
      <Suspense
        fallback={
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 text-center font-display font-black uppercase animate-pulse">
            Loading game…
          </div>
        }
      >
        <TrickstepLauncher onExit={exitGame} />
      </Suspense>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ rotate: 2, opacity: 0 }}
        animate={{ rotate: 1, opacity: 1 }}
        className="bg-brutal-yellow border-[4px] border-black shadow-brutal-lg p-6 mb-8 inline-block"
      >
        <h1 className="font-display font-black text-5xl uppercase leading-none">🎮 GAMES</h1>
        <p className="text-xs uppercase tracking-widest mt-2">
          tiny games, big feelings
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6" data-testid="games-grid">
        {GAMES.map((game) => (
          <motion.button
            key={game.id}
            data-testid={`game-${game.id}`}
            onClick={() => setActive(game.id)}
            whileHover={{ scale: 1.02, rotate: -1 }}
            whileTap={{ scale: 0.97, x: 4, y: 4, boxShadow: "0px 0px 0px 0px rgba(0,0,0,1)" }}
            className={`bg-brutal-${game.color} border-[4px] border-black shadow-brutal-lg p-6 rounded-[4px] text-left`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-display font-black text-3xl uppercase">{game.name}</div>
              <BrutalBadge color="pink">NEW</BrutalBadge>
            </div>
            <div className="text-sm font-bold mt-1 uppercase tracking-wide">{game.tagline}</div>
            <div className="text-xs font-medium mt-3 max-w-md">{game.desc}</div>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="bg-black text-white px-2 py-0.5 font-black text-xs">
                {progress.completedCount}/{TOTAL_LEVELS} LEVELS
              </span>
              {progress.bestTotalMs !== null && (
                <span className="bg-white border-[2px] border-black px-2 py-0.5 font-black text-xs">
                  ★ BEST TOTAL {formatTime(progress.bestTotalMs)}
                </span>
              )}
              <span className="bg-white border-[2px] border-black px-2 py-0.5 font-black text-xs">
                PLAY →
              </span>
            </div>
          </motion.button>
        ))}

        <BrutalCard color="white" hover={false} className="flex items-center justify-center min-h-[180px]">
          <div className="text-center opacity-60">
            <div className="font-display font-black text-2xl uppercase">More games</div>
            <div className="text-xs font-bold uppercase tracking-widest mt-2">coming soon</div>
          </div>
        </BrutalCard>
      </div>
    </div>
  );
}
