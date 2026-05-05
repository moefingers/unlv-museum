"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type GameState = "pregame" | "countdown" | "active" | "over";

interface LeaderboardEntry {
  id: number;
  playerName: string;
  score: number;
  level: number;
  createdAt: string;
}

const LEVELS = [
  { level: 1, duration: 10, spawnRate: 700, label: "Easy" },
  { level: 2, duration: 12, spawnRate: 500, label: "Medium" },
  { level: 3, duration: 15, spawnRate: 350, label: "Hard" },
  { level: 4, duration: 20, spawnRate: 250, label: "Insane" },
];

const HIT_MESSAGES = [
  "You are whack!",
  "Caught him dipping!",
  "So whacky!",
  "Guac-blocked!",
  "Mole down!",
];
const MISS_MESSAGES = [
  "Guac but no mole!",
  "You missed!",
  "Swing and a miss!",
  "The mole laughs at you!",
];

function randomFrom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function MoleHill({
  active,
  golden,
  onHit,
  onMiss,
}: {
  active: boolean;
  golden: boolean;
  onHit: () => void;
  onMiss: () => void;
}) {
  return (
    <button
      onClick={active ? onHit : onMiss}
      className={`relative flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all duration-150 select-none sm:h-24 sm:w-24 ${
        active
          ? golden
            ? "scale-125 border-yellow-400 bg-yellow-100 shadow-lg shadow-yellow-200 dark:border-yellow-500 dark:bg-yellow-900 dark:shadow-yellow-900"
            : "scale-110 border-green-500 bg-green-100 dark:border-green-400 dark:bg-green-900"
          : "border-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      }`}
      aria-label={active ? "Mole is here! Click to whack!" : "Empty hill"}
    >
      <span className="text-3xl">{active ? (golden ? "⭐" : "🥑") : "⛰️"}</span>
      {golden && active && (
        <span className="absolute -top-1 -right-1 text-xs font-bold text-yellow-600">
          ×3
        </span>
      )}
    </button>
  );
}

