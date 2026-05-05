import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { BrutalButton, BrutalCard, BrutalTag } from "../components/brutal";
import { toast } from "sonner";

const GAMES = [
  { id: "bubble_pop", name: "🫧 Bubble Pop", desc: "Pop bubbles. Pure dopamine.", color: "cyan", unlock: 0 },
  { id: "memory_match", name: "🃏 Memory Match", desc: "Match emoji pairs.", color: "yellow", unlock: 0 },
  { id: "word_scramble", name: "🔤 Word Scramble", desc: "Unscramble wellness words.", color: "pink", unlock: 0 },
  { id: "zen_doodle", name: "🎨 Zen Doodle", desc: "Free draw. Calm mode.", color: "green", unlock: 0 },
];

export default function Games() {
  const [active, setActive] = useState(null);
  const [scores, setScores] = useState([]);

  useEffect(() => { if (!active) loadScores(); }, [active]);
  const loadScores = async () => {
    const { data } = await api.get("/games/leaderboard");
    setScores(data);
  };

  if (active) return <GameShell game={active} onExit={() => setActive(null)} />;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <motion.div
        initial={{ rotate: 2, opacity: 0 }} animate={{ rotate: 1, opacity: 1 }}
        className="bg-brutal-yellow border-[4px] border-black shadow-brutal-lg p-6 mb-6 inline-block"
      >
        <h1 className="font-display font-black text-5xl uppercase leading-none">🎮 MINI GAMES</h1>
        <p className="text-xs uppercase tracking-widest mt-2">stress relief, mini-style</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-10" data-testid="games-grid">
        {GAMES.map((g, i) => (
          <motion.button
            key={g.id}
            data-testid={`game-${g.id}`}
            onClick={() => setActive(g.id)}
            whileHover={{ scale: 1.04, rotate: i % 2 ? -2 : 2 }}
            whileTap={{ scale: 0.95, x: 4, y: 4, boxShadow: "0px 0px 0px 0px rgba(0,0,0,1)" }}
            className={`bg-brutal-${g.color} border-[4px] border-black shadow-brutal-lg p-5 rounded-[4px] text-left`}
          >
            <div className="font-display font-black text-2xl uppercase">{g.name}</div>
            <div className="text-xs font-bold mt-2">{g.desc}</div>
            <div className="mt-3 bg-black text-white inline-block px-2 py-0.5 font-black text-xs">PLAY →</div>
          </motion.button>
        ))}
      </div>

      <BrutalCard color="white" hover={false}>
        <h2 className="font-display font-black text-2xl uppercase mb-3">🏆 Game Champs (all games)</h2>
        <div className="space-y-2">
          {scores.map((s, i) => (
            <div key={i} className="flex items-center gap-3 border-[3px] border-black p-3">
              <div className="font-display font-black text-2xl w-10 text-center">{["🥇","🥈","🥉"][i] || `#${i+1}`}</div>
              <img src={s.user_avatar} alt="" className="w-10 h-10 border-[2px] border-black" />
              <div className="flex-1 font-black uppercase">{s.user_name}</div>
              <div className="font-display font-black text-2xl">{s.best}</div>
            </div>
          ))}
          {scores.length === 0 && <div className="text-sm font-bold uppercase">No scores yet. Be a legend.</div>}
        </div>
      </BrutalCard>
    </div>
  );
}

const GameShell = ({ game, onExit }) => {
  const submit = async (score) => {
    await api.post("/games/scores", { game, score });
    toast.success(`🏆 ${score} pts! Up to +20 wellness pts awarded.`);
  };
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <BrutalButton color="white" onClick={onExit} className="mb-4">← BACK</BrutalButton>
      {game === "bubble_pop" && <BubblePop onScore={submit} />}
      {game === "memory_match" && <MemoryMatch onScore={submit} />}
      {game === "word_scramble" && <WordScramble onScore={submit} />}
      {game === "zen_doodle" && <ZenDoodle />}
    </div>
  );
};

