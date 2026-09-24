import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalTag } from "../components/brutal";
import { toast } from "sonner";

const DEPTS = ["All", "Engineering", "Design", "Marketing", "HR", "Product", "QA", "General"];

export default function Learn() {
  const [filter, setFilter] = useState("All");
  const [bites, setBites] = useState([]);
  
  // Interaction mode states per card: { [biteId]: 'quiz' | 'reflect' | 'deepdive' | 'vouch' | null }
  const [activeMode, setActiveMode] = useState({});
  
  // Feature states
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [reflections, setReflections] = useState({});
  const [taggedColleagues, setTaggedColleagues] = useState({});
  // Server verdict per bite: { [biteId]: { correct, message } } — the answer key never reaches the browser.
  const [quizResults, setQuizResults] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(null);

  const load = async () => {
    const { data } = await api.get(`/learning-bites${filter !== "All" ? `?department=${filter}` : ""}`);
    setBites(data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const handleActionComplete = async (bite, actionType) => {
    if (submitting) return; // one request at a time (QA #11)

    if (actionType === 'quiz' && selectedAnswers[bite.id] === undefined) {
      toast.error("Pick an option first!");
      return;
    }

    if (actionType === 'reflect' && !reflections[bite.id]?.trim()) {
      setFieldErrors({ ...fieldErrors, [bite.id]: "Write a quick reflection first." });
      return;
    }

    if (actionType === 'vouch' && !taggedColleagues[bite.id]?.trim()) {
      setFieldErrors({ ...fieldErrors, [bite.id]: "Tag a teammate by name or @handle." });
      return;
    }

    setSubmitting(bite.id);
    setFieldErrors({ ...fieldErrors, [bite.id]: null });
    try {
      const { data } = await api.post(`/learning-bites/${bite.id}/tried`, {
        mode: actionType,
        answer_index: actionType === 'quiz' ? selectedAnswers[bite.id] : undefined,
        meta: actionType === 'reflect' ? reflections[bite.id] : actionType === 'vouch' ? taggedColleagues[bite.id] : undefined,
      });

      if (actionType === 'quiz') {
        setQuizResults({ ...quizResults, [bite.id]: { correct: data.correct, message: data.message } });
        if (!data.correct) {
          toast.error("Incorrect answer — no points awarded.");
          return; // stay on the quiz so they can try again (for learning, not points)
        }
      }

      if (data.awarded > 0) toast.success(`+${data.awarded} pts — Completed!`);
      else if (data.already) toast("Already completed — no extra points.");
      else if (data.message) toast(data.message);
      setActiveMode({ ...activeMode, [bite.id]: null });
      load();
    } catch (error) {
      const message = error.response?.data?.message || "Failed to submit. Please try again.";
      if (actionType === 'reflect' || actionType === 'vouch') {
        setFieldErrors({ ...fieldErrors, [bite.id]: message });
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ rotate: 2, opacity: 0 }} animate={{ rotate: 1, opacity: 1 }}
        className="bg-brutal-green border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
      >
        <h1 className="font-display font-black text-5xl uppercase leading-none">LEARNING BITES</h1>
        <p className="text-xs uppercase tracking-widest mt-2">60-sec brain food</p>
      </motion.div>

      <div className="flex gap-2 mb-6 flex-wrap" data-testid="bites-filter">
        {DEPTS.map((d) => (
          <BrutalTag key={d} active={filter === d} color="yellow" onClick={() => setFilter(d)}>{d}</BrutalTag>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" data-testid="bites-list">
        {bites.map((b, i) => {
          const mode = activeMode[b.id];
          const options = b.options || [];
          const quizResult = quizResults[b.id];
          const fieldError = fieldErrors[b.id];

          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 20, rotate: i % 2 ? -1 : 1 }} 
              animate={{ opacity: 1, y: 0, rotate: i % 2 ? -0.5 : 0.5 }}
              className="bg-white border-[4px] border-black shadow-brutal-lg p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-brutal-cyan border-[2px] border-black px-2 py-0.5 font-black text-xs uppercase">{b.department}</span>
                  <span className="text-xs font-bold ml-auto">
                    {b.completed ? "✓ You completed this · " : ""}{b.tried_count} completed
                  </span>
                </div>

                {/* Default View */}
                {!mode && (
                  <>
                    <h3 className="font-display font-black text-xl uppercase mb-2">{b.title}</h3>
                    <p className="text-sm font-medium flex-1 mb-4">{b.body}</p>
                  </>
                )}

                {/* Feature 1: Quiz Mode */}
                {mode === 'quiz' && (
                  <div className="my-2">
                    <span className="bg-brutal-yellow border-[2px] border-black px-2 py-0.5 font-black text-[10px] uppercase mb-2 inline-block">Quick Knowledge Check</span>
                    {b.quiz_attempted && !quizResult && (
                      <p className="text-[11px] font-bold mb-2 opacity-70">
                        You've answered this before — only a correct first answer earns points.
                      </p>
                    )}
                    <div className="flex flex-col gap-2 mb-3" role="radiogroup" aria-label="Answer options">
                      {options.map((opt, optIdx) => {
                        const picked = selectedAnswers[b.id] === optIdx;
                        const verdict = picked && quizResult ? (quizResult.correct ? "correct" : "incorrect") : null;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            role="radio"
                            aria-checked={picked}
                            onClick={() => {
                              setSelectedAnswers({ ...selectedAnswers, [b.id]: optIdx });
                              setQuizResults({ ...quizResults, [b.id]: undefined });
                            }}
                            className={`text-left text-xs font-bold p-2.5 border-[2px] border-black transition-all ${
                              verdict === "incorrect"
                                ? "quiz-option-incorrect"
                                : picked
                                  ? "bg-brutal-green shadow-sm translate-x-1"
                                  : "bg-gray-50 hover:bg-gray-100"
                            }`}
                          >
                            {opt}
                            {verdict === "incorrect" && <span className="ml-2 font-black">✕ Incorrect</span>}
                          </button>
                        );
                      })}
                    </div>
                    {quizResult && !quizResult.correct && (
                      <p className="text-xs font-bold mb-3" style={{ color: "#B91C1C" }} role="alert">
                        {quizResult.message || "Incorrect — no points awarded. Try another option."}
                      </p>
                    )}
                  </div>
                )}

                {/* Feature 2: Reflection Mode */}
                {mode === 'reflect' && (
                  <div className="my-2">
                    <span className="bg-brutal-pink border-[2px] border-black px-2 py-0.5 font-black text-[10px] uppercase mb-2 inline-block">Key Takeaway</span>
                    <textarea
                      placeholder="How will you apply this today? (at least 5 words)"
                      aria-label="Your reflection"
                      aria-invalid={Boolean(fieldError)}
                      value={reflections[b.id] || ""}
                      onChange={(e) => setReflections({ ...reflections, [b.id]: e.target.value })}
                      className="w-full border-[2px] border-black p-2 text-xs font-medium mb-1 h-20 bg-gray-50 focus:bg-white"
                    />
                    <div className="flex justify-between text-[10px] font-bold mb-2 opacity-70">
                      <span>{(reflections[b.id] || "").trim().split(/\s+/).filter(Boolean).length} words</span>
                      <span>min 5 words</span>
                    </div>
                    {fieldError && <p className="text-xs font-bold mb-2" style={{ color: "#B91C1C" }} role="alert">{fieldError}</p>}
                  </div>
                )}

                {/* Feature 3: Deep Dive Linker Mode */}
                {mode === 'deepdive' && (
                  <div className="my-2 bg-brutal-yellow/30 border-[2px] border-black p-3 mb-3">
                    <span className="bg-black text-white px-1.5 py-0.5 font-black text-[10px] uppercase mb-2 inline-block">External Resources</span>
                    <p className="text-xs font-bold mb-2">Want to master this concept further?</p>
                    <a 
                      href={b.resource_url || "https://github.com"} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs font-black uppercase underline block mb-2 text-blue-600 hover:text-black"
                    >
                      🔗 Open Official Documentation & Guides
                    </a>
                  </div>
                )}

                {/* Feature 4: Peer Vouch Mode */}
                {mode === 'vouch' && (
                  <div className="my-2">
                    <span className="bg-brutal-green border-[2px] border-black px-2 py-0.5 font-black text-[10px] uppercase mb-2 inline-block">Teammate Tagging</span>
                    <input
                      type="text"
                      placeholder="Tag a colleague (e.g., @sarah)"
                      value={taggedColleagues[b.id] || ""}
                      onChange={(e) => setTaggedColleagues({ ...taggedColleagues, [b.id]: e.target.value })}
                      className="w-full border-[2px] border-black p-2 text-xs font-medium mb-3 bg-gray-50 focus:bg-white"
                    />
                    {fieldError && <p className="text-xs font-bold mb-2" style={{ color: "#B91C1C" }} role="alert">{fieldError}</p>}
                  </div>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t-[2px] border-black/10">
                {!mode ? (
                  <>
                    {options.length > 1 && (
                      <BrutalButton color="green" onClick={() => setActiveMode({ ...activeMode, [b.id]: 'quiz' })} className="text-[10px] px-2 py-1">
                        QUIZ (+5)
                      </BrutalButton>
                    )}
                    <BrutalButton color="pink" onClick={() => setActiveMode({ ...activeMode, [b.id]: 'reflect' })} className="text-[10px] px-2 py-1">
                      REFLECT
                    </BrutalButton>
                    <BrutalButton color="yellow" onClick={() => setActiveMode({ ...activeMode, [b.id]: 'deepdive' })} className="text-[10px] px-2 py-1">
                      DOCS 🔗
                    </BrutalButton>
                    <BrutalButton color="cyan" onClick={() => setActiveMode({ ...activeMode, [b.id]: 'vouch' })} className="text-[10px] px-2 py-1">
                      TAG
                    </BrutalButton>
                  </>
                ) : (
                  <>
                    {mode !== 'deepdive' ? (
                      <BrutalButton color="green" onClick={() => handleActionComplete(b, mode)} disabled={submitting === b.id} className="text-xs">
                        {submitting === b.id ? "CHECKING..." : "SUBMIT & CLAIM"}
                      </BrutalButton>
                    ) : (
                      <BrutalButton color="green" onClick={() => handleActionComplete(b, 'deepdive')} disabled={submitting === b.id} className="text-xs">
                        {submitting === b.id ? "SAVING..." : "MARK READ (+5)"}
                      </BrutalButton>
                    )}
                    <BrutalButton color="yellow" onClick={() => setActiveMode({ ...activeMode, [b.id]: null })} className="text-xs">
                      BACK
                    </BrutalButton>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
        {bites.length === 0 && <div className="text-sm font-bold uppercase">No bites for this filter.</div>}
      </div>
    </div>
  );
}