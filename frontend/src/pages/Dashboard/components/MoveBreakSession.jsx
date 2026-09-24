import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Pause, Play } from "lucide-react";
import { api } from "../../../lib/api";
import MovementFigure from "./MovementFigure";
import "./MoveBreakSession.css";

/*
 * Guided Move Break (Move & Reset enhancement).
 *
 * The server owns the session (POST /move-reset/sessions): it counts active time per
 * exercise with its own clock, refuses to advance before an interval is done,
 * requires "Start Next Stretch" at checkpoint transitions, and awards points once on
 * completion. This component mirrors that state for display and tells the server when
 * the break is paused, resumed, advanced or ended:
 *
 *   NOT_STARTED -> RUNNING -> PAUSED -> RUNNING -> ... -> COMPLETED
 *                               \-> ENDED (confirmed exit, no completion points)
 *
 * The countdown only runs while the document is visible; hiding the tab pauses the
 * break and returning requires an explicit Resume.
 */

const PHASES = [
  { until: 0.15, label: "Prepare" },
  { until: 0.55, label: "Move" },
  { until: 0.85, label: "Hold" },
  { until: 1.01, label: "Relax" },
];

const COPY = {
  running: "Follow the movement gently. The next step will begin when this interval is complete.",
  paused: "Move break paused. Resume when you're ready to continue.",
  exit: "End this move break? Your current session will remain incomplete.",
  complete: "Move break complete. Great job taking time to reset.",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function MoveBreakSession({ open, onClose, onCompleted }) {
  const [session, setSession] = useState(null);
  // loading | running | paused | transition | checkpoint | finishing | completed | error
  const [stage, setStage] = useState("loading");
  const [remaining, setRemaining] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const resultRef = useRef(null);
  const primaryRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const exercise = session ? session.exercises[session.current_index] : null;
  const total = session ? session.exercises.length : 0;
  const index = session ? session.current_index : 0;
  const nextExercise = session && index + 1 < total ? session.exercises[index + 1] : null;

  /* ------------------------------ server calls ------------------------------ */

  const sendEvent = useCallback(async (type) => {
    const s = sessionRef.current;
    if (!s) return null;
    const { data } = await api.post(`/move-reset/sessions/${s.id}/events`, { type, index: s.current_index });
    setSession(data);
    return data;
  }, []);

  const applyView = useCallback((view) => {
    setSession(view);
    setRemaining(Math.ceil(view.remaining_seconds));
    setStage(view.status === "PAUSED" ? "paused" : "running");
  }, []);

  // Start (or recover) a session when the dialog opens.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setStage("loading");
    setError("");
    setConfirmExit(false);
    resultRef.current = null;
    (async () => {
      try {
        const { data: active } = await api.get("/move-reset/sessions/active");
        const view = active || (await api.post("/move-reset/sessions")).data;
        if (!cancelled) applyView(view);
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.message || "Couldn't start the move break. Please try again.");
          setStage("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, applyView]);

  /* ------------------------------ pause / resume ----------------------------- */

  const pause = useCallback(async () => {
    // "transition" too: otherwise the auto-advance could start the next stretch while
    // the tab is hidden. (At a checkpoint nothing advances without a click.)
    if (stageRef.current !== "running" && stageRef.current !== "transition") return;
    setStage("paused");
    try {
      await sendEvent("pause");
    } catch {
      /* the server also stops counting if it never hears from us */
    }
  }, [sendEvent]);

  const resume = async () => {
    setBusy(true);
    try {
      const view = await sendEvent("resume");
      setRemaining(Math.ceil(view.remaining_seconds));
      setStage("running");
    } catch (e) {
      setError(e.response?.data?.message || "Couldn't resume. Please try again.");
      setStage("error");
    } finally {
      setBusy(false);
    }
  };

  // Hidden document => pause immediately; hidden time never counts. Returning does
  // not restart anything: the user sees the paused state and presses Resume.
  useEffect(() => {
    if (!open) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [open, pause]);

  // A stretch can also start while the page is already hidden (e.g. the transition
  // timer fired in the background) — no visibilitychange event comes then.
  useEffect(() => {
    if (!open || (stage !== "running" && stage !== "transition")) return;
    if (document.visibilityState === "hidden") pause();
  }, [open, stage, pause]);

  /* -------------------------------- countdown -------------------------------- */

  useEffect(() => {
    if (stage !== "running") return undefined;
    let last = performance.now();
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      setRemaining((r) => Math.max(0, r - dt));
    }, 200);
    return () => clearInterval(id);
  }, [stage]);

  const advance = useCallback(async (kind) => {
    setBusy(true);
    try {
      const view = await sendEvent(kind);
      setRemaining(Math.ceil(view.remaining_seconds));
      setStage("running");
    } catch (e) {
      const msg = e.response?.data?.message || "";
      if (e.response?.status === 409 && /isn't finished/.test(msg)) {
        // our timer ran slightly ahead of the server's; carry on counting
        const secs = Number((msg.match(/\((\d+)s left\)/) || [])[1]) || 1;
        setRemaining(secs);
        setStage("running");
      } else if (e.response?.status === 409 && /Resume the break/.test(msg)) {
        // paused elsewhere (e.g. the break was reopened in another tab): let the user resume here
        setStage("paused");
      } else {
        setError(msg || "Couldn't continue the move break.");
        setStage("error");
      }
    } finally {
      setBusy(false);
    }
  }, [sendEvent]);

  const finish = useCallback(async (attempt = 0) => {
    const s = sessionRef.current;
    setStage("finishing");
    try {
      const { data } = await api.post(`/move-reset/sessions/${s.id}/complete`);
      resultRef.current = data;
      setStage("completed");
    } catch (e) {
      if (e.response?.status === 409 && attempt < 3 && /isn't finished|not all stretches/i.test(e.response?.data?.message || "")) {
        setTimeout(() => finish(attempt + 1), 1200);
        return;
      }
      setError(e.response?.data?.message || "Couldn't record your move break. Please try again.");
      setStage("error");
    }
  }, []);

  // Interval finished: finish the break, ask for a checkpoint, or show the transition.
  useEffect(() => {
    if (stage !== "running" || remaining > 0 || !session) return;
    if (!nextExercise) finish();
    else setStage(nextExercise.checkpoint_before ? "checkpoint" : "transition");
  }, [stage, remaining, session, nextExercise, finish]);

  // Automatic progression after a short "Nice work. Next: …" pause. Kept separate
  // from the effect above: that one changes `stage`, which would cancel this timer.
  useEffect(() => {
    if (stage !== "transition") return undefined;
    const t = setTimeout(() => advance("advance"), 2000);
    return () => clearTimeout(t);
  }, [stage, advance]);

  /* ---------------------------------- exit ----------------------------------- */

  const requestExit = () => {
    if (stage === "completed" || stage === "error" || stage === "loading") {
      done();
      return;
    }
    if (stage === "running") pause();
    setConfirmExit(true);
  };

  const confirmEnd = async () => {
    setBusy(true);
    try {
      await sendEvent("end");
    } catch {
      /* ending is best-effort; an unfinished session never awards points anyway */
    } finally {
      setBusy(false);
      setConfirmExit(false);
      setSession(null);
      onClose?.();
    }
  };

  const done = () => {
    const result = resultRef.current;
    setSession(null);
    if (result && !result.already_completed) onCompleted?.(result);
    onClose?.();
  };

  // Escape opens the exit confirmation (never silently ends the break).
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (confirmExit) setConfirmExit(false);
        else requestExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Move focus to the main action whenever the stage changes (keyboard users).
  useEffect(() => {
    if (open) primaryRef.current?.focus();
  }, [open, stage, confirmExit]);

  // Keep Tab focus inside the dialog.
  const trapFocus = (e) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const nodes = dialogRef.current.querySelectorAll("button:not([disabled]), [href], input, [tabindex]:not([tabindex='-1'])");
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  /* --------------------------------- render ---------------------------------- */

  const seconds = exercise ? exercise.seconds : 1;
  const elapsedFraction = exercise ? Math.min(1, Math.max(0, (seconds - remaining) / seconds)) : 0;
  const phase = PHASES.find((p) => elapsedFraction < p.until) || PHASES[PHASES.length - 1];
  const animating = stage === "running" && !reducedMotion;
  const ringLength = 2 * Math.PI * 54;

  let statusText = COPY.running;
  if (stage === "paused") statusText = COPY.paused;
  if (stage === "transition" || stage === "checkpoint") statusText = nextExercise ? `Nice work. Next: ${nextExercise.name}.` : "";
  if (stage === "completed") statusText = COPY.complete;
  if (stage === "error") statusText = error;

  return createPortal(
    <div className="mbs-overlay" role="presentation">
      <div
        ref={dialogRef}
        className="mbs-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mbs-title"
        aria-describedby="mbs-status"
        data-session-id={session?.id || ""}
        data-stage={stage}
        onKeyDown={trapFocus}
      >
        <div className="mbs-header">
          <div>
            <p className="mbs-eyebrow">Move &amp; Reset</p>
            <h2 id="mbs-title" className="mbs-title">
              {stage === "completed" ? "Break complete" : exercise ? exercise.name : "Getting ready…"}
            </h2>
            {exercise && stage !== "completed" && (
              <p className="mbs-count">Exercise {index + 1} of {total}</p>
            )}
          </div>
          <button type="button" className="mbs-icon-btn" onClick={requestExit} aria-label="Close move break">
            <X size={20} />
          </button>
        </div>

        {exercise && stage !== "completed" && (
          <div className="mbs-progress" aria-hidden="true">
            {session.exercises.map((ex, i) => (
              <span
                key={ex.id + i}
                className={`mbs-dot ${i < index ? "is-done" : ""} ${i === index ? "is-current" : ""}`}
              />
            ))}
          </div>
        )}

        <div className="mbs-body">
          {exercise && stage !== "completed" && stage !== "error" && (
            <div className="mbs-stage">
              <div className={`mbs-figure ${stage === "paused" ? "is-paused" : ""}`}>
                <MovementFigure exercise={exercise.id} animate={animating} phase={phase.label} />
                {reducedMotion && <p className="mbs-rm-note">Animation off (reduced motion)</p>}
              </div>

              <div className="mbs-side">
                <div className="mbs-timer" aria-hidden="true">
                  <svg viewBox="0 0 120 120" width="132" height="132">
                    <circle cx="60" cy="60" r="54" className="mbs-ring-bg" />
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      className="mbs-ring"
                      strokeDasharray={ringLength}
                      strokeDashoffset={ringLength * (1 - elapsedFraction)}
                    />
                  </svg>
                  <div className="mbs-seconds">
                    <strong>{Math.ceil(remaining)}</strong>
                    <span>sec</span>
                  </div>
                </div>
                <p className="mbs-phase">{stage === "paused" ? "Paused" : phase.label}</p>
                <p className="mbs-instruction">{exercise.instruction}</p>
              </div>
            </div>
          )}

          {stage === "completed" && (
            <div className="mbs-done">
              <MovementFigure exercise="celebrate" animate={!reducedMotion} phase="Relax" />
              {resultRef.current && resultRef.current.xp_earned > 0 && (
                <p className="mbs-xp">+{resultRef.current.xp_earned} points</p>
              )}
            </div>
          )}

          <p id="mbs-status" className={`mbs-status ${stage === "error" ? "is-error" : ""}`} aria-live="polite">
            {stage === "loading" ? "Preparing your move break…" : statusText}
          </p>
        </div>

        <div className="mbs-actions">
          {stage === "running" && (
            <>
              <button type="button" className="mbs-btn mbs-btn-ghost" onClick={requestExit}>End Break</button>
              <button ref={primaryRef} type="button" className="mbs-btn" onClick={pause}>
                <Pause size={16} aria-hidden="true" /> Pause
              </button>
            </>
          )}
          {stage === "paused" && (
            <>
              <button type="button" className="mbs-btn mbs-btn-ghost" onClick={requestExit}>End Break</button>
              <button ref={primaryRef} type="button" className="mbs-btn mbs-btn-primary" onClick={resume} disabled={busy}>
                <Play size={16} aria-hidden="true" /> Resume Break
              </button>
            </>
          )}
          {stage === "checkpoint" && (
            <>
              <button type="button" className="mbs-btn mbs-btn-ghost" onClick={requestExit}>End Break</button>
              <button ref={primaryRef} type="button" className="mbs-btn mbs-btn-primary" onClick={() => advance("checkpoint")} disabled={busy}>
                Start Next Stretch
              </button>
            </>
          )}
          {(stage === "transition" || stage === "finishing" || stage === "loading") && (
            <button ref={primaryRef} type="button" className="mbs-btn mbs-btn-ghost" onClick={requestExit}>End Break</button>
          )}
          {(stage === "completed" || stage === "error") && (
            <button ref={primaryRef} type="button" className="mbs-btn mbs-btn-primary" onClick={done}>
              {stage === "completed" ? "Done" : "Close"}
            </button>
          )}
        </div>

        {confirmExit && (
          <div className="mbs-confirm" role="alertdialog" aria-modal="true" aria-labelledby="mbs-confirm-text">
            <p id="mbs-confirm-text">{COPY.exit}</p>
            <div className="mbs-actions">
              <button ref={primaryRef} type="button" className="mbs-btn" onClick={() => setConfirmExit(false)}>
                Keep going
              </button>
              <button type="button" className="mbs-btn mbs-btn-danger" onClick={confirmEnd} disabled={busy}>
                End break
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
