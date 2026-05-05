"use client";

import { useState } from "react";

interface Location {
  id: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  description: string;
}

const LOCATIONS: Location[] = [
  {
    id: 1,
    name: "The Venetian",
    type: "Hotel",
    lat: 36.1215,
    lng: -115.1739,
    description: "Luxury resort with Grand Canal Shoppes",
  },
  {
    id: 2,
    name: "Fremont Street",
    type: "Attraction",
    lat: 36.1708,
    lng: -115.1429,
    description: "Vibrant pedestrian mall downtown",
  },
  {
    id: 3,
    name: "Red Rock Canyon",
    type: "Nature",
    lat: 36.1355,
    lng: -115.4294,
    description: "Scenic desert conservation area",
  },
  {
    id: 4,
    name: "UNLV Campus",
    type: "Education",
    lat: 36.1084,
    lng: -115.144,
    description: "University of Nevada, Las Vegas",
  },
  {
    id: 5,
    name: "Springs Preserve",
    type: "Nature",
    lat: 36.1647,
    lng: -115.186,
    description: "Desert botanical garden and trails",
  },
  {
    id: 6,
    name: "Container Park",
    type: "Shopping",
    lat: 36.168,
    lng: -115.1377,
    description: "Open-air shopping built from containers",
  },
];

const TYPE_COLORS: Record<string, string> = {
  Hotel:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Attraction:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Nature:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Education:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Shopping: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
};

export function InteractiveMap() {
  const [selected, setSelected] = useState<Location | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const types = [...new Set(LOCATIONS.map((l) => l.type))];

  const filtered = filter
    ? LOCATIONS.filter((l) => l.type === filter)
    : LOCATIONS;

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-4 text-2xl font-bold">Las Vegas Interactive Map</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-md px-3 py-1 text-sm font-medium ${!filter ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
        >
          All
        </button>
        {types.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`rounded-md px-3 py-1 text-sm font-medium ${filter === type ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          {filtered.map((loc) => (
            <button
              key={loc.id}
              onClick={() => setSelected(loc)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${selected?.id === loc.id ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{loc.name}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[loc.type] ?? ""}`}
                >
                  {loc.type}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800">
          {selected ? (
            <div className="text-center">
              <h3 className="text-xl font-bold">{selected.name}</h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                {selected.description}
              </p>
              <p className="mt-2 font-mono text-xs text-zinc-400">
                {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
              </p>
            </div>
          ) : (
            <p className="text-zinc-400">Select a location to view details</p>
          )}
        </div>
      </div>
    </div>
  );
}
