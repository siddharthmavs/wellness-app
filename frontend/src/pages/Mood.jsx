
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import {
  BrutalButton,
  BrutalCard,
  BrutalInput,
  BrutalTag,
} from "../components/brutal";
import { EmptyState } from "../components/Skeleton";
import { MOOD_ICONS } from "../components/HandDrawn";
import { toast } from "sonner";

/* =========================================================
   MOODS
========================================================= */

const MOODS = [
  { key: "Lit", label: "Lit" },
  { key: "Zen", label: "Zen" },
  { key: "Meh", label: "Meh" },
  { key: "Stressed", label: "Stressed" },
  { key: "Tired", label: "Tired" },
  { key: "Hyped", label: "Hyped" },
  { key: "Overload", label: "Overload" },
  { key: "Cold", label: "Cold" },
];

const PRODUCTIVITY = [
  { id: "High", label: "High" },
  { id: "Med", label: "Medium" },
  { id: "Low", label: "Low" },
];

/* =========================================================
   MOOD EFFECTS
========================================================= */

const MOOD_EFFECTS = {
  Lit: {
    message: "You're absolutely vibing!",
    background:
      "radial-gradient(circle at 50% 35%, rgba(255,180,80,0.28), transparent 55%)",
  },

  Zen: {
    message: "Peace mode activated",
    background:
      "radial-gradient(circle at 50% 35%, rgba(120,210,170,0.28), transparent 55%)",
  },

  Meh: {
    message: "Just an average day. That's okay",
    background:
      "radial-gradient(circle at 50% 35%, rgba(170,180,200,0.22), transparent 55%)",
  },

  Stressed: {
    message: "Take a breath. You've got this",
    background:
      "radial-gradient(circle at 50% 35%, rgba(255,180,150,0.25), transparent 55%)",
  },

  Tired: {
    message: "Maybe you need a little reset",
    background:
      "radial-gradient(circle at 50% 35%, rgba(120,140,210,0.25), transparent 55%)",
  },

  Hyped: {
    message: "Let's go!",
    background:
      "radial-gradient(circle at 50% 35%, rgba(255,220,80,0.28), transparent 55%)",
  },

  Overload: {
    message: "Let's slow things down a little",
    background:
      "radial-gradient(circle at 50% 35%, rgba(220,150,200,0.24), transparent 55%)",
  },

  Cold: {
    message: "Sending you some warmth",
    background:
      "radial-gradient(circle at 50% 35%, rgba(120,190,240,0.26), transparent 55%)",
  },
};

/* =========================================================
   FLOATING MOOD ATMOSPHERE
========================================================= */

