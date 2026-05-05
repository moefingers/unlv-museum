"use client";

import { useState } from "react";

interface Place {
  id: number;
  name: string;
  city: string;
  state: string;
  cuisine: string;
  rating: number;
  reviews: Review[];
}

interface Review {
  author: string;
  rating: number;
  body: string;
}

const PLACES: Place[] = [
  {
    id: 1,
    name: "Tacos El Gordo",
    city: "Las Vegas",
    state: "NV",
    cuisine: "Mexican",
    rating: 4.5,
    reviews: [
      {
        author: "FoodLover",
        rating: 5,
        body: "Best street tacos in Vegas! The al pastor is incredible.",
      },
      {
        author: "LocalGuide",
        rating: 4,
        body: "Always a long line but worth the wait.",
      },
    ],
  },
  {
    id: 2,
    name: "Lotus of Siam",
    city: "Las Vegas",
    state: "NV",
    cuisine: "Thai",
    rating: 4.8,
    reviews: [
      {
        author: "SpiceFan",
        rating: 5,
        body: "Northern Thai food at its finest. Wine list is surprisingly good.",
      },
    ],
  },
  {
    id: 3,
    name: "Raku",
    city: "Las Vegas",
    state: "NV",
    cuisine: "Japanese",
    rating: 4.7,
    reviews: [
      {
        author: "SushiMaster",
        rating: 5,
        body: "Authentic robatayaki. The wagyu beef is life-changing.",
      },
      {
        author: "NightOwl",
        rating: 4,
        body: "Late-night gem. Everything is cooked over charcoal.",
      },
    ],
  },
  {
    id: 4,
    name: "Esther's Kitchen",
    city: "Las Vegas",
    state: "NV",
    cuisine: "Italian",
    rating: 4.3,
    reviews: [
      {
        author: "PastaLover",
        rating: 4,
        body: "Great ambiance in the Arts District. Wood-fired everything.",
      },
    ],
  },
];

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500">
      {"★".repeat(Math.floor(rating))}
      {rating % 1 >= 0.5 ? "½" : ""}
      {"☆".repeat(5 - Math.ceil(rating))}
    </span>
  );
}

export function RestRant() {
  const [selected, setSelected] = useState<Place | null>(null);
  const [newReview, setNewReview] = useState({
    author: "",
    rating: 5,
    body: "",
  });

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-4 text-2xl font-bold">Rest-Rant</h2>

      {!selected ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {PLACES.map((place) => (
            <button
              key={place.id}
              onClick={() => setSelected(place)}
              className="rounded-lg border border-zinc-200 p-4 text-left transition-shadow hover:shadow-md dark:border-zinc-700"
            >
              <h3 className="font-bold">{place.name}</h3>
              <p className="text-sm text-zinc-500">
                {place.city}, {place.state} — {place.cuisine}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Stars rating={place.rating} />
                <span className="text-sm text-zinc-400">
                  ({place.reviews.length} reviews)
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setSelected(null)}
            className="mb-4 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to all places
          </button>

          <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
            <h3 className="text-xl font-bold">{selected.name}</h3>
            <p className="text-zinc-500">
              {selected.city}, {selected.state} — {selected.cuisine}
            </p>
            <div className="mt-1">
              <Stars rating={selected.rating} />
            </div>

            <h4 className="mt-6 mb-3 font-semibold">Reviews</h4>
            <div className="space-y-3">
              {selected.reviews.map((review, i) => (
                <div
                  key={i}
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
              <select
                value={newReview.rating}
                onChange={(e) =>
                  setNewReview({ ...newReview, rating: Number(e.target.value) })
                }
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              >
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {r} star{r !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
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
                onClick={() => {
                  if (newReview.author && newReview.body) {
                    setSelected({
                      ...selected,
                      reviews: [...selected.reviews, newReview],
                    });
                    setNewReview({ author: "", rating: 5, body: "" });
                  }
                }}
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
