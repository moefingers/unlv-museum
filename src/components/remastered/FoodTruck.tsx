"use client";

import { useState } from "react";

type Section = "home" | "menu" | "about";

const MENU = [
  {
    name: "Classic Taco",
    price: "$4.50",
    description: "Seasoned beef, lettuce, cheese, salsa",
  },
  {
    name: "Chicken Burrito",
    price: "$8.99",
    description: "Grilled chicken, rice, beans, guacamole",
  },
  {
    name: "Fish Tacos",
    price: "$6.50",
    description: "Beer-battered cod, slaw, lime crema",
  },
  {
    name: "Quesadilla",
    price: "$5.99",
    description: "Three-cheese blend, peppers, onions",
  },
  {
    name: "Nachos Supreme",
    price: "$7.99",
    description: "Loaded with toppings, jalapeños, sour cream",
  },
  {
    name: "Churros",
    price: "$3.99",
    description: "Cinnamon sugar, chocolate dipping sauce",
  },
];

export function FoodTruck() {
  const [section, setSection] = useState<Section>("home");

  return (
    <div className="flex min-h-[60vh] flex-col">
      <header className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-8 text-white">
        <h1 className="text-3xl font-bold">🌮 Taco Loco</h1>
        <p className="mt-1 text-orange-100">
          The best street food on four wheels
        </p>
        <nav className="mt-4 flex gap-2">
          {(["home", "menu", "about"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${section === s ? "bg-white/20" : "hover:bg-white/10"}`}
            >
              {s}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 p-6">
        {section === "home" && (
          <div className="mx-auto max-w-md text-center">
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Find us on the corner of 4th & Main, Tuesday through Saturday.
              Fresh ingredients, bold flavors, made to order.
            </p>
            <div className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
              <p className="font-medium">📍 Today&apos;s Location</p>
              <p className="text-sm text-zinc-500">
                4th & Main St, 11:00 AM - 8:00 PM
              </p>
            </div>
          </div>
        )}

        {section === "menu" && (
          <div className="mx-auto max-w-lg space-y-3">
            {MENU.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-zinc-500">{item.description}</p>
                </div>
                <span className="font-bold text-orange-600 dark:text-orange-400">
                  {item.price}
                </span>
              </div>
            ))}
          </div>
        )}

        {section === "about" && (
          <div className="mx-auto max-w-md text-center">
            <p className="text-zinc-600 dark:text-zinc-400">
              Started in 2023 as a class project at UNLV, Taco Loco represents
              the dream of bringing authentic street food to every corner. Our
              recipes are family-inspired, our ingredients locally sourced.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
