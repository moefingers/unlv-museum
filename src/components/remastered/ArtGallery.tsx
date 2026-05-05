"use client";

import { useState } from "react";

interface Artwork {
  id: number;
  title: string;
  artist: string;
  year: number;
  medium: string;
  color: string;
}

const ARTWORKS: Artwork[] = [
  {
    id: 1,
    title: "Starry Night",
    artist: "Vincent van Gogh",
    year: 1889,
    medium: "Oil on canvas",
    color: "from-blue-800 to-indigo-900",
  },
  {
    id: 2,
    title: "The Persistence of Memory",
    artist: "Salvador Dalí",
    year: 1931,
    medium: "Oil on canvas",
    color: "from-amber-600 to-orange-800",
  },
  {
    id: 3,
    title: "Girl with a Pearl Earring",
    artist: "Johannes Vermeer",
    year: 1665,
    medium: "Oil on canvas",
    color: "from-teal-700 to-cyan-900",
  },
  {
    id: 4,
    title: "The Great Wave",
    artist: "Katsushika Hokusai",
    year: 1831,
    medium: "Woodblock print",
    color: "from-blue-500 to-sky-700",
  },
  {
    id: 5,
    title: "Water Lilies",
    artist: "Claude Monet",
    year: 1906,
    medium: "Oil on canvas",
    color: "from-green-600 to-emerald-800",
  },
  {
    id: 6,
    title: "The Kiss",
    artist: "Gustav Klimt",
    year: 1908,
    medium: "Oil and gold leaf",
    color: "from-yellow-600 to-amber-800",
  },
  {
    id: 7,
    title: "Guernica",
    artist: "Pablo Picasso",
    year: 1937,
    medium: "Oil on canvas",
    color: "from-zinc-600 to-zinc-800",
  },
  {
    id: 8,
    title: "A Sunday Afternoon",
    artist: "Georges Seurat",
    year: 1886,
    medium: "Oil on canvas",
    color: "from-green-500 to-lime-700",
  },
  {
    id: 9,
    title: "The Birth of Venus",
    artist: "Sandro Botticelli",
    year: 1485,
    medium: "Tempera on canvas",
    color: "from-rose-400 to-pink-600",
  },
];

export function ArtGallery() {
  const [selected, setSelected] = useState<Artwork | null>(null);

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-6 text-2xl font-bold">Art Gallery</h2>

      {selected && (
        <div className="mb-6 rounded-xl border border-zinc-200 p-6 dark:border-zinc-700">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold">{selected.title}</h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                {selected.artist}, {selected.year}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{selected.medium}</p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-zinc-400 hover:text-zinc-600"
            >
              Close
            </button>
          </div>
          <div
            className={`mt-4 h-48 rounded-lg bg-linear-to-br ${selected.color}`}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ARTWORKS.map((art) => (
          <button
            key={art.id}
            onClick={() => setSelected(art)}
            className="group overflow-hidden rounded-lg border border-zinc-200 transition-shadow hover:shadow-md dark:border-zinc-700"
          >
            <div
              className={`h-32 bg-linear-to-br ${art.color} transition-transform group-hover:scale-105`}
            />
            <div className="p-2">
              <p className="truncate text-sm font-medium">{art.title}</p>
              <p className="truncate text-xs text-zinc-500">{art.artist}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
