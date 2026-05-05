"use client";

import { useState, useEffect, useCallback } from "react";

interface Place {
  id: number;
  name: string;
  city: string;
  state: string;
  cuisine: string;
  createdAt: string;
}

interface Review {
  id: number;
  placeId: number;
  author: string;
  rating: number;
  body: string;
  createdAt: string;
}

interface PlaceDetail extends Place {
  reviews: Review[];
}

function Stars({
  rating,
  interactive,
  onChange,
}: {
  rating: number;
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => interactive && onChange?.(n)}
          className={`${interactive ? "cursor-pointer" : ""} ${n <= rating ? "text-amber-500" : "text-zinc-300 dark:text-zinc-600"}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export function RestRantReimagined() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [newPlace, setNewPlace] = useState({
    name: "",
    city: "",
    state: "",
    cuisine: "",
  });
  const [newReview, setNewReview] = useState({
    author: "",
    rating: 5,
    body: "",
  });

  const fetchPlaces = useCallback(async () => {
    try {
      const res = await fetch("/api/rest-rant");
      if (res.ok) setPlaces(await res.json());
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/rest-rant")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setPlaces(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectPlace = async (id: number) => {
    try {
      const res = await fetch(`/api/rest-rant/${id}`);
      if (res.ok) setSelected(await res.json());
    } catch {
      /* offline */
    }
  };

  const addPlace = async () => {
    if (
      !newPlace.name ||
      !newPlace.city ||
      !newPlace.state ||
      !newPlace.cuisine
    )
      return;
    try {
      const res = await fetch("/api/rest-rant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addPlace", ...newPlace }),
      });
      if (res.ok) {
        setNewPlace({ name: "", city: "", state: "", cuisine: "" });
        setShowAddPlace(false);
        fetchPlaces();
      }
    } catch {
      /* offline */
    }
  };

  const addReview = async () => {
    if (!selected || !newReview.author || !newReview.body) return;
    try {
      const res = await fetch("/api/rest-rant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addReview",
          placeId: selected.id,
          ...newReview,
        }),
      });
      if (res.ok) {
        setNewReview({ author: "", rating: 5, body: "" });
        selectPlace(selected.id);
      }
    } catch {
      /* offline */
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Rest-Rant{" "}
          <span className="text-sm font-normal text-amber-500">Reimagined</span>
        </h2>
        {!selected && (
          <button
            onClick={() => setShowAddPlace(!showAddPlace)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {showAddPlace ? "Cancel" : "+ Add Place"}
          </button>
        )}
      </div>

      {showAddPlace && !selected && (
        <div className="mb-4 space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={newPlace.name}
              onChange={(e) =>
                setNewPlace({ ...newPlace, name: e.target.value })
              }
              placeholder="Restaurant name"
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
            <input
              value={newPlace.cuisine}
              onChange={(e) =>
                setNewPlace({ ...newPlace, cuisine: e.target.value })
              }
              placeholder="Cuisine type"
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
            <input
              value={newPlace.city}
              onChange={(e) =>
                setNewPlace({ ...newPlace, city: e.target.value })
              }
              placeholder="City"
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
            <input
              value={newPlace.state}
              onChange={(e) =>
                setNewPlace({ ...newPlace, state: e.target.value })
              }
              placeholder="State (2 letter)"
              maxLength={2}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
          <button
            onClick={addPlace}
            className="rounded bg-green-600 px-4 py-2 text-sm text-white"
          >
            Save Place
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-400">Loading...</p>
      ) : !selected ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {places.length === 0 ? (
            <p className="text-zinc-400">
              No places yet. Be the first to add one!
            </p>
          ) : (
            places.map((place) => (
              <button
                key={place.id}
                onClick={() => selectPlace(place.id)}
                className="rounded-lg border border-zinc-200 p-4 text-left transition-shadow hover:shadow-md dark:border-zinc-700"
              >
                <h3 className="font-bold">{place.name}</h3>
                <p className="text-sm text-zinc-500">
                  {place.city}, {place.state} — {place.cuisine}
                </p>
              </button>
            ))
          )}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setSelected(null)}
            className="mb-4 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back
          </button>
          <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
            <h3 className="text-xl font-bold">{selected.name}</h3>
            <p className="text-zinc-500">
              {selected.city}, {selected.state} — {selected.cuisine}
            </p>

            <h4 className="mt-6 mb-3 font-semibold">
              Reviews ({selected.reviews.length})
            </h4>
            {selected.reviews.length === 0 ? (
              <p className="text-sm text-zinc-400">
                No reviews yet. Be the first!
              </p>
            ) : (
              <div className="space-y-3">
                {selected.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="rounded border border-zinc-100 p-3 dark:border-zinc-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{review.author}</span>
                      <Stars rating={review.rating} />
                    </div>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {review.body}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <h4 className="mt-6 mb-3 font-semibold">Write a Review</h4>
            <div className="space-y-2">
              <input
                value={newReview.author}
                onChange={(e) =>
                  setNewReview({ ...newReview, author: e.target.value })
                }
                placeholder="Your name"
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm">Rating:</span>
                <Stars
                  rating={newReview.rating}
                  interactive
                  onChange={(r) => setNewReview({ ...newReview, rating: r })}
                />
              </div>
              <textarea
                value={newReview.body}
                onChange={(e) =>
                  setNewReview({ ...newReview, body: e.target.value })
                }
                placeholder="Write your review..."
                rows={3}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              />
              <button
                onClick={addReview}
                className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
