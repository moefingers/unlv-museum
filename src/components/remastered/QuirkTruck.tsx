"use client";

import { useState } from "react";

interface Truck {
  id: number;
  name: string;
  quirks: string[];
  make: string;
  year: number;
}

const TRUCKS: Truck[] = [
  {
    id: 1,
    name: "Big Blue",
    make: "Peterbilt 379",
    year: 2004,
    quirks: [
      "Pulls slightly left when braking",
      "Radio only works on AM",
      "Horn plays La Cucaracha",
    ],
  },
  {
    id: 2,
    name: "Old Faithful",
    make: "Kenworth T800",
    year: 1998,
    quirks: [
      "AC takes 30 minutes to cool",
      "Driver door squeaks in rain",
      "Fuel gauge reads full when half empty",
    ],
  },
  {
    id: 3,
    name: "The Beast",
    make: "Mack Granite",
    year: 2010,
    quirks: [
      "Vibrates at exactly 55 mph",
      "Passenger mirror has a crack shaped like Texas",
      "Won't start if parked facing north",
    ],
  },
  {
    id: 4,
    name: "Silver Streak",
    make: "Freightliner Cascadia",
    year: 2015,
    quirks: [
      "Heated seats stuck on high",
      "Reverse beep sounds like R2-D2",
      "Cup holder only fits square cups",
    ],
  },
  {
    id: 5,
    name: "Dusty",
    make: "International HX",
    year: 2008,
    quirks: [
      "Windshield wipers have two speeds: slow and slower",
      "Smells like cinnamon when idle",
      "Dashboard clock is 7 minutes fast",
    ],
  },
];

export function QuirkTruck() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Truck | null>(null);

  const filtered = TRUCKS.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.make.toLowerCase().includes(search.toLowerCase()) ||
      t.quirks.some((q) => q.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-2 text-2xl font-bold">🚛 Quirk Truck</h2>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Every truck has its quirks. Search to find them.
      </p>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search trucks or quirks..."
        className="mb-4 w-full rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600 dark:bg-zinc-800"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((truck) => (
          <button
            key={truck.id}
            onClick={() =>
              setSelected(selected?.id === truck.id ? null : truck)
            }
            className={`rounded-lg border p-4 text-left transition-colors ${selected?.id === truck.id ? "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/30" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold">{truck.name}</h3>
              <span className="text-xs text-zinc-400">{truck.year}</span>
            </div>
            <p className="text-sm text-zinc-500">{truck.make}</p>

            {selected?.id === truck.id && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium uppercase text-zinc-400">
                  Known Quirks
                </p>
                {truck.quirks.map((quirk, i) => (
                  <p key={i} className="text-sm">
                    • {quirk}
                  </p>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-4 text-center text-zinc-400">
          No trucks match your search
        </p>
      )}
    </div>
  );
}
