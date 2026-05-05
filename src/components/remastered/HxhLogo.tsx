"use client";

import { useState, useEffect } from "react";

export function HxhLogo() {
  const [animating, setAnimating] = useState(true);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!animating) return;
    const timer = setInterval(() => {
      setStep((s) => (s + 1) % 4);
    }, 800);
    return () => clearInterval(timer);
  }, [animating]);

  const letters = "HUNTER×HUNTER".split("");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 p-6">
      <div className="relative">
        <div className="flex gap-1">
          {letters.map((letter, i) => (
            <span
              key={i}
              className="inline-block text-4xl font-black tracking-wider transition-all duration-500 sm:text-6xl"
              style={{
                color:
                  step === 0
                    ? "#ef4444"
                    : step === 1
                      ? "#22c55e"
                      : step === 2
                        ? "#3b82f6"
                        : "#eab308",
                transform: `translateY(${Math.sin((i + step) * 0.8) * 8}px) rotate(${Math.sin((i + step) * 0.5) * 3}deg)`,
                opacity: 0.7 + Math.sin((i + step) * 0.6) * 0.3,
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        <div
          className="absolute inset-0 rounded-lg transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle, ${step % 2 === 0 ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)"} 0%, transparent 70%)`,
          }}
        />
      </div>

      <button
        onClick={() => setAnimating(!animating)}
        className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {animating ? "Pause" : "Play"}
      </button>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Animated logo recreation inspired by the anime series
      </p>
    </div>
  );
}
