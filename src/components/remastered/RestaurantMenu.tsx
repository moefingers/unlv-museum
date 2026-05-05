"use client";

import { useState } from "react";

type Page = "home" | "menu" | "about" | "contact";

const MENU_ITEMS = [
  {
    name: "Bruschetta",
    price: "$8.99",
    category: "Appetizers",
    description: "Toasted bread with fresh tomatoes, garlic, and basil",
  },
  {
    name: "Caesar Salad",
    price: "$10.99",
    category: "Appetizers",
    description: "Crisp romaine, parmesan, croutons, house dressing",
  },
  {
    name: "Grilled Salmon",
    price: "$24.99",
    category: "Entrees",
    description: "Atlantic salmon with lemon butter sauce",
  },
  {
    name: "Filet Mignon",
    price: "$34.99",
    category: "Entrees",
    description: "8oz center-cut with garlic mashed potatoes",
  },
  {
    name: "Pasta Primavera",
    price: "$16.99",
    category: "Entrees",
    description: "Penne with seasonal vegetables in marinara",
  },
  {
    name: "Tiramisu",
    price: "$9.99",
    category: "Desserts",
    description: "Classic Italian layered coffee dessert",
  },
  {
    name: "Cheesecake",
    price: "$8.99",
    category: "Desserts",
    description: "New York style with berry compote",
  },
];

function Nav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const links: { id: Page; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "menu", label: "Menu" },
    { id: "about", label: "About" },
    { id: "contact", label: "Contact" },
  ];
  return (
    <nav className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      {links.map((link) => (
        <button
          key={link.id}
          onClick={() => setPage(link.id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${page === link.id ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"}`}
        >
          {link.label}
        </button>
      ))}
    </nav>
  );
}

export function RestaurantMenu() {
  const [page, setPage] = useState<Page>("home");

  return (
    <div className="flex min-h-[60vh] flex-col items-center p-6">
      <Nav page={page} setPage={setPage} />

      <div className="mt-8 w-full max-w-2xl">
        {page === "home" && (
          <div className="text-center">
            <h2 className="text-3xl font-bold">Welcome to La Cucina</h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Authentic Italian cuisine made with fresh, locally-sourced
              ingredients. Join us for an unforgettable dining experience.
            </p>
            <div className="mt-6 rounded-lg bg-amber-50 p-4 dark:bg-amber-950/30">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Open Tuesday - Sunday, 5:00 PM - 10:00 PM
              </p>
            </div>
          </div>
        )}

        {page === "menu" && (
          <div>
            <h2 className="mb-6 text-2xl font-bold">Our Menu</h2>
            {["Appetizers", "Entrees", "Desserts"].map((category) => (
              <div key={category} className="mb-6">
                <h3 className="mb-3 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
                  {category}
                </h3>
                <div className="space-y-3">
                  {MENU_ITEMS.filter((item) => item.category === category).map(
                    (item) => (
                      <div
                        key={item.name}
                        className="flex items-start justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                      >
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            {item.description}
                          </p>
                        </div>
                        <span className="font-semibold text-green-700 dark:text-green-400">
                          {item.price}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {page === "about" && (
          <div className="text-center">
            <h2 className="text-2xl font-bold">About Us</h2>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              La Cucina has been serving the community since 2020. Our chef
              trained in Florence and brings authentic Italian techniques to
              every dish. We believe in simple, quality ingredients prepared
              with care.
            </p>
          </div>
        )}

        {page === "contact" && (
          <div className="text-center">
            <h2 className="text-2xl font-bold">Contact Us</h2>
            <div className="mt-4 space-y-2 text-zinc-600 dark:text-zinc-400">
              <p>123 Main Street, Las Vegas, NV 89101</p>
              <p>(702) 555-0123</p>
              <p>info@lacucina.example.com</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
