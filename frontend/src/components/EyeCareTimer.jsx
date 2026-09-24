import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { BrutalButton } from "./brutal";

import {
  Eye,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Bell,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";

import { useTimerStore } from "../store";

const WORK = 20 * 60;
const BREAK = 20;
const GET_READY = 3;

// "Later" hides the reminder prompt for the rest of this browser session (QA #1).
const PROMPT_DISMISSED_KEY = "wg-stay-on-track-dismissed";
// Timer-only mute (QA #5). The global "sound" notification setting also silences it.
const MUTE_KEY = "wg-eye-timer-muted";

const readSession = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeSession = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the prompt simply closes for now */
  }
};

const soundsDisabledGlobally = () => {
  try {
    return JSON.parse(localStorage.getItem("notificationSettings") || "{}").sound === false;
  } catch {
    return false;
  }
};

/*
 * One shared AudioContext, unlocked on the first user gesture so the chime can
 * still play when the countdown ends while the user is in another tab/app.
 */
let chimeContext = null;

const getChimeContext = () => {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!chimeContext) chimeContext = new Ctx();
  if (chimeContext.state === "suspended") chimeContext.resume().catch(() => {});
  return chimeContext;
};

if (typeof window !== "undefined") {
  const unlock = () => {
    getChimeContext();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

// kind "break": rising two-note chime (look away now); "done": falling (back to work)
const playChime = (kind) => {
  try {
    const ctx = getChimeContext();
    if (!ctx) return;
    const notes = kind === "break" ? [660, 880] : [880, 587];
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch {
    /* audio unavailable */
  }
};

export const EyeCareTimer = ({ onBreakComplete }) => {
  const {
    secs,
    phase,
    running,
    endTime,
    setTimerState,
  } = useTimerStore();

  const [showBreakPopup, setShowBreakPopup] = useState(false);
  const [showPermission, setShowPermission] = useState(false);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const chime = useCallback((kind) => {
    if (mutedRef.current || soundsDisabledGlobally()) return;
    playChime(kind);
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!next) playChime("done"); // audible confirmation (and unlocks audio)
  };

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  /*
   * =========================================================
   * NOTIFICATION
   * =========================================================
   */

  const sendEyeBreakNotification = useCallback(() => {
    if (!("Notification" in window)) return;

    if (Notification.permission !== "granted") {
      return;
    }

    try {
      new Notification("Time for an eye break!", {
        body: "Look at something about 20 feet away for 20 seconds.",
        icon: "/logo192.png",
        tag: "eye-break",
        requireInteraction: false,
      });
    } catch (error) {
      console.error(
        "Eye break notification failed:",
        error
      );
    }
  }, []);

  /*
   * =========================================================
   * REQUEST NOTIFICATION PERMISSION
   * =========================================================
   */

  const dismissPermission = useCallback(() => {
    writeSession(PROMPT_DISMISSED_KEY, "1");
    setShowPermission(false);
  }, []);

  const requestNotificationPermission = async () => {
    // Close right away: the browser shows its own prompt, and whatever the
    // answer is, this card has done its job (QA #1).
    setShowPermission(false);

    if (!("Notification" in window)) {
      return;
    }

    let permission = Notification.permission;

    try {
      permission = await Notification.requestPermission();
    } catch (error) {
      console.error(
        "Notification permission failed:",
        error
      );
    }

    if (permission === "granted") {
      toast.success("Reminders are on", {
        description: "We'll nudge you every 20 minutes, even in another app.",
      });
    } else if (permission === "denied") {
      toast("Notifications are blocked", {
        description: "You can allow them later in your browser's site settings.",
      });
    } else {
      writeSession(PROMPT_DISMISSED_KEY, "1");
      toast("No problem", {
        description: "We'll ask again next time you visit.",
      });
    }
  };

  /*
   * =========================================================
   * INITIAL NOTIFICATION PERMISSION CHECK
   * =========================================================
   */

  useEffect(() => {
    if (!("Notification" in window)) {
      return;
    }

    if (
      Notification.permission === "default" &&
      readSession(PROMPT_DISMISSED_KEY) !== "1"
    ) {
      setShowPermission(true);
    }
  }, []);

  useEffect(() => {
    if (!showPermission) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") dismissPermission();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPermission, dismissPermission]);

  /*
   * =========================================================
   * GLOBAL TIMER LOOP
   * =========================================================
   */

  useEffect(() => {
    if (!running) {
      return;
    }

    if (!endTime) {
      setTimerState({
        endTime: Date.now() + secs * 1000,
      });

      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (endTime - Date.now()) / 1000
        )
      );

      /*
       * TIMER FINISHED
       */

      if (remaining <= 0) {
        /*
         * READY → WORK
         */

        if (phaseRef.current === "ready") {
          setTimerState({
            phase: "work",
            secs: WORK,
            running: true,
            endTime:
              Date.now() + WORK * 1000,
          });

          return;
        }

        /*
         * WORK → BREAK
         */

        if (phaseRef.current === "work") {
          setShowBreakPopup(true);

          chime("break");

          sendEyeBreakNotification();

          setTimerState({
            phase: "break",
            secs: BREAK,
            running: true,
            endTime:
              Date.now() + BREAK * 1000,
          });

          return;
        }

        /*
         * BREAK → WORK
         */

        if (phaseRef.current === "break") {
          setShowBreakPopup(false);

          chime("done");

          if (onBreakComplete) {
            onBreakComplete();
          }

          setTimerState({
            phase: "work",
            secs: WORK,
            running: true,
            endTime:
              Date.now() + WORK * 1000,
          });

          return;
        }
      }

      /*
       * TIMER STILL RUNNING
       */

      setTimerState({
        secs: remaining,
      });
    }, 250);

    return () => {
      clearInterval(interval);
    };
  }, [
    running,
    endTime,
    secs,
    setTimerState,
    sendEyeBreakNotification,
    onBreakComplete,
    chime,
  ]);

  /*
   * =========================================================
   * TIMER CONTROLS
   * =========================================================
   */

  const toggleRunning = () => {
    if (running) {
      setTimerState({
        running: false,
        endTime: null,
      });

      return;
    }

    setTimerState({
      running: true,
      endTime:
        Date.now() + secs * 1000,
    });
  };

  /*
   * =========================================================
   * RESET
   * =========================================================
   */

  const handleReset = () => {
    setShowBreakPopup(false);

    setTimerState({
      running: true,
      phase: "ready",
      secs: GET_READY,
      endTime:
        Date.now() + GET_READY * 1000,
    });
  };

  /*
   * =========================================================
   * TIMER CALCULATIONS
   * =========================================================
   */

  const totalDuration =
    phase === "ready"
      ? GET_READY
      : phase === "work"
      ? WORK
      : BREAK;

  const progress =
    totalDuration > 0
      ? secs / totalDuration
      : 0;

  const radius = 64;

  const circumference =
    2 * Math.PI * radius;

  const strokeDashoffset =
    circumference * (1 - progress);

  const mm = String(
    Math.floor(secs / 60)
  ).padStart(2, "0");

  const ss = String(
    secs % 60
  ).padStart(2, "0");

  const displayTime =
    phase === "ready"
      ? secs
      : `${mm}:${ss}`;

  const subtitle =
    phase === "ready"
      ? "Starting soon"
      : phase === "work"
      ? "Next break in"
      : "Look 20 ft away";

  /*
   * =========================================================
   * PORTAL CONTENT
   * =========================================================
   */

  const overlayContent = (
    <>
      {/* =====================================================
          NOTIFICATION PERMISSION POPUP
      ===================================================== */}

      <AnimatePresence>
        {showPermission && (
          <motion.div
            initial={{
              opacity: 0,
              y: 30,
              scale: 0.95,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 30,
              scale: 0.95,
            }}
            role="dialog"
            aria-labelledby="stay-on-track-title"
            aria-describedby="stay-on-track-desc"
            data-testid="stay-on-track"
            className="
              fixed
              bottom-6
              right-6
              z-[100000]
              w-[340px]
              max-w-[calc(100vw-32px)]
              border-[4px]
              border-black
              bg-white
              rounded-[18px]
              p-5
              shadow-[8px_8px_0px_#000]
            "
          >
            <button
              type="button"
              onClick={dismissPermission}
              aria-label="Close"
              title="Close"
              data-testid="stay-on-track-close"
              className="absolute top-3 right-3 p-1 rounded-md opacity-60 hover:opacity-100 focus-visible:outline focus-visible:outline-2"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3 pr-6">
              <div
                className="
                  flex
                  items-center
                  justify-center
                  w-10
                  h-10
                  shrink-0
                  border-[3px]
                  border-black
                  bg-brutal-yellow
                  rounded-[10px]
                "
              >
                <Bell className="w-5 h-5" />
              </div>

              <div>
                <h4 id="stay-on-track-title" className="font-black uppercase text-sm">
                  Stay on track
                </h4>

                <p id="stay-on-track-desc" className="text-xs font-medium leading-relaxed mt-1 opacity-70">
                  Get a reminder every 20 minutes,
                  even while you're working in
                  another application.
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <BrutalButton
                color="green"
                onClick={
                  requestNotificationPermission
                }
                className="flex-1"
                data-testid="stay-on-track-allow"
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Bell className="w-4 h-4" />
                  Allow
                </span>
              </BrutalButton>

              <BrutalButton
                color="white"
                onClick={dismissPermission}
                data-testid="stay-on-track-later"
              >
                Later
              </BrutalButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================
          EYE BREAK FULL SCREEN POPUP
      ===================================================== */}

      <AnimatePresence>
        {showBreakPopup && (
          <motion.div
            className="
              fixed
              inset-0
              z-[99999]
              flex
              items-center
              justify-center
              p-5
              bg-black/40
              backdrop-blur-sm
            "
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
              initial={{
                opacity: 0,
                scale: 0.8,
                y: 30,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.8,
                y: 30,
              }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 20,
              }}
              className="
                w-full
                max-w-md
                border-[4px]
                border-black
                bg-brutal-yellow
                rounded-[24px]
                p-7
                text-center
                shadow-[10px_10px_0px_#000]
              "
            >
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                }}
                className="
                  mx-auto
                  flex
                  items-center
                  justify-center
                  w-20
                  h-20
                  border-[4px]
                  border-black
                  bg-white
                  rounded-full
                  shadow-[5px_5px_0px_#000]
                "
              >
                <Eye className="w-10 h-10" />
              </motion.div>

              <h2
                className="
                  font-display
                  font-black
                  uppercase
                  text-3xl
                  tracking-tight
                  mt-6
                "
              >
                Time for an
                <br />
                Eye Break!
              </h2>

              <p
                className="
                  font-bold
                  text-sm
                  leading-relaxed
                  mt-3
                  opacity-70
                "
              >
                Look at something about 20 feet
                away and relax your eyes for
                20 seconds.
              </p>

              <div
                className="
                  mt-6
                  inline-flex
                  items-center
                  gap-2
                  px-4
                  py-2
                  border-[3px]
                  border-black
                  bg-black
                  text-white
                  rounded-[10px]
                  font-black
                  uppercase
                  text-xs
                "
              >
                <Sparkles className="w-4 h-4 text-brutal-yellow" />

                Break started automatically
              </div>

              <button
                onClick={() =>
                  setShowBreakPopup(false)
                }
                className="
                  block
                  mx-auto
                  mt-5
                  text-[10px]
                  font-black
                  uppercase
                  tracking-widest
                  underline
                  opacity-60
                  hover:opacity-100
                "
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  /*
   * =========================================================
   * MAIN TIMER UI
   * =========================================================
   */

  return (
    <>
      <motion.div
        data-testid="eye-care-timer"
        layout
        className={`
          relative
          overflow-hidden
          border-[4px]
          border-black
          rounded-[24px]
          p-6
          shadow-brutal-lg
          transition-colors
          duration-500

          ${
            phase === "break"
              ? "bg-brutal-yellow"
              : phase === "ready"
              ? "bg-[#dcefe5]"
              : "bg-white"
          }
        `}
      >
        {/* DECORATIVE CIRCLES */}


        <div
          className="
            absolute
            -left-20
            -bottom-20
            w-44
            h-44
            rounded-full
            border-[3px]
            border-black/5
          "
        />

        {/* ===================================================
            HEADER
        =================================================== */}

        <div
          className="
            relative
            flex
            items-center
            justify-between
            mb-5
          "
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={
                phase === "break"
                  ? {
                      rotate: [
                        0,
                        -8,
                        8,
                        0,
                      ],
                      scale: [
                        1,
                        1.08,
                        1,
                      ],
                    }
                  : {}
              }
              transition={{
                duration: 1.5,
                repeat: Infinity,
              }}
              className="
                flex
                items-center
                justify-center
                w-10
                h-10
                border-[3px]
                border-black
                bg-white
                rounded-[10px]
                shadow-[3px_3px_0px_#000]
              "
            >
              <Eye className="w-5 h-5" />
            </motion.div>

            <div>
              <h3
                className="
                  font-display
                  font-black
                  uppercase
                  text-lg
                  tracking-wide
                  leading-none
                "
              >
                20–20–20 Guard
              </h3>

              <p
                className="
                  text-[10px]
                  font-black
                  uppercase
                  tracking-widest
                  opacity-50
                  mt-1
                "
              >
                Automatic Eye Care
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Unmute timer sound" : "Mute timer sound"}
            title={muted ? "Sound off - click to unmute" : "Sound on - click to mute"}
            data-testid="eye-timer-mute"
            className="
              flex
              items-center
              justify-center
              w-8
              h-8
              border-[2px]
              border-black
              bg-white
              rounded-full
              shadow-[2px_2px_0px_#000]
            "
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <span
            className="
              text-[10px]
              font-black
              uppercase
              px-3
              py-1.5
              border-[2px]
              border-black
              bg-white
              rounded-full
              shadow-[2px_2px_0px_#000]
            "
          >
            {phase === "ready"
              ? "Ready"
              : phase === "work"
              ? "Focus"
              : "Rest"}
          </span>
          </div>
        </div>

        {/* ===================================================
            TIMER RING
        =================================================== */}

        <div
          className="
            relative
            flex
            items-center
            justify-center
            my-7
          "
        >
          <svg
            className="
              w-48
              h-48
              transform
              -rotate-90
            "
            viewBox="0 0 176 176"
          >
            {/* BACKGROUND RING */}

            <circle
              cx="88"
              cy="88"
              r={radius}
              stroke="currentColor"
              strokeWidth="11"
              className="
                text-black/10
                fill-none
              "
            />

            {/* PROGRESS RING */}

            <motion.circle
              cx="88"
              cy="88"
              r={radius}
              stroke="grey"
              strokeWidth="11"
              strokeDasharray={circumference}
              strokeDashoffset={
                strokeDashoffset
              }
              strokeLinecap="round"
              className="fill-none"
              animate={{
                strokeDashoffset:
                  strokeDashoffset,
              }}
              transition={{
                duration: 0.5,
                ease: "linear",
              }}
            />
          </svg>

          {/* TIMER TEXT */}

          <div
            className="
              absolute
              inset-0
              flex
              flex-col
              items-center
              justify-center
              text-center
            "
          >
            {/* No key / mount animation here.
                This prevents the timer from flickering. */}

            <div
              className="
                font-display
                font-black
                text-[38px]
                tabular-nums
                tracking-[0.08em]
                leading-none
              "
            >
              {displayTime}
            </div>

            <span
              className="
                text-[10px]
                font-black
                uppercase
                tracking-[0.18em]
                mt-2
                opacity-60
              "
            >
              {subtitle}
            </span>
          </div>
        </div>

        {/* ===================================================
            STATUS
        =================================================== */}

        <AnimatePresence mode="wait">
          {phase === "break" ? (
            <motion.div
              key="break-status"
              initial={{
                opacity: 0,
                scale: 0.95,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                scale: 0.95,
              }}
              className="
                flex
                items-center
                justify-center
                gap-2
                text-center
                font-black
                uppercase
                text-xs
                tracking-wider
                mb-6
                px-4
                py-3
                border-[3px]
                border-black
                bg-black
                text-white
                rounded-[10px]
              "
            >
              <Sparkles className="w-4 h-4 text-brutal-yellow animate-pulse" />

              Look 20 ft Away
            </motion.div>
          ) : (
            <motion.div
              key="focus-status"
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              className="
                flex
                items-center
                justify-center
                gap-2
                text-center
                font-black
                uppercase
                text-xs
                tracking-wider
                mb-6
                px-4
                py-3
                border-[2px]
                border-black
                bg-black/5
                rounded-[10px]
              "
            >
              {phase === "ready"
                ? "Get comfortable — we're starting"
                : "Focus now — your next break is automatic"}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===================================================
            CONTROLS
        =================================================== */}

        <div className="flex gap-3">
          <BrutalButton
            data-testid="timer-toggle"
            color={
              running
                ? "pink"
                : "green"
            }
            onClick={toggleRunning}
            className="flex-1"
          >
            <span
              className="
                flex
                items-center
                justify-center
                gap-2
              "
            >
              {running ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Resume
                </>
              )}
            </span>
          </BrutalButton>

          <BrutalButton
            data-testid="timer-reset"
            color="white"
            onClick={handleReset}
          >
            <RotateCcw className="w-4 h-4" />
          </BrutalButton>
        </div>

        {/* ===================================================
            FOOTER
        =================================================== */}

        <div
          className="
            flex
            items-center
            justify-center
            gap-1.5
            mt-4
            text-[9px]
            font-black
            uppercase
            tracking-widest
            opacity-40
          "
        >
          <span
            className="
              w-1.5
              h-1.5
              rounded-full
              bg-black
              animate-pulse
            "
          />

          Automatic cycle enabled
        </div>
      </motion.div>

      {/* =====================================================
          PORTAL
      ===================================================== */}

      {typeof document !== "undefined" &&
        createPortal(
          overlayContent,
          document.body
        )}
    </>
  );
};