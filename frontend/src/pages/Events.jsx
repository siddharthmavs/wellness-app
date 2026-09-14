import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, resolveAvatar } from "../lib/api";
import { BrutalButton } from "../components/brutal";
import { toast } from "sonner";

const CONFETTI = [
  "🎉",
  "🎊",
  "✨",
  "🎈",
  "💛",
  "💖",
  "🌟",
  "🥳",
  "🎁",
  "⭐",
  "🪅",
];

function CelebrationOverlay({ event, onClose }) {
  const particles = Array.from({ length: 35 }, (_, i) => ({
    id: i,
    emoji: CONFETTI[i % CONFETTI.length],
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 3 + Math.random() * 2,
    rotate: -30 + Math.random() * 60,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      {/* Falling celebration particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              y: -80,
              x: `${particle.left}vw`,
              opacity: 0,
              rotate: 0,
            }}
            animate={{
              y: "110vh",
              opacity: [0, 1, 1, 0],
              rotate: particle.rotate * 4,
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              ease: "easeOut",
            }}
            className="absolute text-3xl md:text-4xl"
          >
            {particle.emoji}
          </motion.div>
        ))}
      </div>

      {/* Celebration card */}
      <motion.div
        initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 180,
          damping: 12,
        }}
        className="relative z-10 w-full max-w-xl bg-brutal-yellow border-[5px] border-black shadow-brutal-lg p-8 text-center"
      >
        {/* Floating balloons */}
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [-5, 5, -5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute -top-10 -left-5 text-5xl"
        >
          🎈
        </motion.div>

        <motion.div
          animate={{ y: [0, -15, 0], rotate: [5, -5, 5] }}
          transition={{ duration: 2.4, repeat: Infinity }}
          className="absolute -top-8 -right-4 text-5xl"
        >
          🎈
        </motion.div>

        <div className="text-7xl mb-4">
          {event.type === "birthday" ? "🎂" : "🏆"}
        </div>

        <div className="text-xs font-black uppercase tracking-[0.2em] mb-2">
          TODAY IS YOUR DAY
        </div>

        <h2 className="font-display font-black text-4xl md:text-5xl uppercase leading-none">
          {event.type === "birthday"
            ? "HAPPY BIRTHDAY!"
            : "HAPPY WORK ANNIVERSARY!"}
        </h2>

        <p className="mt-4 font-black text-lg uppercase">
          {event.user_name}
        </p>

        <p className="mt-2 text-sm font-bold">
          {event.type === "birthday"
            ? "Hope your day is full of good vibes, cake and happy moments! 🎉"
            : "Another year of amazing work. Here's to many more! 🚀"}
        </p>

        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="mt-6 inline-block bg-white border-[4px] border-black px-5 py-3 font-black uppercase shadow-brutal"
        >
          🎉 CELEBRATE YOU 🎉
        </motion.div>

        <div className="mt-6">
          <BrutalButton onClick={onClose}>
            LET'S GO →
          </BrutalButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function WishesModal({ event, onClose }) {
  const [message, setMessage] = useState("");
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWishes();
  }, []);

  const loadWishes = async () => {
    try {
      const { data } = await api.get(`/events/${event.id}/wishes`);
      setWishes(Array.isArray(data) ? data : []);
    } catch (error) {
      // Wishes endpoint may not exist yet.
      setWishes([]);
    }
  };

  const sendWish = async () => {
    const trimmed = message.trim();

    if (!trimmed) {
      toast.error("Write a message first");
      return;
    }

    try {
      setLoading(true);

      await api.post(`/events/${event.id}/wishes`, {
        message: trimmed,
      });

      toast.success("Your wishes were sent 💌");

      setMessage("");
      loadWishes();
    } catch (error) {
      console.error("Failed to send wishes:", error);
      toast.error("Couldn't send wishes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border-[5px] border-black shadow-brutal-lg w-full max-w-lg p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-widest">
              SEND SOME LOVE 💌
            </div>

            <h2 className="font-display font-black text-3xl uppercase leading-none mt-1">
              {event.user_name}
            </h2>

            <p className="text-sm font-bold mt-2">
              {event.type === "birthday"
                ? "Wish them a happy birthday!"
                : "Congratulate them on their work anniversary!"}
            </p>
          </div>

          <button
            onClick={onClose}
            className="border-[3px] border-black w-9 h-9 font-black bg-brutal-pink text-white hover:translate-y-[-2px]"
          >
            ×
          </button>
        </div>

        <div className="mt-5">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              event.type === "birthday"
                ? "Happy birthday! Hope you have an amazing day..."
                : "Congratulations on another great year..."
            }
            rows={4}
            maxLength={300}
            className="w-full border-[4px] border-black p-3 font-bold text-sm resize-none outline-none focus:bg-yellow-50"
          />

          <div className="text-right text-xs font-bold mt-1">
            {message.length}/300
          </div>
        </div>

        <div className="mt-3">
          <BrutalButton onClick={sendWish} disabled={loading}>
            {loading ? "SENDING..." : "SEND WISHES 💌"}
          </BrutalButton>
        </div>

        {/* Existing wishes */}
        {wishes.length > 0 && (
          <div className="mt-6 border-t-[3px] border-black pt-4">
            <h3 className="font-display font-black uppercase text-lg mb-3">
              Wishes received
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {wishes.map((wish, index) => (
                <div
                  key={wish.id || index}
                  className="bg-brutal-cyan border-[3px] border-black p-3"
                >
                  <div className="text-xs font-black uppercase">
                    {wish.sender_name || "Coworker"}
                  </div>

                  <div className="text-sm font-bold mt-1">
                    {wish.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function Events() {
  const [events, setEvents] = useState([]);
  const [today, setToday] = useState([]);

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [celebrationEvent, setCelebrationEvent] = useState(null);

  const [loading, setLoading] = useState(true);

  /*
   * Try to determine the currently logged-in user.
   *
   * Adjust this section if your auth store uses a different
   * localStorage key or Zustand store.
   */
  const getCurrentUser = () => {
    try {
      const stored =
        localStorage.getItem("user") ||
        localStorage.getItem("currentUser");

      if (!stored) return null;

      return JSON.parse(stored);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);

      const [eventsResponse, todayResponse] = await Promise.all([
        api.get("/events"),
        api.get("/events/today"),
      ]);

      const allEvents = Array.isArray(eventsResponse.data)
        ? eventsResponse.data
        : [];

      const todayEvents = Array.isArray(todayResponse.data)
        ? todayResponse.data
        : [];

      setEvents(allEvents);
      setToday(todayEvents);

      /*
       * Check whether one of today's events belongs to the
       * currently logged-in user.
       */
      const currentUser = getCurrentUser();

      if (currentUser && todayEvents.length > 0) {
        const currentUserId =
          currentUser.id ||
          currentUser.user_id ||
          currentUser._id;

        const ownEvent = todayEvents.find((event) => {
          const eventUserId =
            event.user_id ||
            event.userId ||
            event.user?.id;

          return (
            currentUserId &&
            eventUserId &&
            String(currentUserId) === String(eventUserId)
          );
        });

        if (ownEvent) {
          /*
           * Prevent celebration from appearing repeatedly
           * every time the page is revisited on the same day.
           */
          const celebrationKey = `celebrated-event-${ownEvent.id}`;

          if (!sessionStorage.getItem(celebrationKey)) {
            setCelebrationEvent(ownEvent);
            sessionStorage.setItem(celebrationKey, "true");
          }
        }
      }
    } catch (error) {
      console.error("Failed to load events:", error);
      toast.error("Couldn't load celebrations");
    } finally {
      setLoading(false);
    }
  };

  /*
   * Calculate upcoming events excluding today's events.
   */
  const upcoming = events
    .map((event) => {
      const md = (event.date || "").slice(5, 10);

      if (!md || !md.includes("-")) {
        return {
          ...event,
          daysAway: 9999,
        };
      }

      const [month, day] = md.split("-").map(Number);

      const now = new Date();

      let next = new Date(
        now.getFullYear(),
        month - 1,
        day
      );

      /*
       * If the date already passed this year,
       * show its next occurrence.
       */
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      if (next < todayStart) {
        next.setFullYear(now.getFullYear() + 1);
      }

      const daysAway = Math.ceil(
        (next - todayStart) / 86400000
      );

      return {
        ...event,
        daysAway,
      };
    })
    /*
     * Don't duplicate today's events in Upcoming.
     */
    .filter(
      (event) =>
        !today.some(
          (todayEvent) =>
            String(todayEvent.id) === String(event.id)
        )
    )
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, 12);

  const closeCelebration = () => {
    setCelebrationEvent(null);
  };

  return (
    <>
      {/* Personal celebration */}
      <AnimatePresence>
        {celebrationEvent && (
          <CelebrationOverlay
            event={celebrationEvent}
            onClose={closeCelebration}
          />
        )}
      </AnimatePresence>

      {/* Wishes modal */}
      <AnimatePresence>
        {selectedEvent && (
          <WishesModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ rotate: -2, opacity: 0 }}
          animate={{ rotate: -1, opacity: 1 }}
          className="bg-brutal-yellow border-[4px] border-black shadow-brutal-lg p-6 mb-8 inline-block"
        >
          <h1 className="font-display font-black text-5xl uppercase leading-none">
            CELEBRATIONS
          </h1>

          <p className="text-xs uppercase tracking-widest mt-2">
            birthdays · work-anniversaries
          </p>
        </motion.div>

        {loading ? (
          <div className="border-[4px] border-black bg-white shadow-brutal p-6 font-black uppercase">
            Loading celebrations...
          </div>
        ) : (
          <>
            {/* ===================================== */}
            {/* HAPPENING TODAY */}
            {/* ===================================== */}
            {today.length > 0 && (
              <section
                className="mb-10"
                data-testid="events-today"
              >
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="font-display font-black text-3xl uppercase">
                    Happening Today
                  </h2>

                  <motion.span
                    animate={{ rotate: [-5, 5, -5] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                    }}
                    className="text-3xl"
                  >
                    🎉
                  </motion.span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {today.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{
                        rotate: index % 2 ? -2 : 2,
                        scale: 0.9,
                        opacity: 0,
                      }}
                      animate={{
                        rotate: index % 2 ? -1 : 1,
                        scale: 1,
                        opacity: 1,
                      }}
                      transition={{
                        delay: index * 0.08,
                      }}
                      className={`relative border-[4px] border-black shadow-brutal-lg p-6 ${
                        event.type === "birthday"
                          ? "bg-brutal-pink text-white"
                          : "bg-brutal-cyan"
                      }`}
                    >
                      {/* Decorative corner */}
                      <div className="absolute -top-4 -right-3 text-3xl">
                        {event.type === "birthday"
                          ? "🎈"
                          : "⭐"}
                      </div>

                      <div className="flex items-center gap-4">
                        <img
                          src={resolveAvatar(event.user_avatar)}
                          alt=""
                          className="w-20 h-20 border-[4px] border-black bg-white object-cover"
                        />

                        <div className="flex-1">
                          <div className="text-xs font-black uppercase tracking-widest">
                            {event.type === "birthday"
                              ? "🎂 BIRTHDAY"
                              : "🏆 WORK ANNIVERSARY"}
                          </div>

                          <div className="font-display font-black text-2xl uppercase leading-none mt-1">
                            {event.user_name}
                          </div>

                          {event.department && (
                            <div className="text-xs font-bold uppercase mt-1">
                              {event.department}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="bg-white text-black border-[3px] border-black p-3 font-black text-center uppercase">
                          {event.type === "birthday"
                            ? "Happy Birthday! 🎉"
                            : "Congratulations! 🚀"}
                        </div>
                      </div>

                      {/* Don't show "send wishes" for own event */}
                      <div className="mt-4">
                        <BrutalButton
                          onClick={() =>
                            setSelectedEvent(event)
                          }
                          className="w-full"
                        >
                          SEND WISHES 💌
                        </BrutalButton>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* ===================================== */}
            {/* EMPTY TODAY STATE */}
            {/* ===================================== */}
            {today.length === 0 && (
              <div className="mb-10 border-[4px] border-black bg-white shadow-brutal p-6">

                <h2 className="font-display font-black text-2xl uppercase">
                  No celebrations today
                </h2>

                <p className="text-sm font-bold mt-1">
                  It's a quiet one. Check the upcoming celebrations below.
                </p>
              </div>
            )}

            {/* ===================================== */}
            {/* UPCOMING */}
            {/* ===================================== */}
            <section>
              <h2 className="font-display font-black text-3xl uppercase mb-4">
                Upcoming
              </h2>

              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                data-testid="events-upcoming"
              >
                {upcoming.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: index * 0.04,
                    }}
                    className="bg-white border-[4px] border-black shadow-brutal p-4 flex items-center gap-4"
                  >
                    <img
                      src={resolveAvatar(event.user_avatar)}
                      alt=""
                      className="w-14 h-14 border-[3px] border-black bg-white object-cover"
                    />

                    <div className="flex-1">
                      <div className="font-black uppercase text-sm">
                        {event.user_name}
                        {event.department
                          ? ` · ${event.department}`
                          : ""}
                      </div>

                      <div className="text-xs font-bold uppercase mt-1">
                        {event.type === "birthday"
                          ? "🎂 Birthday"
                          : "🏆 Anniversary"}{" "}
                        · {event.date?.slice(5, 10)}
                      </div>
                    </div>

                    <div className="bg-brutal-yellow border-[3px] border-black px-3 py-1 font-black text-xs whitespace-nowrap">
                      {event.daysAway === 1
                        ? "TOMORROW"
                        : `IN ${event.daysAway}D`}
                    </div>
                  </motion.div>
                ))}

                {upcoming.length === 0 && (
                  <div className="text-sm font-bold uppercase border-[4px] border-black bg-white p-5">
                    No upcoming events. Quiet.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}