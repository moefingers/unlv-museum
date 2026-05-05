"use client";

import { useState } from "react";

type Exercise =
  | "target"
  | "bubbling"
  | "capturing"
  | "preventDefault"
  | "stopPropagation";

const EXERCISES: { id: Exercise; label: string }[] = [
  { id: "target", label: "Event Target" },
  { id: "bubbling", label: "Bubbling" },
  { id: "capturing", label: "Capturing" },
  { id: "preventDefault", label: "Prevent Default" },
  { id: "stopPropagation", label: "Stop Propagation" },
];

function TargetDemo() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Click different elements to see event.target vs event.currentTarget
      </p>
      <div
        onClick={(e) =>
          setLog((l) => [
            `currentTarget: ${(e.currentTarget as HTMLElement).dataset.name}, target: ${(e.target as HTMLElement).dataset.name}`,
            ...l.slice(0, 9),
          ])
        }
        data-name="outer-div"
        className="cursor-pointer rounded-lg border-2 border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950"
      >
        <p
          data-name="outer-div"
          className="mb-2 font-mono text-xs text-blue-600 dark:text-blue-400"
        >
          Outer div
        </p>
        <div
          data-name="inner-div"
          className="rounded border-2 border-green-300 bg-green-50 p-3 dark:border-green-700 dark:bg-green-950"
        >
          <p
            data-name="inner-div"
            className="font-mono text-xs text-green-600 dark:text-green-400"
          >
            Inner div
          </p>
          <button
            data-name="button"
            className="mt-2 rounded bg-purple-500 px-3 py-1 text-sm text-white"
          >
            Button
          </button>
        </div>
      </div>
      <Log entries={log} />
    </div>
  );
}

function BubblingDemo() {
  const [log, setLog] = useState<string[]>([]);
  const addLog = (msg: string) => setLog((l) => [msg, ...l.slice(0, 9)]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Click the inner element — watch the event bubble up through parents
      </p>
      <div
        onClick={() => addLog("🔴 Grandparent clicked (bubbled)")}
        className="cursor-pointer rounded-lg border-2 border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950"
      >
        <p className="font-mono text-xs">Grandparent</p>
        <div
          onClick={() => addLog("🟡 Parent clicked (bubbled)")}
          className="mt-2 rounded border-2 border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-950"
        >
          <p className="font-mono text-xs">Parent</p>
          <button
            onClick={() => addLog("🟢 Child clicked (origin)")}
            className="mt-2 rounded bg-green-500 px-3 py-1 text-sm text-white"
          >
            Click Me
          </button>
        </div>
      </div>
      <Log entries={log} />
    </div>
  );
}

function CapturingDemo() {
  const [log, setLog] = useState<string[]>([]);
  const addLog = (msg: string) => setLog((l) => [msg, ...l.slice(0, 9)]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Capturing phase fires from top down, then bubbling goes back up
      </p>
      <div
        onClickCapture={() => addLog("1️⃣ Outer CAPTURE")}
        onClick={() => addLog("4️⃣ Outer BUBBLE")}
        className="cursor-pointer rounded-lg border-2 border-indigo-300 bg-indigo-50 p-4 dark:border-indigo-700 dark:bg-indigo-950"
      >
        <p className="font-mono text-xs">Outer</p>
        <div
          onClickCapture={() => addLog("2️⃣ Inner CAPTURE")}
          onClick={() => addLog("3️⃣ Inner BUBBLE")}
          className="mt-2 rounded border-2 border-pink-300 bg-pink-50 p-3 dark:border-pink-700 dark:bg-pink-950"
        >
          <button className="mt-2 rounded bg-indigo-500 px-3 py-1 text-sm text-white">
            Click Me
          </button>
        </div>
      </div>
      <Log entries={log} />
    </div>
  );
}

function PreventDefaultDemo() {
  const [log, setLog] = useState<string[]>([]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        The link and form below have their default behavior prevented
      </p>
      <a
        href="https://example.com"
        onClick={(e) => {
          e.preventDefault();
          setLog((l) => [
            "Link click prevented — no navigation",
            ...l.slice(0, 9),
          ]);
        }}
        className="text-blue-600 underline dark:text-blue-400"
      >
        Click this link (prevented)
      </a>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLog((l) => [
            "Form submit prevented — no page reload",
            ...l.slice(0, 9),
          ]);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          placeholder="Type something"
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Submit
        </button>
      </form>
      <Log entries={log} />
    </div>
  );
}

function StopPropagationDemo() {
  const [log, setLog] = useState<string[]>([]);
  const addLog = (msg: string) => setLog((l) => [msg, ...l.slice(0, 9)]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        The inner button stops propagation — the parent never receives the event
      </p>
      <div
        onClick={() => addLog("🔴 Parent received event")}
        className="cursor-pointer rounded-lg border-2 border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950"
      >
        <p className="font-mono text-xs">Parent (listening)</p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              addLog("🟢 Button clicked — propagation STOPPED");
            }}
            className="rounded bg-green-500 px-3 py-1 text-sm text-white"
          >
            Stop Propagation
          </button>
          <button
            onClick={() => addLog("🟡 Button clicked — propagation ALLOWED")}
            className="rounded bg-yellow-500 px-3 py-1 text-sm text-white"
          >
            Allow Propagation
          </button>
        </div>
      </div>
      <Log entries={log} />
    </div>
  );
}

function Log({ entries }: { entries: string[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="rounded bg-zinc-50 p-3 dark:bg-zinc-800">
      <p className="mb-1 text-xs font-medium text-zinc-500">Event Log</p>
      {entries.map((entry, i) => (
        <p key={i} className="font-mono text-xs">
          {entry}
        </p>
      ))}
    </div>
  );
}

export function JsDomEvents() {
  const [exercise, setExercise] = useState<Exercise>("target");
  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <div className="mb-6 flex flex-wrap gap-1">
        {EXERCISES.map((ex) => (
          <button
            key={ex.id}
            onClick={() => setExercise(ex.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${exercise === ex.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {exercise === "target" && <TargetDemo />}
        {exercise === "bubbling" && <BubblingDemo />}
        {exercise === "capturing" && <CapturingDemo />}
        {exercise === "preventDefault" && <PreventDefaultDemo />}
        {exercise === "stopPropagation" && <StopPropagationDemo />}
      </div>
    </div>
  );
}
