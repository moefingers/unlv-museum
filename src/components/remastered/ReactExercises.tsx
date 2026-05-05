"use client";

import { useState } from "react";

type Exercise = "music-search" | "bootstrap" | "rainbow" | "stylesheets";

const EXERCISES: { id: Exercise; label: string }[] = [
  { id: "music-search", label: "Music Search" },
  { id: "bootstrap", label: "Bootstrap Cards" },
  { id: "rainbow", label: "Rainbow" },
  { id: "stylesheets", label: "Stylesheets" },
];

const SONGS = [
  {
    title: "Bohemian Rhapsody",
    artist: "Queen",
    album: "A Night at the Opera",
    year: 1975,
  },
  {
    title: "Stairway to Heaven",
    artist: "Led Zeppelin",
    album: "Led Zeppelin IV",
    year: 1971,
  },
  {
    title: "Hotel California",
    artist: "Eagles",
    album: "Hotel California",
    year: 1976,
  },
  { title: "Imagine", artist: "John Lennon", album: "Imagine", year: 1971 },
  {
    title: "Smells Like Teen Spirit",
    artist: "Nirvana",
    album: "Nevermind",
    year: 1991,
  },
  {
    title: "Billie Jean",
    artist: "Michael Jackson",
    album: "Thriller",
    year: 1982,
  },
  { title: "Hey Jude", artist: "The Beatles", album: "Single", year: 1968 },
  { title: "Purple Rain", artist: "Prince", album: "Purple Rain", year: 1984 },
];

function MusicSearch() {
  const [query, setQuery] = useState("");
  const filtered = SONGS.filter(
    (s) =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.artist.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search songs or artists..."
        className="w-full rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600 dark:bg-zinc-800"
      />
      <div className="space-y-2">
        {filtered.map((song) => (
          <div
            key={song.title}
            className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
          >
            <div>
              <p className="font-medium">{song.title}</p>
              <p className="text-sm text-zinc-500">
                {song.artist} — {song.album}
              </p>
            </div>
            <span className="text-sm text-zinc-400">{song.year}</span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-zinc-400">No results</p>
        )}
      </div>
    </div>
  );
}

function BootstrapCards() {
  const cards = [
    {
      title: "Card One",
      body: "A simple card demonstrating Bootstrap's card component, rebuilt with Tailwind utility classes.",
    },
    {
      title: "Card Two",
      body: "Cards are flexible containers with multiple variants for headers, footers, and content.",
    },
    {
      title: "Card Three",
      body: "The grid system ensures cards align properly across different screen sizes.",
    },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700"
        >
          <div className="border-b border-zinc-200 px-4 py-3 font-medium dark:border-zinc-700">
            {card.title}
          </div>
          <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
            {card.body}
          </div>
          <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <button className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
              Action
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Rainbow() {
  const colors = [
    { name: "Red", bg: "bg-red-500", text: "text-red-100" },
    { name: "Orange", bg: "bg-orange-500", text: "text-orange-100" },
    { name: "Yellow", bg: "bg-yellow-400", text: "text-yellow-900" },
    { name: "Green", bg: "bg-green-500", text: "text-green-100" },
    { name: "Blue", bg: "bg-blue-500", text: "text-blue-100" },
    { name: "Indigo", bg: "bg-indigo-500", text: "text-indigo-100" },
    { name: "Violet", bg: "bg-violet-500", text: "text-violet-100" },
  ];
  return (
    <div className="space-y-2">
      {colors.map((c) => (
        <div
          key={c.name}
          className={`${c.bg} ${c.text} rounded-lg px-6 py-4 text-center font-bold`}
        >
          {c.name}
        </div>
      ))}
    </div>
  );
}

function Stylesheets() {
  const [method, setMethod] = useState<"inline" | "module" | "utility">(
    "utility",
  );
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["inline", "module", "utility"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${method === m ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
        {method === "inline" && (
          <div
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              padding: "1rem",
              borderRadius: "0.5rem",
            }}
          >
            This uses inline styles
          </div>
        )}
        {method === "module" && (
          <div className="rounded-lg bg-green-500 p-4 text-white">
            This would use CSS Modules (simulated with Tailwind)
          </div>
        )}
        {method === "utility" && (
          <div className="rounded-lg bg-purple-500 p-4 text-white">
            This uses Tailwind utility classes
          </div>
        )}
      </div>
    </div>
  );
}

export function ReactExercises() {
  const [exercise, setExercise] = useState<Exercise>("music-search");

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

      <div className="mx-auto w-full max-w-2xl flex-1">
        {exercise === "music-search" && <MusicSearch />}
        {exercise === "bootstrap" && <BootstrapCards />}
        {exercise === "rainbow" && <Rainbow />}
        {exercise === "stylesheets" && <Stylesheets />}
      </div>
    </div>
  );
}