function MoodAtmosphere({ mood }) {
  const Icon = mood ? MOOD_ICONS[mood] : null;
  const effect = mood ? MOOD_EFFECTS[mood] : null;

  const particles = useMemo(() => {
    if (!mood || !Icon) return [];

    return Array.from({ length: 18 }, (_, index) => ({
      id: `${mood}-${index}`,

      left: `${2 + Math.random() * 94}%`,
      top: `${4 + Math.random() * 88}%`,

      delay: Math.random() * 2,

      duration: 4 + Math.random() * 4,

      size: 28 + Math.random() * 34,

      drift: Math.random() * 100 - 50,

      rotation: Math.random() * 30 - 15,

      startScale: 0.65 + Math.random() * 0.25,

      opacity: 0.22 + Math.random() * 0.18,
    }));
  }, [mood, Icon]);

  if (!mood || !Icon || !effect) {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={mood}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="
          fixed
          inset-0
          pointer-events-none
          z-0
          overflow-hidden
        "
        style={{
          background: effect.background,
        }}
      >
        {/* =================================================
            SOFT ATMOSPHERE GLOW
        ================================================= */}

        <motion.div
          initial={{
            scale: 0.7,
            opacity: 0,
          }}
          animate={{
            scale: [0.9, 1.15, 0.9],
            opacity: [0.12, 0.22, 0.12],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="
            absolute
            left-1/2
            top-1/2
            -translate-x-1/2
            -translate-y-1/2
            w-[420px]
            h-[420px]
            rounded-full
            blur-3xl
          "
          style={{
            background: "var(--cozy-primary)",
          }}
        />

        {/* =================================================
            CENTRAL MOOD ILLUSTRATION
        ================================================= */}

        <motion.div
          initial={{
            opacity: 0,
            scale: 0.65,
          }}
          animate={{
            opacity: [0.16, 0.32, 0.16],
            scale: [0.9, 1.08, 0.9],
            y: [12, -10, 12],
            rotate: [-2, 2, -2],
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="
            absolute
            left-1/2
            top-1/2
            -translate-x-1/2
            -translate-y-1/2
            flex
            items-center
            justify-center
          "
        >
          <Icon size={150} />
        </motion.div>

        {/* =================================================
            MANY FLOATING MOOD ILLUSTRATIONS
        ================================================= */}

        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              opacity: 0,
              y: 40,
              x: 0,
              scale: particle.startScale,
              rotate: particle.rotation,
            }}
            animate={{
              opacity: [
                0,
                particle.opacity,
                particle.opacity,
                0,
              ],

              y: [
                40,
                -20,
                -70,
                -120,
              ],

              x: [
                0,
                particle.drift,
                particle.drift * -0.5,
                0,
              ],

              scale: [
                particle.startScale,
                1,
                1.08,
                0.75,
              ],

              rotate: [
                particle.rotation,
                particle.rotation + 10,
                particle.rotation - 10,
                particle.rotation,
              ],
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute"
            style={{
              left: particle.left,
              top: particle.top,
              filter: "drop-shadow(0 4px 8px rgba(63,74,62,0.08))",
            }}
          >
            <Icon size={particle.size} />
          </motion.div>
        ))}

        {/* =================================================
            ADDITIONAL STATIC FLOATING ILLUSTRATIONS
            Gives the screen more visual density immediately.
        ================================================= */}

        <motion.div
          animate={{
            y: [-8, 8, -8],
            rotate: [-5, 5, -5],
            scale: [0.9, 1, 0.9],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute left-[6%] top-[18%]"
          style={{ opacity: 0.28 }}
        >
          <Icon size={58} />
        </motion.div>

        <motion.div
          animate={{
            y: [8, -10, 8],
            rotate: [4, -5, 4],
            scale: [1, 0.9, 1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute right-[7%] top-[22%]"
          style={{ opacity: 0.3 }}
        >
          <Icon size={64} />
        </motion.div>

        <motion.div
          animate={{
            y: [-10, 10, -10],
            rotate: [3, -4, 3],
          }}
          transition={{
            duration: 4.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute left-[10%] bottom-[18%]"
          style={{ opacity: 0.25 }}
        >
          <Icon size={52} />
        </motion.div>

        <motion.div
          animate={{
            y: [10, -8, 10],
            rotate: [-4, 4, -4],
          }}
          transition={{
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute right-[10%] bottom-[16%]"
          style={{ opacity: 0.27 }}
        >
          <Icon size={60} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* =========================================================
   MAIN MOOD PAGE
========================================================= */

export default function Mood() {
  const [selected, setSelected] = useState(null);
  const [showMoodMessage, setShowMoodMessage] = useState(false);
  const [productivity, setProductivity] = useState(null);
  const [note, setNote] = useState("");
  const [logs, setLogs] = useState([]);

  /* =======================================================
     LOAD MOOD HISTORY
  ======================================================= */

  const load = async () => {
    try {
      const { data } = await api.get("/mood/me");
      setLogs(data);
    } catch (error) {
      console.error("Failed to load moods:", error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /* =======================================================
     SELECT MOOD
  ======================================================= */

  const handleMoodSelect = (mood) => {
    setSelected(mood);
    setShowMoodMessage(true);

    setTimeout(() => {
      setShowMoodMessage(false);
    }, 4000);
  };

  /* =======================================================
     SUBMIT MOOD
  ======================================================= */

  const submit = async () => {
    if (!selected) {
      toast.error("Pick a vibe first");
      return;
    }

    try {
      await api.post("/mood", {
        emoji: selected.key,
        label: selected.label,
        note,
        productivity,
      });

      await api.post("/activities", {
        type: "mood",
      });

      toast.success(`Logged ${selected.label}`);

      setSelected(null);
      setShowMoodMessage(false);
      setNote("");
      setProductivity(null);

      load();
    } catch (error) {
      console.error("Failed to log mood:", error);
      toast.error("Couldn't log your mood");
    }
  };

  const selectedEffect = selected
    ? MOOD_EFFECTS[selected.key]
    : null;

  return (
    <div className="relative min-h-screen overflow-hidden">

      {/* ===================================================
          MOOD ATMOSPHERE
      =================================================== */}

      <MoodAtmosphere mood={selected?.key} />

      {/* ===================================================
          MAIN CONTENT
      =================================================== */}

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <motion.div
          initial={{
            rotate: -2,
            opacity: 0,
            y: 10,
          }}
          animate={{
            rotate: -1,
            opacity: 1,
            y: 0,
          }}
          className="mb-8 inline-block px-6 py-4"
          style={{
            background: "var(--cozy-secondary)",
            borderRadius: 20,
            boxShadow: "var(--shadow-cozy)",
          }}
        >
          <h1 className="font-display text-5xl leading-none">
            Vibe check
          </h1>

          <p
            className="font-hand text-lg mt-2"
            style={{
              color: "var(--cozy-muted)",
            }}
          >
            how are we feeling today?
          </p>
        </motion.div>

        {/* =================================================
            MOOD MESSAGE
        ================================================= */}

        <AnimatePresence mode="wait">
          {selected &&
            selectedEffect &&
            showMoodMessage && (
              <motion.div
                key={selected.key}
                initial={{
                  opacity: 0,
                  scale: 0.85,
                  y: -10,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  scale: 0.9,
                  y: -10,
                }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 18,
                }}
                className="mb-6 flex justify-center"
              >
                <div
                  className="px-6 py-3 text-center"
                  style={{
                    background: "var(--cozy-surface)",
                    borderRadius: 18,
                    boxShadow: "var(--shadow-cozy-lg)",
                    border: "1px solid var(--cozy-border)",
                  }}
                >
                  <div
                    className="font-display text-lg"
                    style={{
                      color: "var(--cozy-text)",
                    }}
                  >
                    {selectedEffect.message}
                  </div>
                </div>
              </motion.div>
            )}
        </AnimatePresence>

        {/* =================================================
            MOOD PICKER
        ================================================= */}

        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8"
          data-testid="mood-picker"
        >
          {MOODS.map((mood, index) => {
            const Icon = MOOD_ICONS[mood.key];

            const isSelected =
              selected?.key === mood.key;

            return (
              <motion.button
                key={mood.key}
                data-testid={`mood-${mood.label.toLowerCase()}`}
                onClick={() => handleMoodSelect(mood)}
                whileHover={{
                  y: -5,
                  rotate: index % 2 ? -1.5 : 1.5,
                }}
                whileTap={{
                  scale: 0.94,
                }}
                animate={
                  isSelected
                    ? {
                        scale: [1, 1.04, 1],
                      }
                    : {
                        scale: 1,
                      }
                }
                transition={
                  isSelected
                    ? {
                        duration: 1.2,
                        repeat: Infinity,
                      }
                    : {
                        duration: 0.2,
                      }
                }
                className="
                  relative
                  p-5
                  flex
                  flex-col
                  items-center
                  gap-2
                  text-center
                  overflow-hidden
                "
                style={{
                  background: "var(--cozy-surface)",
                  borderRadius: 22,
                  border: isSelected
                    ? "2px solid var(--cozy-primary)"
                    : "1px solid var(--cozy-border)",
                  boxShadow: isSelected
                    ? "var(--shadow-cozy-lg)"
                    : "var(--shadow-cozy)",
                }}
              >
                {/* Selected glow */}

                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        scale: 0.5,
                      }}
                      animate={{
                        opacity: 0.12,
                        scale: 1.5,
                      }}
                      exit={{
                        opacity: 0,
                      }}
                      className="
                        absolute
                        w-28
                        h-28
                        rounded-full
                        blur-2xl
                      "
                      style={{
                        background:
                          "var(--cozy-primary)",
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Mood illustration */}

                <motion.div
                  animate={
                    isSelected
                      ? {
                          scale: [1, 1.12, 1],
                        }
                      : {}
                  }
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                  }}
                  className="relative z-10"
                >
                  <Icon size={68} />
                </motion.div>

                {/* Mood label */}

                <div
                  className="
                    font-display
                    text-lg
                    relative
                    z-10
                  "
                  style={{
                    color: "var(--cozy-text)",
                  }}
                >
                  {mood.label}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* =================================================
            PRODUCTIVITY
        ================================================= */}

        <BrutalCard
          color="white"
          className="mb-8"
          hover={false}
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
              color: "var(--cozy-muted)",
            }}
          >
            Productivity today
          </div>

          <div
            className="flex gap-2 flex-wrap mb-4"
            data-testid="productivity-picker"
          >
            {PRODUCTIVITY.map((productivityOption) => (
              <BrutalTag
                key={productivityOption.id}
                active={
                  productivity ===
                  productivityOption.id
                }
                color="primary"
                onClick={() =>
                  setProductivity(
                    productivityOption.id
                  )
                }
              >
                {productivityOption.label}
              </BrutalTag>
            ))}
          </div>

          <label
            className="
              text-xs
              font-semibold
              uppercase
              tracking-wider
              block
              mb-1.5
            "
            style={{
              color: "var(--cozy-muted)",
            }}
          >
            Note (optional)
          </label>

          <BrutalInput
            data-testid="mood-note"
            placeholder="What's on your mind?"
            value={note}
            onChange={(event) =>
              setNote(event.target.value)
            }
          />

          <BrutalButton
            data-testid="mood-submit"
            color="primary"
            className="mt-4"
            onClick={submit}
          >
            Log it
          </BrutalButton>
        </BrutalCard>

        {/* =================================================
            PAST VIBES
        ================================================= */}

        <h2
          className="font-display text-2xl mb-4"
          style={{
            color: "var(--cozy-text)",
          }}
        >
          Past vibes
        </h2>

        {logs.length === 0 ? (
          <EmptyState
            title="No vibes logged"
            subtitle="Drop a mood above."
          />
        ) : (
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
            data-testid="mood-history"
          >
            {logs.map((log) => {
              const Icon =
                MOOD_ICONS[log.label] ||
                MOOD_ICONS.Meh;

              return (
                <motion.div
                  key={log.id}
                  whileHover={{
                    y: -4,
                    rotate: -1,
                  }}
                  className="
                    p-4
                    flex
                    flex-col
                    items-center
                    gap-1
                    text-center
                  "
                  style={{
                    background:
                      "var(--cozy-surface)",
                    borderRadius: 20,
                    boxShadow:
                      "var(--shadow-cozy)",
                  }}
                >
                  <Icon size={44} />

                  <div className="font-display text-base">
                    {log.label}
                  </div>

                  {log.productivity && (
                    <div className="washi-tag text-[10px]">
                      {log.productivity}
                    </div>
                  )}

                  <div
                    className="text-[10px]"
                    style={{
                      color:
                        "var(--cozy-muted)",
                    }}
                  >
                    {new Date(
                      log.created_at
                    ).toLocaleDateString()}
                  </div>

                  {log.note && (
                    <div className="font-hand text-sm mt-1">
                      "{log.note}"
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