// ----- Bubble Pop -----
const BubblePop = ({ onScore }) => {
  const [bubbles, setBubbles] = useState([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(30);
  const [running, setRunning] = useState(false);
  const COLORS = ["#FFE600", "#00E5FF", "#FF4D6D", "#00C853"];

  useEffect(() => {
    if (!running) return;
    const i1 = setInterval(() => {
      setBubbles(b => [...b, {
        id: Math.random(),
        x: Math.random() * 80 + 5,
        y: Math.random() * 60 + 10,
        c: COLORS[Math.floor(Math.random() * 4)],
        s: Math.random() * 30 + 40,
      }].slice(-12));
    }, 700);
    const i2 = setInterval(() => setTime(t => Math.max(0, t - 1)), 1000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, [running]);

  useEffect(() => {
    if (running && time === 0) {
      setRunning(false);
      onScore(score);
    }
  }, [time, running, score, onScore]);

  const pop = (id) => {
    setBubbles(b => b.filter(x => x.id !== id));
    setScore(s => s + 5);
  };

  const start = () => { setScore(0); setTime(30); setBubbles([]); setRunning(true); };

  return (
    <div data-testid="bubble-pop">
      <h2 className="font-display font-black text-3xl uppercase mb-3">🫧 Bubble Pop</h2>
      <div className="flex gap-3 items-center mb-3">
        <span className="bg-brutal-yellow border-[3px] border-black px-3 py-1 font-black text-sm">⏰ {time}s</span>
        <span className="bg-brutal-pink text-white border-[3px] border-black px-3 py-1 font-black text-sm">⚡ {score}</span>
        <BrutalButton color="green" size="sm" onClick={start}>{running ? "RESTART" : "START"}</BrutalButton>
      </div>
      <div className="relative w-full h-[60vh] border-[4px] border-black bg-white shadow-brutal-lg overflow-hidden">
        <AnimatePresence>
          {bubbles.map(b => (
            <motion.button
              key={b.id}
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => pop(b.id)}
              data-testid="bubble"
              className="absolute border-[3px] border-black rounded-full"
              style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.s, height: b.s, background: b.c }}
            />
          ))}
        </AnimatePresence>
        {!running && time === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="bg-brutal-yellow border-[6px] border-black p-6 -rotate-2 text-center">
              <div className="font-display font-black text-3xl">GAME OVER</div>
              <div className="font-black mt-2">Score: {score}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ----- Memory Match -----
const EMOJIS = ["🔥","💧","🧘","👀","🧠","🌱","💪","🎯"];
const MemoryMatch = ({ onScore }) => {
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);

  const setup = () => {
    const deck = [...EMOJIS, ...EMOJIS].sort(() => Math.random() - 0.5).map((e, i) => ({ id: i, emoji: e }));
    setCards(deck); setFlipped([]); setMatched([]); setMoves(0);
  };

  useEffect(() => { setup(); }, []);

  const click = (idx) => {
    if (flipped.length === 2 || flipped.includes(idx) || matched.includes(idx)) return;
    const next = [...flipped, idx];
    setFlipped(next);
    if (next.length === 2) {
      setMoves(m => m + 1);
      setTimeout(() => {
        if (cards[next[0]].emoji === cards[next[1]].emoji) {
          setMatched(m => [...m, ...next]);
        }
        setFlipped([]);
      }, 700);
    }
  };

  const won = matched.length === cards.length && cards.length > 0;
  useEffect(() => {
    if (won) {
      const score = Math.max(20, 100 - moves * 5);
      onScore(score);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  return (
    <div data-testid="memory-match">
      <h2 className="font-display font-black text-3xl uppercase mb-3">🃏 Memory Match</h2>
      <div className="flex gap-3 mb-3 items-center">
        <span className="bg-brutal-cyan border-[3px] border-black px-3 py-1 font-black text-sm">Moves: {moves}</span>
        <BrutalButton color="green" size="sm" onClick={setup}>🔄 NEW GAME</BrutalButton>
      </div>
      <div className="grid grid-cols-4 gap-3" data-testid="memory-grid">
        {cards.map((c, i) => {
          const isOpen = flipped.includes(i) || matched.includes(i);
          return (
            <motion.button
              key={c.id}
              data-testid={`card-${i}`}
              onClick={() => click(i)}
              whileTap={{ scale: 0.95 }}
              className={`aspect-square border-[4px] border-black shadow-brutal text-5xl font-black ${isOpen ? "bg-brutal-yellow" : "bg-black text-white"}`}
            >
              {isOpen ? c.emoji : "?"}
            </motion.button>
          );
        })}
      </div>
      {won && (
        <div className="mt-4 bg-brutal-green border-[4px] border-black p-4 -rotate-1 text-center">
          <div className="font-display font-black text-2xl">🎉 YOU WON IN {moves} MOVES</div>
        </div>
      )}
    </div>
  );
};

// ----- Word Scramble -----
const WORDS = [
  { w: "hydrate", h: "drinking water" },
  { w: "wellness", h: "the state of being well" },
  { w: "breathe", h: "in / out" },
  { w: "stretch", h: "extend body" },
  { w: "mindful", h: "being present" },
  { w: "balance", h: "stable equilibrium" },
];
const scramble = (s) => s.split("").sort(() => Math.random() - 0.5).join("");

const WordScramble = ({ onScore }) => {
  const [word, setWord] = useState(WORDS[0]);
  const [scrambled, setScrambled] = useState(scramble(WORDS[0].w));
  const [guess, setGuess] = useState("");
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(0);

  const next = () => {
    const w = WORDS[Math.floor(Math.random() * WORDS.length)];
    setWord(w);
    setScrambled(scramble(w.w));
    setGuess("");
  };

  const check = () => {
    if (guess.trim().toLowerCase() === word.w) {
      const s = score + 20;
      setScore(s);
      const d = done + 1;
      setDone(d);
      if (d >= 5) {
        toast.success(`🎉 5 done! Score: ${s}`);
        onScore(s);
        setDone(0);
        setScore(0);
      }
      next();
    } else {
      toast.error("Nope, try again");
    }
  };

  return (
    <div data-testid="word-scramble">
      <h2 className="font-display font-black text-3xl uppercase mb-3">🔤 Word Scramble</h2>
      <div className="flex gap-3 mb-3 items-center">
        <span className="bg-brutal-pink text-white border-[3px] border-black px-3 py-1 font-black text-sm">⚡ {score}</span>
        <span className="bg-brutal-cyan border-[3px] border-black px-3 py-1 font-black text-sm">{done}/5</span>
      </div>
      <BrutalCard color="yellow" hover={false}>
        <div className="text-center mb-4">
          <div className="font-display font-black text-6xl uppercase tracking-widest mb-2">{scrambled}</div>
          <div className="text-xs font-bold uppercase">Hint: {word.h}</div>
        </div>
        <div className="flex gap-2">
          <input
            data-testid="scramble-guess"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") check(); }}
            placeholder="Your guess"
            className="flex-1 border-[3px] border-black px-3 py-2 font-bold uppercase"
          />
          <BrutalButton data-testid="scramble-check" color="green" onClick={check}>CHECK</BrutalButton>
          <BrutalButton color="white" onClick={next}>SKIP</BrutalButton>
        </div>
      </BrutalCard>
    </div>
  );
};

// ----- Zen Doodle -----
const ZenDoodle = () => {
  const ref = useRef();
  const [color, setColor] = useState("#000000");
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = c.offsetWidth;
    c.height = c.offsetHeight;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);

  const start = (e) => { setDrawing(true); draw(e); };
  const stop = () => setDrawing(false);
  const draw = (e) => {
    if (!drawing && e.type !== "click" && e.type !== "mousedown") return;
    const c = ref.current;
    const r = c.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - r.left;
    const y = (e.clientY || e.touches?.[0]?.clientY || 0) - r.top;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  };

  const clear = () => {
    const c = ref.current;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
  };

  const COLORS = ["#000000", "#FFE600", "#00E5FF", "#FF4D6D", "#00C853"];
  return (
    <div data-testid="zen-doodle">
      <h2 className="font-display font-black text-3xl uppercase mb-3">🎨 Zen Doodle</h2>
      <div className="flex gap-2 mb-3 flex-wrap">
        {COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} style={{ background: c }} className={`w-9 h-9 border-[3px] border-black ${color === c ? "shadow-brutal-sm" : ""}`} />
        ))}
        <BrutalButton color="white" size="sm" onClick={clear}>🧼 CLEAR</BrutalButton>
      </div>
      <canvas
        ref={ref}
        onMouseDown={start}
        onMouseUp={stop}
        onMouseLeave={stop}
        onMouseMove={draw}
        onTouchStart={start}
        onTouchEnd={stop}
        onTouchMove={draw}
        className="w-full h-[60vh] border-[4px] border-black bg-white shadow-brutal-lg cursor-crosshair touch-none"
        data-testid="doodle-canvas"
      />
    </div>
  );
};
