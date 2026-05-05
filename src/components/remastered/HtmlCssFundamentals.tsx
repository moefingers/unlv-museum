"use client";

import { useState } from "react";

type Exercise =
  | "hacker-times"
  | "responsive-boxes"
  | "bird-songs"
  | "animations"
  | "form";

const EXERCISES: { id: Exercise; label: string }[] = [
  { id: "hacker-times", label: "Hacker Times" },
  { id: "responsive-boxes", label: "Responsive Boxes" },
  { id: "bird-songs", label: "Bird Songs" },
  { id: "animations", label: "Animations" },
  { id: "form", label: "Improved Form" },
];

function HackerTimes() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b-4 border-zinc-900 pb-2 dark:border-zinc-100">
        <h1 className="text-center font-serif text-4xl font-bold uppercase tracking-wider">
          The Hacker Times
        </h1>
        <p className="text-center text-sm text-zinc-500">
          All the Code That&apos;s Fit to Ship
        </p>
      </header>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <article className="sm:col-span-2">
          <h2 className="text-xl font-bold">
            Local Developer Ships Feature Without Breaking Production
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            In what experts are calling &quot;unprecedented,&quot; a local
            developer managed to ship a feature to production without causing
            any incidents. The developer credits thorough testing and a healthy
            fear of on-call rotations.
          </p>
        </article>
        <aside className="space-y-3 border-l border-zinc-200 pl-4 dark:border-zinc-700">
          <h3 className="text-sm font-bold uppercase text-zinc-500">
            Trending
          </h3>
          <p className="text-sm">Is CSS Finally &quot;Good Enough&quot;?</p>
          <p className="text-sm">10 Git Commands You Didn&apos;t Know</p>
          <p className="text-sm">Why I Switched to Vim (And Back)</p>
        </aside>
      </div>
    </div>
  );
}

function ResponsiveBoxes() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500">
        Resize your browser to see the responsive behavior
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["bg-red-400", "bg-blue-400", "bg-green-400", "bg-amber-400"].map(
          (color, i) => (
            <div
              key={i}
              className={`${color} flex h-32 items-center justify-center rounded-lg text-white font-bold`}
            >
              Box {i + 1}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function BirdSongs() {
  const birds = [
    {
      name: "Canary",
      sound: "Tweet tweet tweet!",
      color: "bg-yellow-100 dark:bg-yellow-900/30",
    },
    {
      name: "Duck",
      sound: "Quack quack!",
      color: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      name: "Meadowlark",
      sound: "Flutelike warble!",
      color: "bg-green-100 dark:bg-green-900/30",
    },
    {
      name: "Rooster",
      sound: "Cock-a-doodle-doo!",
      color: "bg-red-100 dark:bg-red-900/30",
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {birds.map((bird) => (
        <div key={bird.name} className={`${bird.color} rounded-lg p-4`}>
          <h3 className="text-lg font-bold">{bird.name}</h3>
          <p className="mt-1 italic text-zinc-600 dark:text-zinc-400">
            &quot;{bird.sound}&quot;
          </p>
        </div>
      ))}
    </div>
  );
}

function Animations() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-8">
      <div className="h-16 w-16 animate-spin rounded-lg bg-purple-500" />
      <div className="h-16 w-16 animate-bounce rounded-full bg-blue-500" />
      <div className="h-16 w-16 animate-pulse rounded-lg bg-green-500" />
      <div className="animate-ping h-8 w-8 rounded-full bg-red-500" />
    </div>
  );
}

function ImprovedForm() {
  const [submitted, setSubmitted] = useState(false);
  return submitted ? (
    <div className="text-center">
      <p className="text-lg font-medium text-green-600">
        Form submitted successfully!
      </p>
      <button
        onClick={() => setSubmitted(false)}
        className="mt-4 text-sm underline"
      >
        Try again
      </button>
    </div>
  ) : (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
      className="mx-auto max-w-sm space-y-4"
    >
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          type="text"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Password</label>
        <input
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
        />
      </div>
      <button
        type="submit"
        className="w-full rounded-md bg-zinc-900 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Submit
      </button>
    </form>
  );
}

export function HtmlCssFundamentals() {
  const [exercise, setExercise] = useState<Exercise>("hacker-times");

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
        {exercise === "hacker-times" && <HackerTimes />}
        {exercise === "responsive-boxes" && <ResponsiveBoxes />}
        {exercise === "bird-songs" && <BirdSongs />}
        {exercise === "animations" && <Animations />}
        {exercise === "form" && <ImprovedForm />}
      </div>
    </div>
  );
}
