"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type GameState = "pregame" | "countdown" | "active" | "over";

const HIT_MESSAGES = ["You are whack!", "Caught him dipping!", "So whacky!"];
const MISS_MESSAGES = [
  "Guac but no mole!",
  "You missed!",
  "There's no mole there!",
];

function randomFrom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function MoleHill({
  active,
  onHit,
  onMiss,
}: {
  active: boolean;
  onHit: () => void;
  onMiss: () => void;
}) {
  return (
    <button
      onClick={active ? onHit : onMiss}
      className={`flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all duration-150 select-none sm:h-24 sm:w-24 ${
        active
          ? "scale-110 border-green-500 bg-green-100 dark:border-green-400 dark:bg-green-900"
          : "border-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      }`}
      aria-label={active ? "Mole is here! Click to whack!" : "Empty hill"}
    >
      <span className="text-3xl">{active ? "🥑" : "⛰️"}</span>
    </button>
  );
}

export function GwhacAMole() {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [gameState, setGameState] = useState<GameState>("pregame");
  const [message, setMessage] = useState({
    type: "neutral" as "good" | "bad" | "neutral",
    text: "Press Start to begin!",
  });
  const [moles, setMoles] = useState<boolean[]>(Array(9).fill(false));
  const moleTimers = useRef<NodeJS.Timeout[]>([]);

  const clearMoleTimers = useCallback(() => {
    moleTimers.current.forEach(clearTimeout);
    moleTimers.current = [];
  }, []);

  const spawnMole = useCallback((index: number) => {
    setMoles((prev) => {
      const next = [...prev];
      next[index] = true;
      return next;
    });
    const hideDelay = 700 + Math.random() * 1000;
    const timer = setTimeout(() => {
      setMoles((prev) => {
        const next = [...prev];
        next[index] = false;
        return next;
      });
    }, hideDelay);
    moleTimers.current.push(timer);
  }, []);

  const startGame = () => {
    setScore(0);
    setCountdown(3);
    setGameState("countdown");
    setMoles(Array(9).fill(false));
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
        setTimeLeft(10);
        setMessage({ type: "good", text: "Go whacky on them!" });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, gameState]);

  useEffect(() => {
    if (gameState !== "active") return;
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => {
      const next = timeLeft - 1;
      setTimeLeft(next);
      if (next <= 0) {
        setGameState("over");
        setMessage({
          type: "neutral",
          text: `Game Over! Final Score: ${score}`,
        });
        clearMoleTimers();
        setMoles(Array(9).fill(false));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, gameState, score, clearMoleTimers]);

  useEffect(() => {
    if (gameState !== "active") return;
    const interval = setInterval(() => {
      const index = Math.floor(Math.random() * 9);
      spawnMole(index);
    }, 600);
    return () => clearInterval(interval);
  }, [gameState, spawnMole]);

  const handleHit = (index: number) => {
    setMoles((prev) => {
      const next = [...prev];
      next[index] = false;
      return next;
    });
    setScore((s) => s + 1);
    setMessage({ type: "good", text: randomFrom(HIT_MESSAGES) });
  };

  const handleMiss = () => {
    setScore((s) => s - 1);
    setMessage({ type: "bad", text: randomFrom(MISS_MESSAGES) });
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
      <h2 className="text-3xl font-bold">
        G<strong className="text-green-600 dark:text-green-400">whac</strong>
        -A-Mole
      </h2>

      {gameState === "countdown" && (
        <p className="text-2xl font-bold">{countdown}</p>
      )}

      {gameState === "pregame" && (
        <button
          onClick={startGame}
          className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700"
        >
          Start
        </button>
      )}

      {gameState === "active" && (
        <>
          <div className="flex gap-8 text-lg font-medium">
            <span>Score: {score}</span>
            <span>Time: {timeLeft}s</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {moles.map((active, i) => (
              <MoleHill
                key={i}
                active={active}
                onHit={() => handleHit(i)}
                onMiss={handleMiss}
              />
            ))}
          </div>
        </>
      )}

      {gameState === "over" && (
        <button
          onClick={startGame}
          className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700"
        >
          Restart
        </button>
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
    </div>
  );
}