export function GwhacAMoleReimagined() {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [gameState, setGameState] = useState<GameState>("pregame");
  const [levelIndex, setLevelIndex] = useState(0);
  const [message, setMessage] = useState({
    type: "neutral" as "good" | "bad" | "neutral",
    text: "Select a difficulty and press Start!",
  });
  const [moles, setMoles] = useState<boolean[]>(Array(9).fill(false));
  const [goldenMole, setGoldenMole] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const moleTimers = useRef<NodeJS.Timeout[]>([]);

  const level = LEVELS[levelIndex]!;

  const clearMoleTimers = useCallback(() => {
    moleTimers.current.forEach(clearTimeout);
    moleTimers.current = [];
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/gwhac-scores");
      if (res.ok) setLeaderboard(await res.json());
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gwhac-scores")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setLeaderboard(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const spawnMole = useCallback((index: number) => {
    const isGolden = Math.random() < 0.1;
    setMoles((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    if (isGolden) setGoldenMole(index);

    const hideDelay = 500 + Math.random() * 800;
    const timer = setTimeout(() => {
      setMoles((prev) => {
        const next = [...prev];
        next[index] = false;
        return next;
      });
      setGoldenMole((g) => (g === index ? null : g));
    }, hideDelay);
    moleTimers.current.push(timer);
  }, []);

  const startGame = () => {
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setCountdown(3);
    setGameState("countdown");
    setMoles(Array(9).fill(false));
    setGoldenMole(null);
    setSubmitted(false);
    clearMoleTimers();
  };

  useEffect(() => {
    if (gameState !== "countdown") return;
    if (countdown <= 0) return;
    const timer = setTimeout(() => {
      const next = countdown - 1;
      setCountdown(next);
      if (next <= 0) {
        setGameState("active");
        setTimeLeft(level.duration);
        setMessage({ type: "good", text: "Go whacky on them!" });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, gameState, level.duration]);

  useEffect(() => {
    if (gameState !== "active") return;
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => {
      const next = timeLeft - 1;
      setTimeLeft(next);
      if (next <= 0) {
        setGameState("over");
        setMessage({ type: "neutral", text: `Game Over!` });
        clearMoleTimers();
        setMoles(Array(9).fill(false));
        setGoldenMole(null);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, gameState, clearMoleTimers]);

  useEffect(() => {
    if (gameState !== "active") return;
    const interval = setInterval(() => {
      const index = Math.floor(Math.random() * 9);
      spawnMole(index);
    }, level.spawnRate);
    return () => clearInterval(interval);
  }, [gameState, spawnMole, level.spawnRate]);

  const handleHit = (index: number) => {
    const isGolden = goldenMole === index;
    const points = isGolden ? 3 : 1;
    const comboBonus = Math.floor(combo / 5);

    setMoles((prev) => {
      const next = [...prev];
      next[index] = false;
      return next;
    });
    if (isGolden) setGoldenMole(null);

    setScore((s) => s + points + comboBonus);
    setCombo((c) => {
      const newCombo = c + 1;
      setBestCombo((b) => Math.max(b, newCombo));
      return newCombo;
    });
    setMessage({
      type: "good",
      text: `${randomFrom(HIT_MESSAGES)}${comboBonus > 0 ? ` (+${comboBonus} combo)` : ""}${isGolden ? " GOLDEN!" : ""}`,
    });
  };

  const handleMiss = () => {
    setScore((s) => s - 1);
    setCombo(0);
    setMessage({ type: "bad", text: randomFrom(MISS_MESSAGES) });
  };

  const submitScore = async () => {
    if (!playerName.trim() || submitted) return;
    try {
      await fetch("/api/gwhac-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: playerName.trim(),
          score,
          level: level.level,
        }),
      });
      setSubmitted(true);
      fetchLeaderboard();
    } catch {
      /* offline */
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-3xl font-bold">
        G<strong className="text-green-600 dark:text-green-400">whac</strong>
        -A-Mole
        <span className="ml-2 text-sm font-normal text-amber-500">
          Reimagined
        </span>
      </h2>

      {gameState === "pregame" && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {LEVELS.map((l, i) => (
              <button
                key={l.level}
                onClick={() => setLevelIndex(i)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${levelIndex === i ? "bg-green-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            onClick={startGame}
            className="rounded-lg bg-green-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-green-700"
          >
            Start
          </button>
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="text-sm text-zinc-500 hover:underline"
          >
            {showLeaderboard ? "Hide" : "Show"} Leaderboard
          </button>
        </div>
      )}

      {gameState === "countdown" && (
        <p className="text-4xl font-bold">{countdown}</p>
      )}

      {gameState === "active" && (
        <>
          <div className="flex gap-6 text-lg font-medium">
            <span>Score: {score}</span>
            <span>Combo: {combo}×</span>
            <span>Time: {timeLeft}s</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {moles.map((active, i) => (
              <MoleHill
                key={i}
                active={active}
                golden={goldenMole === i}
                onHit={() => handleHit(i)}
                onMiss={handleMiss}
              />
            ))}
          </div>
        </>
      )}

      {gameState === "over" && (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-lg border border-zinc-200 p-6 text-center dark:border-zinc-700">
            <p className="text-4xl font-bold">{score}</p>
            <p className="text-sm text-zinc-500">
              {level.label} · Best combo: {bestCombo}×
            </p>
          </div>

          {!submitted ? (
            <div className="flex gap-2">
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your name"
                maxLength={50}
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              />
              <button
                onClick={submitScore}
                disabled={!playerName.trim()}
                className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Submit Score
              </button>
            </div>
          ) : (
            <p className="text-sm text-green-600">Score submitted!</p>
          )}

          <button
            onClick={startGame}
            className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white"
          >
            Play Again
          </button>
        </div>
      )}

      <p
        className={`text-sm font-medium ${
          message.type === "good"
            ? "text-green-600 dark:text-green-400"
            : message.type === "bad"
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {message.text}
      </p>

      {(showLeaderboard || gameState === "over") && leaderboard.length > 0 && (
        <div className="w-full max-w-sm rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <h3 className="mb-2 font-semibold">Top 10 Leaderboard</h3>
          <div className="space-y-1">
            {leaderboard.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  <span className="mr-2 text-zinc-400">#{i + 1}</span>
                  {entry.playerName}
                </span>
                <span className="font-mono font-bold">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
