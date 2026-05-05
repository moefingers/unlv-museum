"use client";

import { useState } from "react";

interface Pet {
  id: number;
  name: string;
  species: string;
  breed: string;
  age: number;
  fact: string;
  emoji: string;
}

const PETS: Pet[] = [
  {
    id: 1,
    name: "Buddy",
    species: "Dog",
    breed: "Golden Retriever",
    age: 3,
    fact: "Dogs can understand up to 250 words and gestures.",
    emoji: "🐕",
  },
  {
    id: 2,
    name: "Whiskers",
    species: "Cat",
    breed: "Maine Coon",
    age: 5,
    fact: "Cats spend 70% of their lives sleeping.",
    emoji: "🐱",
  },
  {
    id: 3,
    name: "Nemo",
    species: "Fish",
    breed: "Clownfish",
    age: 2,
    fact: "Clownfish are immune to their host anemone's sting.",
    emoji: "🐠",
  },
  {
    id: 4,
    name: "Coco",
    species: "Bird",
    breed: "Cockatiel",
    age: 4,
    fact: "Cockatiels can learn to whistle entire songs.",
    emoji: "🦜",
  },
  {
    id: 5,
    name: "Thumper",
    species: "Rabbit",
    breed: "Holland Lop",
    age: 1,
    fact: "Rabbits can jump up to 3 feet high and 9 feet long.",
    emoji: "🐇",
  },
  {
    id: 6,
    name: "Shelly",
    species: "Turtle",
    breed: "Red-Eared Slider",
    age: 15,
    fact: "Some turtles can breathe through their butts.",
    emoji: "🐢",
  },
];

export function PetFax() {
  const [selected, setSelected] = useState<Pet | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  const species = [...new Set(PETS.map((p) => p.species))];
  const filtered = filter ? PETS.filter((p) => p.species === filter) : PETS;

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-2 text-2xl font-bold">🐾 PetFax</h2>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Fun facts about pets
      </p>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-md px-3 py-1 text-sm font-medium ${!filter ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
        >
          All
        </button>
        {species.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1 text-sm font-medium ${filter === s ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((pet) => (
          <button
            key={pet.id}
            onClick={() => setSelected(selected?.id === pet.id ? null : pet)}
            className={`rounded-lg border p-4 text-left transition-all ${selected?.id === pet.id ? "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/30" : "border-zinc-200 hover:shadow-md dark:border-zinc-700"}`}
          >
            <div className="mb-2 text-4xl">{pet.emoji}</div>
            <h3 className="font-bold">{pet.name}</h3>
            <p className="text-sm text-zinc-500">
              {pet.breed} · {pet.age} year{pet.age !== 1 ? "s" : ""} old
            </p>

            {selected?.id === pet.id && (
              <div className="mt-3 rounded bg-amber-100/50 p-3 dark:bg-amber-900/20">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Fun Fact
                </p>
                <p className="mt-1 text-sm">{pet.fact}</p>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
