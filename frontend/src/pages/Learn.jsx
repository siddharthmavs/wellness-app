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

  const load = async () => {
    const { data } = await api.get(`/learning-bites${filter !== "All" ? `?department=${filter}` : ""}`);
    setBites(data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const handleActionComplete = async (bite, actionType) => {
    if (actionType === 'quiz') {
      const selectedOption = selectedAnswers[bite.id];
      if (selectedOption === undefined) {
        toast.error("Pick an option first!");
        return;
      }
      const isCorrect = selectedOption === (bite.correct_index ?? 1);
      if (!isCorrect) {
        toast.error("Not quite! Try another option.");
        return;
      }
    }

    if (actionType === 'reflect' && !reflections[bite.id]?.trim()) {
      toast.error("Write a quick reflection first!");
      return;
    }

    if (actionType === 'vouch' && !taggedColleagues[bite.id]?.trim()) {
      toast.error("Tag a teammate's handle!");
      return;
    }

    try {
      const { data } = await api.post(`/learning-bites/${bite.id}/tried`, {
        mode: actionType,
        meta: actionType === 'reflect' ? reflections[bite.id] : taggedColleagues[bite.id]
      });
      if (data.already) toast("Already completed, legend!");
      else toast.success(" +5 pts — Completed!");
      setActiveMode({ ...activeMode, [bite.id]: null });
      load();
    } catch {
      toast.error("Failed to submit result.");
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
          const options = b.options || [
            "It speeds up runtime workflows.",
            "It optimizes structured data processing effectively.",
            "It clears regional storage buffers."
          ];

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
                  <span className="text-xs font-bold ml-auto">{b.tried_count} completed</span>
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
                    <div className="flex flex-col gap-2 mb-4">
                      {options.map((opt, optIdx) => (
                        <button
                          key={optIdx}
                          onClick={() => setSelectedAnswers({ ...selectedAnswers, [b.id]: optIdx })}
                          className={`text-left text-xs font-bold p-2.5 border-[2px] border-black transition-all ${
                            selectedAnswers[b.id] === optIdx ? 'bg-brutal-green shadow-sm translate-x-1' : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feature 2: Reflection Mode */}
                {mode === 'reflect' && (
                  <div className="my-2">
                    <span className="bg-brutal-pink border-[2px] border-black px-2 py-0.5 font-black text-[10px] uppercase mb-2 inline-block">Key Takeaway</span>
                    <textarea
                      placeholder="How will you apply this today?"
                      value={reflections[b.id] || ""}
                      onChange={(e) => setReflections({ ...reflections, [b.id]: e.target.value })}
                      className="w-full border-[2px] border-black p-2 text-xs font-medium mb-3 h-20 bg-gray-50 focus:bg-white"
                    />
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
                  </div>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t-[2px] border-black/10">
                {!mode ? (
                  <>
                    <BrutalButton color="green" onClick={() => setActiveMode({ ...activeMode, [b.id]: 'quiz' })} className="text-[10px] px-2 py-1">
                      QUIZ (+5)
                    </BrutalButton>
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
                      <BrutalButton color="green" onClick={() => handleActionComplete(b, mode)} className="text-xs">
                        SUBMIT & CLAIM
                      </BrutalButton>
                    ) : (
                      <BrutalButton color="green" onClick={() => handleActionComplete(b, 'deepdive')} className="text-xs">
                        MARK READ (+5)
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