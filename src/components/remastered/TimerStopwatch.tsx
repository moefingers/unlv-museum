"use client";

import { useState, useRef, useCallback } from "react";

type Mode = "stopwatch" | "timer";

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

export function TimerStopwatch() {
  const [mode, setMode] = useState<Mode>("stopwatch");
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const [timerDuration, setTimerDuration] = useState(60000);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);

  const start = useCallback(() => {
    if (running) return;
    setRunning(true);
    startTimeRef.current = Date.now() - elapsed;
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const newElapsed = now - startTimeRef.current;
      if (mode === "timer" && newElapsed >= timerDuration) {
        setElapsed(timerDuration);
        setRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        setElapsed(newElapsed);
      }
    }, 10);
  }, [running, elapsed, mode, timerDuration]);

  const stop = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const reset = useCallback(() => {
    stop();
    setElapsed(0);
    setLaps([]);
  }, [stop]);

  const lap = useCallback(() => {
    if (running) setLaps((prev) => [elapsed, ...prev]);
  }, [running, elapsed]);

  const displayTime =
    mode === "timer" ? Math.max(timerDuration - elapsed, 0) : elapsed;

  const isFinished = mode === "timer" && elapsed >= timerDuration;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
      <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        <button
          onClick={() => {
            reset();
            setMode("stopwatch");
          }}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${mode === "stopwatch" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 dark:text-zinc-400"}`}
        >
          Stopwatch
        </button>
        <button
          onClick={() => {
            reset();
            setMode("timer");
          }}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${mode === "timer" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 dark:text-zinc-400"}`}
        >
          Timer
        </button>
      </div>

      {mode === "timer" && !running && elapsed === 0 && (
        <div className="flex items-center gap-2">
          {[30, 60, 120, 300].map((secs) => (
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

      <div
        className={`font-mono text-5xl font-bold tabular-nums ${isFinished ? "text-red-500 animate-pulse" : ""}`}
      >
        {formatTime(displayTime)}
      </div>

      <div className="flex gap-3">
        {!running ? (
          <button
            onClick={start}
            disabled={isFinished}
            className="rounded-lg bg-green-600 px-5 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {elapsed > 0 ? "Resume" : "Start"}
          </button>
        ) : (
          <button
            onClick={stop}
            className="rounded-lg bg-red-600 px-5 py-2 font-medium text-white transition-colors hover:bg-red-700"
          >
            Stop
          </button>
        )}
        {mode === "stopwatch" && running && (
          <button
            onClick={lap}
            className="rounded-lg bg-zinc-200 px-5 py-2 font-medium transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
          >
            Lap
          </button>
        )}
        <button
          onClick={reset}
          className="rounded-lg bg-zinc-200 px-5 py-2 font-medium transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          Reset
        </button>
      </div>

      {laps.length > 0 && (
        <div className="w-full max-w-xs">
          <h3 className="mb-2 text-sm font-medium text-zinc-500">Laps</h3>
          <div className="space-y-1">
            {laps.map((lapTime, i) => (
              <div
                key={i}
                className="flex justify-between rounded bg-zinc-50 px-3 py-1 text-sm dark:bg-zinc-800"
              >
                <span>Lap {laps.length - i}</span>
                <span className="font-mono">{formatTime(lapTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
