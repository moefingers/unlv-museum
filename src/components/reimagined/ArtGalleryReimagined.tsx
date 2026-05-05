"use client";

import { useState } from "react";

interface Artwork {
  id: number;
  title: string;
  artist: string;
  year: number;
  medium: string;
  color: string;
  description: string;
}

const ARTWORKS: Artwork[] = [
  {
    id: 1,
    title: "Starry Night",
    artist: "Vincent van Gogh",
    year: 1889,
    medium: "Oil on canvas",
    color: "from-blue-800 to-indigo-900",
    description:
      "Swirling night sky painted from memory during van Gogh's stay at the asylum in Saint-Rémy-de-Provence.",
  },
  {
    id: 2,
    title: "The Persistence of Memory",
    artist: "Salvador Dalí",
    year: 1931,
    medium: "Oil on canvas",
    color: "from-amber-600 to-orange-800",
    description:
      "Melting clocks in a dreamlike landscape, exploring the fluidity of time in the subconscious.",
  },
  {
    id: 3,
    title: "Girl with a Pearl Earring",
    artist: "Johannes Vermeer",
    year: 1665,
    medium: "Oil on canvas",
    color: "from-teal-700 to-cyan-900",
    description:
      "Often called the 'Mona Lisa of the North,' this tronie captures a mysterious girl glancing over her shoulder.",
  },
  {
    id: 4,
    title: "The Great Wave",
    artist: "Katsushika Hokusai",
    year: 1831,
    medium: "Woodblock print",
    color: "from-blue-500 to-sky-700",
    description:
      "A towering wave threatens boats near Kanagawa, with Mount Fuji small in the background.",
  },
  {
    id: 5,
    title: "Water Lilies",
    artist: "Claude Monet",
    year: 1906,
    medium: "Oil on canvas",
    color: "from-green-600 to-emerald-800",
    description:
      "Part of Monet's series of approximately 250 oil paintings depicting his flower garden in Giverny.",
  },
  {
    id: 6,
    title: "The Kiss",
    artist: "Gustav Klimt",
    year: 1908,
    medium: "Oil and gold leaf",
    color: "from-yellow-600 to-amber-800",
    description:
      "A couple embracing on a cliff of flowers, covered in elaborate gold-leaf robes.",
  },
];

type Layout = "grid" | "masonry" | "carousel";

export function ArtGalleryReimagined() {
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [layout, setLayout] = useState<Layout>("grid");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  const toggleFavorite = (id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Art Gallery{" "}
          <span className="text-sm font-normal text-amber-500">Reimagined</span>
        </h2>
        <div className="flex gap-1">
          {(["grid", "masonry", "carousel"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLayout(l)}
              className={`rounded-md px-3 py-1 text-sm font-medium capitalize ${layout === l ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`mb-4 h-64 rounded-lg bg-linear-to-br ${selected.color}`}
            />
            <h3 className="text-xl font-bold">{selected.title}</h3>
            <p className="text-zinc-500">
              {selected.artist}, {selected.year}
            </p>
            <p className="mt-1 text-sm text-zinc-400">{selected.medium}</p>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {selected.description}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => toggleFavorite(selected.id)}
                className={`rounded px-3 py-1 text-sm ${favorites.has(selected.id) ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : "bg-zinc-100 dark:bg-zinc-800"}`}
              >
                {favorites.has(selected.id) ? "♥ Favorited" : "♡ Favorite"}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="rounded bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {layout === "grid" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {ARTWORKS.map((art) => (
            <button
              key={art.id}
              onClick={() => setSelected(art)}
              className="group overflow-hidden rounded-xl border border-zinc-200 transition-all hover:shadow-lg dark:border-zinc-700"
            >
              <div
                className={`h-40 bg-linear-to-br ${art.color} transition-transform group-hover:scale-105`}
              />
              <div className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{art.title}</p>
                    <p className="text-xs text-zinc-500">{art.artist}</p>
                  </div>
                  {favorites.has(art.id) && (
                    <span className="text-red-500">♥</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {layout === "masonry" && (
        <div className="columns-2 gap-4 sm:columns-3">
          {ARTWORKS.map((art, i) => (
            <button
              key={art.id}
              onClick={() => setSelected(art)}
              className="mb-4 block w-full overflow-hidden rounded-xl border border-zinc-200 transition-all hover:shadow-lg dark:border-zinc-700"
            >
              <div
                className={`bg-linear-to-br ${art.color}`}
                style={{ height: 120 + (i % 3) * 60 }}
              />
              <div className="p-3">
                <p className="font-medium">{art.title}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {layout === "carousel" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ARTWORKS.map((art) => (
            <button
              key={art.id}
              onClick={() => setSelected(art)}
              className="min-w-[280px] flex-shrink-0 overflow-hidden rounded-xl border border-zinc-200 transition-all hover:shadow-lg dark:border-zinc-700"
            >
              <div className={`h-48 bg-linear-to-br ${art.color}`} />
              <div className="p-4">
                <p className="font-medium">{art.title}</p>
                <p className="text-sm text-zinc-500">
                  {art.artist}, {art.year}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {favorites.size > 0 && (
        <div className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-500">
            Favorites ({favorites.size})
          </p>
          <div className="mt-2 flex gap-2">
            {ARTWORKS.filter((a) => favorites.has(a.id)).map((a) => (
              <span
                key={a.id}
                className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
              >
                {a.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
