"use client";

import { useState, useRef, useCallback } from "react";

type Mode = "stopwatch" | "timer" | "pomodoro";

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  if (hours > 0)
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

const POMODORO = {
  work: 25 * 60 * 1000,
  short: 5 * 60 * 1000,
  long: 15 * 60 * 1000,
};

export function TimerStopwatchReimagined() {
  const [mode, setMode] = useState<Mode>("stopwatch");
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const [timerDuration, setTimerDuration] = useState(60000);
  const [pomodoroPhase, setPomodoroPhase] = useState<"work" | "short" | "long">(
    "work",
  );
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);

  const currentDuration =
    mode === "pomodoro" ? POMODORO[pomodoroPhase] : timerDuration;

  const start = useCallback(() => {
    if (running) return;
    setRunning(true);
    startTimeRef.current = Date.now() - elapsed;
    intervalRef.current = setInterval(() => {
      const newElapsed = Date.now() - startTimeRef.current;
      if (
        (mode === "timer" || mode === "pomodoro") &&
        newElapsed >= currentDuration
      ) {
        setElapsed(currentDuration);
        setRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (mode === "pomodoro") {
          if (pomodoroPhase === "work") {
            const newCount = pomodoroCount + 1;
            setPomodoroCount(newCount);
            setPomodoroPhase(newCount % 4 === 0 ? "long" : "short");
          } else {
            setPomodoroPhase("work");
          }
          setElapsed(0);
        }
      } else {
        setElapsed(newElapsed);
      }
    }, 10);
  }, [running, elapsed, mode, currentDuration, pomodoroPhase, pomodoroCount]);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const reset = useCallback(() => {
    stop();
    setElapsed(0);
    setLaps([]);
    if (mode === "pomodoro") {
      setPomodoroPhase("work");
      setPomodoroCount(0);
    }
  }, [stop, mode]);

  const lap = () => {
    if (running) setLaps((prev) => [elapsed, ...prev]);
  };

  const displayTime =
    mode === "stopwatch" ? elapsed : Math.max(currentDuration - elapsed, 0);
  const isFinished =
    (mode === "timer" || mode === "pomodoro") && elapsed >= currentDuration;
  const progress =
    mode !== "stopwatch" ? Math.min(elapsed / currentDuration, 1) : 0;

  const circumference = 2 * Math.PI * 90;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
      <h2 className="text-2xl font-bold">
        Timer & Stopwatch
        <span className="ml-2 text-sm font-normal text-amber-500">
          Reimagined
        </span>
      </h2>

      <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {(["stopwatch", "timer", "pomodoro"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              reset();
              setMode(m);
            }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize ${mode === m ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 dark:text-zinc-400"}`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "pomodoro" && (
        <div className="flex items-center gap-4 text-sm">
          <span
            className={`rounded-full px-3 py-1 ${pomodoroPhase === "work" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"}`}
          >
            {pomodoroPhase === "work"
              ? "Focus"
              : pomodoroPhase === "short"
                ? "Short Break"
                : "Long Break"}
          </span>
          <span className="text-zinc-400">Session #{pomodoroCount + 1}</span>
        </div>
      )}

      {mode !== "stopwatch" ? (
        <div className="relative flex items-center justify-center">
          <svg width="200" height="200" className="-rotate-90">
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-zinc-200 dark:text-zinc-700"
            />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className={
                isFinished
                  ? "text-red-500 animate-pulse"
                  : pomodoroPhase === "work"
                    ? "text-red-500"
                    : "text-green-500"
              }
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
            />
          </svg>
          <span
            className={`absolute font-mono text-3xl font-bold tabular-nums ${isFinished ? "text-red-500" : ""}`}
          >
            {formatTime(displayTime)}
          </span>
        </div>
      ) : (
        <div className={`font-mono text-5xl font-bold tabular-nums`}>
          {formatTime(displayTime)}
        </div>
      )}

      {mode === "timer" && !running && elapsed === 0 && (
        <div className="flex gap-2">
          {[30, 60, 120, 300, 600].map((secs) => (
            <button
              key={secs}
              onClick={() => setTimerDuration(secs * 1000)}
              className={`rounded-md px-3 py-1 text-sm ${timerDuration === secs * 1000 ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
            >
              {secs >= 60 ? `${secs / 60}m` : `${secs}s`}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {!running ? (
          <button
            onClick={start}
            disabled={isFinished && mode === "timer"}
            className="rounded-lg bg-green-600 px-6 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {elapsed > 0 ? "Resume" : "Start"}
          </button>
        ) : (
          <button
            onClick={stop}
            className="rounded-lg bg-red-600 px-6 py-2.5 font-medium text-white"
          >
            Stop
          </button>
        )}
        {mode === "stopwatch" && running && (
          <button
            onClick={lap}
            className="rounded-lg bg-zinc-200 px-5 py-2.5 font-medium dark:bg-zinc-700"
          >
            Lap
          </button>
        )}
        <button
          onClick={reset}
          className="rounded-lg bg-zinc-200 px-5 py-2.5 font-medium dark:bg-zinc-700"
        >
          Reset
        </button>
      </div>

      {laps.length > 0 && (
        <div className="w-full max-w-xs">
          <h3 className="mb-2 text-sm font-medium text-zinc-500">Laps</h3>
          {laps.map((lapTime, i) => {
            const diff = i > 0 ? lapTime - (laps[i + 1] ?? 0) : lapTime;
            return (
              <div
                key={i}
                className="flex justify-between rounded bg-zinc-50 px-3 py-1 text-sm dark:bg-zinc-800"
              >
                <span>Lap {laps.length - i}</span>
                <span className="font-mono">{formatTime(lapTime)}</span>
                <span className="font-mono text-zinc-400">
                  +{formatTime(diff)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
