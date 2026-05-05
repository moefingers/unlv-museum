"use client";

import { type ReactNode } from "react";

type ViewMode = "original" | "remastered" | "reimagined";

const VIEW_INDEX: Record<ViewMode, number> = {
  original: 0,
  remastered: 1,
  reimagined: 2,
};

const TRANSLATE: Record<number, string> = {
  0: "translate-x-0",
  1: "-translate-x-1/3",
  2: "-translate-x-2/3",
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
    <div className="w-full overflow-hidden">
      <div
        className={`flex w-[300%] ${TRANSLATE[index]} transition-transform duration-300 ease-out`}
      >
        {children.map((child, i) => (
          <div key={i} className="w-1/3 min-w-0">
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
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const modes: ViewMode[] = ["original", "remastered", "reimagined"];

  return (
    <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      {modes.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
            mode === m
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
