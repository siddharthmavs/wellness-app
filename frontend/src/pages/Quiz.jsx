import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalTag } from "../components/brutal";
import { toast } from "sonner";
import { useAuthStore } from "../store";

const DEPARTMENTS = ["Engineering", "Design", "Marketing", "HR", "Product", "Management", "General"];

export default function Quiz() {
  const { user } = useAuthStore();
  const [dept, setDept] = useState(user?.department || "General");
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);

  const load = async () => {
    setResult(null);
    const { data } = await api.get(`/quizzes?department=${dept}`);
    setQuiz(data);
    setAnswers(Array(data.questions.length).fill(-1));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [dept]);

  const submit = async () => {
    if (answers.some(a => a < 0)) { toast.error("Answer everything"); return; }
    const { data } = await api.post("/quizzes/submit", { department: dept, answers });
    setResult(data);
    toast.success(`🎉 ${data.correct}/${data.total} · +${data.points} pts`);
  };

  const setAns = (i, v) => { const n = [...answers]; n[i] = v; setAnswers(n); };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ rotate: -2, opacity: 0 }} animate={{ rotate: -1, opacity: 1 }}
        className="bg-brutal-pink text-white border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
      >
        <h1 className="font-display font-black text-5xl uppercase leading-none">🧠 WEEKLY QUIZ</h1>
        <p className="text-xs uppercase tracking-widest mt-2">flex that brain, win pts</p>
      </motion.div>

      <div className="flex gap-2 mb-6 flex-wrap" data-testid="quiz-dept-picker">
        {DEPARTMENTS.map((d) => (
          <BrutalTag key={d} active={dept === d} color="cyan" onClick={() => setDept(d)}>{d}</BrutalTag>
        ))}
      </div>

      {quiz && !result && (
        <div className="space-y-4" data-testid="quiz-questions">
          {quiz.questions.map((q, i) => (
            <BrutalCard key={i} color="white" hover={false}>
              <div className="font-display font-black text-lg uppercase mb-3">Q{i + 1}. {q.q}</div>
              <div className="space-y-2">
                {q.options.map((o, j) => (
                  <button
                    key={j}
                    data-testid={`q${i}-opt${j}`}
                    onClick={() => setAns(i, j)}
                    className={`w-full text-left border-[3px] border-black px-3 py-2 font-bold uppercase text-sm ${answers[i] === j ? "bg-brutal-yellow shadow-brutal-sm" : "bg-white"}`}
                  >
                    {String.fromCharCode(65 + j)}. {o}
                  </button>
                ))}
              </div>
            </BrutalCard>
          ))}
          <BrutalButton data-testid="quiz-submit" color="green" size="lg" onClick={submit}>SUBMIT 🚀</BrutalButton>
        </div>
      )}

      {result && (
        <BrutalCard color="yellow" hover={false} data-testid="quiz-result">
          <h2 className="font-display font-black text-4xl uppercase">🎉 {result.correct}/{result.total}</h2>
          <p className="font-bold mt-2">+{result.points} pts earned</p>
          <div className="space-y-2 mt-4">
            {result.results.map((r, i) => (
              <div key={i} className={`border-[3px] border-black p-3 ${r.ok ? "bg-brutal-green" : "bg-brutal-pink text-white"}`}>
                <div className="font-black text-sm uppercase">{r.ok ? "✅" : "❌"} {r.q}</div>
                {!r.ok && <div className="text-xs font-bold mt-1">Correct: {String.fromCharCode(65 + r.correct)}</div>}
              </div>
            ))}
          </div>
          <BrutalButton color="black" onClick={load} className="mt-4">🔄 RETRY</BrutalButton>
        </BrutalCard>
      )}
    </div>
  );
}
