"use client";

import { useState } from "react";

interface SnackSpot {
  id: number;
  name: string;
  type: string;
  rating: number;
  description: string;
}

const SPOTS: SnackSpot[] = [
  {
    id: 1,
    name: "Golden Waffle House",
    type: "Breakfast",
    rating: 4.5,
    description: "Famous for their Belgian waffles and fresh-squeezed OJ",
  },
  {
    id: 2,
    name: "Midnight Munchies",
    type: "Late Night",
    rating: 4.2,
    description: "Open til 3am, best loaded fries in town",
  },
  {
    id: 3,
    name: "The Smoothie Bar",
    type: "Healthy",
    rating: 4.8,
    description: "Organic smoothie bowls and cold-pressed juices",
  },
  {
    id: 4,
    name: "Taco Alley",
    type: "Mexican",
    rating: 4.6,
    description: "Street-style tacos with homemade salsa verde",
  },
  {
    id: 5,
    name: "Boba Bliss",
    type: "Drinks",
    rating: 4.3,
    description: "Artisan bubble tea with real fruit",
  },
];

export function Jaskis() {
  const [spots, setSpots] = useState(SPOTS);
  const [newSpot, setNewSpot] = useState({
    name: "",
    type: "",
    description: "",
  });
  const [showForm, setShowForm] = useState(false);

  const addSpot = () => {
    if (newSpot.name && newSpot.type) {
      setSpots([
        ...spots,
        {
          id: Math.max(...spots.map((s) => s.id), 0) + 1,
          name: newSpot.name,
          type: newSpot.type,
          rating: 0,
          description: newSpot.description,
        },
      ]);
      setNewSpot({ name: "", type: "", description: "" });
      setShowForm(false);
    }
  };

  const deleteSpot = (id: number) => {
    setSpots(spots.filter((s) => s.id !== id));
  };

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">JASKIS</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {showForm ? "Cancel" : "+ Add Spot"}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <input
            value={newSpot.name}
            onChange={(e) => setNewSpot({ ...newSpot, name: e.target.value })}
            placeholder="Spot name"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
          <input
            value={newSpot.type}
            onChange={(e) => setNewSpot({ ...newSpot, type: e.target.value })}
            placeholder="Type (e.g., Mexican, Breakfast)"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
          <input
            value={newSpot.description}
            onChange={(e) =>
              setNewSpot({ ...newSpot, description: e.target.value })
            }
            placeholder="Description"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
          <button
            onClick={addSpot}
            className="rounded bg-green-600 px-4 py-2 text-sm text-white"
          >
            Save
          </button>
        </div>
      )}

      <div className="space-y-3">
        {spots.map((spot) => (
          <div
            key={spot.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold">{spot.name}</h3>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                  {spot.type}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{spot.description}</p>
              {spot.rating > 0 && (
                <p className="mt-1 text-sm text-amber-500">
                  {"★".repeat(Math.floor(spot.rating))} {spot.rating}
                </p>
              )}
            </div>
            <button
              onClick={() => deleteSpot(spot.id)}
              className="text-sm text-red-500 hover:underline"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
