"use client";

import { useState, useEffect } from "react";

interface Pet {
  id: number;
  name: string;
  species: string;
  breed: string | null;
  age: number | null;
  fact: string;
  imageUrl: string | null;
  createdAt: string;
}

const FALLBACK_PETS: Pet[] = [
  {
    id: 1,
    name: "Buddy",
    species: "Dog",
    breed: "Golden Retriever",
    age: 3,
    fact: "Dogs can understand up to 250 words and gestures.",
    imageUrl: null,
    createdAt: "",
  },
  {
    id: 2,
    name: "Whiskers",
    species: "Cat",
    breed: "Maine Coon",
    age: 5,
    fact: "Cats spend 70% of their lives sleeping.",
    imageUrl: null,
    createdAt: "",
  },
  {
    id: 3,
    name: "Nemo",
    species: "Fish",
    breed: "Clownfish",
    age: 2,
    fact: "Clownfish are immune to their host anemone's sting.",
    imageUrl: null,
    createdAt: "",
  },
  {
    id: 4,
    name: "Coco",
    species: "Bird",
    breed: "Cockatiel",
    age: 4,
    fact: "Cockatiels can learn to whistle entire songs.",
    imageUrl: null,
    createdAt: "",
  },
  {
    id: 5,
    name: "Thumper",
    species: "Rabbit",
    breed: "Holland Lop",
    age: 1,
    fact: "Rabbits can jump up to 3 feet high and 9 feet long.",
    imageUrl: null,
    createdAt: "",
  },
];

const SPECIES_EMOJI: Record<string, string> = {
  Dog: "🐕",
  Cat: "🐱",
  Fish: "🐠",
  Bird: "🦜",
  Rabbit: "🐇",
  Turtle: "🐢",
  Hamster: "🐹",
};

export function PetFaxReimagined() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newPet, setNewPet] = useState({
    name: "",
    species: "Dog",
    breed: "",
    age: "",
    fact: "",
  });
  const [randomFact, setRandomFact] = useState<Pet | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/petfax")
      .then((r) => (r.ok ? r.json() : FALLBACK_PETS))
      .then((data) => {
        if (!cancelled) setPets(data.length > 0 ? data : FALLBACK_PETS);
      })
      .catch(() => {
        if (!cancelled) setPets(FALLBACK_PETS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showRandom = () => {
    const pool = pets.length > 0 ? pets : FALLBACK_PETS;
    setRandomFact(pool[Math.floor(Math.random() * pool.length)]!);
  };

  const addPet = async () => {
    if (!newPet.name || !newPet.fact) return;
    const pet: Pet = {
      id: Date.now(),
      name: newPet.name,
      species: newPet.species,
      breed: newPet.breed || null,
      age: newPet.age ? parseInt(newPet.age) : null,
      fact: newPet.fact,
      imageUrl: null,
      createdAt: new Date().toISOString(),
    };
    setPets((prev) => [pet, ...prev]);
    setNewPet({ name: "", species: "Dog", breed: "", age: "", fact: "" });
    setShowAdd(false);
  };

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          🐾 PetFax{" "}
          <span className="text-sm font-normal text-amber-500">Reimagined</span>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={showRandom}
            className="rounded bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          >
            Random Fact
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {showAdd ? "Cancel" : "+ Add Pet"}
          </button>
        </div>
      </div>

      {randomFact && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-lg font-bold">
            <span>{SPECIES_EMOJI[randomFact.species] ?? "🐾"}</span>
            <span>{randomFact.name}&apos;s Fact</span>
          </div>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">
            {randomFact.fact}
          </p>
          <button
            onClick={() => setRandomFact(null)}
            className="mt-2 text-xs text-zinc-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {showAdd && (
        <div className="mb-4 space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={newPet.name}
              onChange={(e) => setNewPet({ ...newPet, name: e.target.value })}
              placeholder="Pet name"
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
            <select
              value={newPet.species}
              onChange={(e) =>
                setNewPet({ ...newPet, species: e.target.value })
              }
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            >
              {Object.keys(SPECIES_EMOJI).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <input
              value={newPet.breed}
              onChange={(e) => setNewPet({ ...newPet, breed: e.target.value })}
              placeholder="Breed (optional)"
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
            <input
              value={newPet.age}
              onChange={(e) => setNewPet({ ...newPet, age: e.target.value })}
              placeholder="Age"
              type="number"
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
          <textarea
            value={newPet.fact}
            onChange={(e) => setNewPet({ ...newPet, fact: e.target.value })}
            placeholder="Fun fact about this pet"
            rows={2}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
          <button
            onClick={addPet}
            className="rounded bg-green-600 px-4 py-2 text-sm text-white"
          >
            Add Pet
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pets.map((pet) => (
          <div
            key={pet.id}
            className="rounded-xl border border-zinc-200 p-4 transition-shadow hover:shadow-md dark:border-zinc-700"
          >
            <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-zinc-50 text-5xl dark:bg-zinc-800">
              {SPECIES_EMOJI[pet.species] ?? "🐾"}
            </div>
            <h3 className="font-bold">{pet.name}</h3>
            <p className="text-sm text-zinc-500">
              {pet.breed ? `${pet.breed} · ` : ""}
              {pet.species}
              {pet.age ? ` · ${pet.age}yr` : ""}
            </p>
            <div className="mt-3 rounded bg-amber-50 p-2 dark:bg-amber-950/20">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Fun Fact
              </p>
              <p className="mt-0.5 text-sm">{pet.fact}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
