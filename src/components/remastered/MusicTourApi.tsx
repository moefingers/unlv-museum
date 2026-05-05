"use client";

import { useState } from "react";

interface Band {
  id: number;
  name: string;
  genre: string;
  formedYear: number;
  events: Event[];
}

interface Event {
  venue: string;
  city: string;
  date: string;
  ticketPrice: number;
}

const BANDS: Band[] = [
  {
    id: 1,
    name: "Electric Mirage",
    genre: "Synthwave",
    formedYear: 2018,
    events: [
      {
        venue: "The Neon Room",
        city: "Las Vegas",
        date: "2024-06-15",
        ticketPrice: 35,
      },
      {
        venue: "Sunset Amphitheater",
        city: "Phoenix",
        date: "2024-06-20",
        ticketPrice: 45,
      },
    ],
  },
  {
    id: 2,
    name: "Desert Storm",
    genre: "Rock",
    formedYear: 2015,
    events: [
      {
        venue: "House of Blues",
        city: "Las Vegas",
        date: "2024-07-01",
        ticketPrice: 50,
      },
      {
        venue: "Red Rocks",
        city: "Denver",
        date: "2024-07-10",
        ticketPrice: 75,
      },
      {
        venue: "The Fillmore",
        city: "San Francisco",
        date: "2024-07-15",
        ticketPrice: 55,
      },
    ],
  },
  {
    id: 3,
    name: "Neon Pulse",
    genre: "Electronic",
    formedYear: 2020,
    events: [
      {
        venue: "Omnia Nightclub",
        city: "Las Vegas",
        date: "2024-08-05",
        ticketPrice: 60,
      },
    ],
  },
  {
    id: 4,
    name: "Canyon Echoes",
    genre: "Indie Folk",
    formedYear: 2019,
    events: [
      {
        venue: "Smith Center",
        city: "Las Vegas",
        date: "2024-09-12",
        ticketPrice: 40,
      },
      {
        venue: "Ryman Auditorium",
        city: "Nashville",
        date: "2024-09-20",
        ticketPrice: 55,
      },
    ],
  },
];

export function MusicTourApi() {
  const [selected, setSelected] = useState<Band | null>(null);
  const [endpoint, setEndpoint] = useState("/api/bands");

  const handleEndpoint = (ep: string, band?: Band) => {
    setEndpoint(ep);
    setSelected(band ?? null);
  };

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-4 text-2xl font-bold">Music Tour API</h2>

      <div className="mb-4 rounded bg-zinc-50 px-4 py-2 font-mono text-sm dark:bg-zinc-800">
        GET {endpoint}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex gap-2">
            <button
              onClick={() => handleEndpoint("/api/bands")}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            >
              GET /bands
            </button>
          </div>

          <div className="space-y-2">
            {BANDS.map((band) => (
              <button
                key={band.id}
                onClick={() => handleEndpoint(`/api/bands/${band.id}`, band)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${selected?.id === band.id ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950" : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{band.name}</span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                    {band.genre}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  Formed {band.formedYear} · {band.events.length} events
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="mb-2 text-xs font-medium text-zinc-500">Response</p>
          <pre className="overflow-x-auto text-xs">
            {JSON.stringify(
              selected
                ? selected
                : BANDS.map((b) => ({
                    id: b.id,
                    name: b.name,
                    genre: b.genre,
                    formedYear: b.formedYear,
                  })),
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
