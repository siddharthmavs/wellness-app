import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

import { BrutalButton } from "./brutal";

import {
  Eye,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Bell,
} from "lucide-react";

import { useTimerStore } from "../store";

const WORK = 20 * 60;
const BREAK = 20;
const GET_READY = 3;

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
      new Notification("👀 Time for an eye break!", {
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

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      setShowPermission(false);
      return;
    }

    try {
      const permission =
        await Notification.requestPermission();

      if (permission === "granted") {
        setShowPermission(false);
      }
    } catch (error) {
      console.error(
        "Notification permission failed:",
        error
      );
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

    if (Notification.permission === "default") {
      setShowPermission(true);
    }
  }, []);

  /*
   * =========================================================
   * GLOBAL TIMER LOOP
   *
   * Timer state comes from Zustand, so the timer itself
   * continues independently of this component's rendering.
   * =========================================================
   */

  useEffect(() => {
    if (!running) {
      return;
    }

    /*
     * If there is no end time, create one.
     */
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
      else {
        setTimerState({
          secs: remaining,
        });
      }
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
  ]);

  /*
   * =========================================================
   * TIMER CONTROLS
   * =========================================================
   */

  const toggleRunning = () => {
    if (running) {
      /*
       * Pause timer.
       */
      setTimerState({
        running: false,
        endTime: null,
      });

      return;
    }

    /*
     * Resume timer.
     */
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
   *
   * Rendering overlays into document.body prevents them
   * from being trapped underneath ActionCards' z-index.
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
            <div className="flex items-start gap-3">
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
                <h4 className="font-black uppercase text-sm">
                  Stay on track
                </h4>

                <p className="text-xs font-medium leading-relaxed mt-1 opacity-70">
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
              >
                <span className="flex items-center justify-center gap-1.5">
                  <Bell className="w-4 h-4" />
                  Allow
                </span>
              </BrutalButton>

              <BrutalButton
                color="white"
                onClick={() =>
                  setShowPermission(false)
                }
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
              {/* EYE ICON */}

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

              {/* TITLE */}

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

              {/* DESCRIPTION */}

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

              {/* STATUS */}

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

              {/* CLOSE */}

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
            -right-16
            -top-16
            w-40
            h-40
            rounded-full
            border-[4px]
            border-black/10
          "
        />

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
            {/* OUTER DECORATION */}

            <motion.circle
              cx="88"
              cy="88"
              r="76"
              fill="none"
              stroke="black"
              strokeWidth="2"
              strokeDasharray="4 7"
              className="opacity-15"
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                transformOrigin:
                  "88px 88px",
              }}
            />

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
            <motion.div
              key={displayTime}
              initial={{
                opacity: 0.5,
                scale: 0.96,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
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
            </motion.div>

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
          
          This is the important fix.

          Both overlays are rendered directly into document.body
          instead of remaining inside the Dashboard's z-index
          hierarchy.
      ===================================================== */}

      {typeof document !== "undefined" &&
        createPortal(
          overlayContent,
          document.body
        )}
    </>
  );
};