import React, { useEffect, useRef, useState } from "react";
import { BrutalButton } from "../../components/brutal";

/**
 * Self-contained React shell for Trickstep. Mounting boots Phaser (the
 * engine itself arrives via dynamic import in its own chunk); unmounting
 * destroys the instance and frees canvas, textures, audio and listeners.
 * React state never changes during gameplay, so it never rerenders while
 * the game runs — all game state lives inside Phaser.
 */
export default function GameLauncher({ onExit }) {
  const containerRef = useRef(null);
  const handleRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let cancelled = false;
    let observer;

    import("./index")
      .then(({ createGame }) => {
        if (cancelled || !containerRef.current) return;
        const isDark = document.documentElement.classList.contains("dark");
        handleRef.current = createGame(containerRef.current, { darkMode: isDark });
        setStatus("ready");

        // follow the wellness app's theme toggle while the game is open
        observer = new MutationObserver(() => {
          handleRef.current?.setDarkMode(
            document.documentElement.classList.contains("dark")
          );
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6" data-testid="game-launcher">
      <div className="flex items-center justify-between mb-4">
        <div className="bg-brutal-yellow border-[3px] border-black shadow-brutal px-4 py-2">
          <span className="font-display font-black text-xl uppercase">👟 Trickstep</span>
        </div>
        <BrutalButton color="white" size="sm" onClick={onExit} data-testid="game-exit">
          ← Exit game
        </BrutalButton>
      </div>

      <div className="relative border-[4px] border-black shadow-brutal-lg bg-black">
        <div
          ref={containerRef}
          className="w-full aspect-[960/544]"
          data-testid="game-canvas-host"
        />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="font-display font-black uppercase animate-pulse">
              Loading game…
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="text-center">
              <div className="font-display font-black uppercase mb-2">
                Couldn't load the game
              </div>
              <BrutalButton color="yellow" size="sm" onClick={onExit}>
                Go back
              </BrutalButton>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs font-bold uppercase tracking-wider mt-3 opacity-60 md:hidden">
        Tip: rotate your phone — landscape plays best.
      </p>
    </div>
  );
}
