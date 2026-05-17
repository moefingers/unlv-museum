"use client";

import { type ReactNode } from "react";

type ViewMode = "original" | "enhanced" | "reimagined";

const VIEW_INDEX: Record<ViewMode, number> = {
  original: 0,
  enhanced: 1,
  reimagined: 2,
};

export function SlidingView({
  mode,
  children,
}: {
  mode: ViewMode;
  children: [ReactNode, ReactNode, ReactNode];
}) {
  const index = VIEW_INDEX[mode];

  return (
    <div className="relative w-full flex-1 overflow-hidden">
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {children.map((child, i) => (
          <div key={i} className="flex w-full shrink-0 flex-col">
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ModeToggle({
  mode,
  onChange,
  available,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Tiers that exist for this project. Missing tiers render disabled. */
  available: Record<ViewMode, boolean>;
}) {
  const modes: ViewMode[] = ["original", "enhanced", "reimagined"];

  return (
    <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      {modes.map((m) => {
        const isAvailable = available[m];
        return (
          <button
            key={m}
            onClick={() => isAvailable && onChange(m)}
            disabled={!isAvailable}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              mode === m
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : isAvailable
                  ? "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  : "cursor-not-allowed text-zinc-300 dark:text-zinc-600"
            }`}
            aria-disabled={!isAvailable}
            title={isAvailable ? undefined : `${m} not available`}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}
