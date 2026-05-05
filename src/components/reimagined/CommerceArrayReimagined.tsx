"use client";

import { useState, useEffect } from "react";

interface Product {
  id: number;
  name: string;
  description: string | null;
  priceCents: number;
  category: string;
  inStock: boolean;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export function CommerceArrayReimagined() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [view, setView] = useState<"shop" | "cart" | "checkout" | "confirmed">(
    "shop",
  );
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/commerce");
        if (!cancelled && res.ok) setProducts(await res.json());
      } catch {
        if (!cancelled) {
          setProducts([
            {
              id: 1,
              name: "Wireless Mouse",
              description: "Ergonomic wireless mouse",
              priceCents: 2999,
              category: "Electronics",
              inStock: true,
            },
            {
              id: 2,
              name: "Mechanical Keyboard",
              description: "RGB mechanical keyboard",
              priceCents: 8999,
              category: "Electronics",
              inStock: true,
            },
            {
              id: 3,
              name: "Desk Lamp",
              description: "LED adjustable brightness",
              priceCents: 3499,
              category: "Office",
              inStock: true,
            },
            {
              id: 4,
              name: "Monitor Stand",
              description: "Adjustable riser with drawer",
              priceCents: 4499,
              category: "Office",
              inStock: true,
            },
            {
              id: 5,
              name: "USB-C Hub",
              description: "7-in-1 with HDMI",
              priceCents: 4999,
              category: "Electronics",
              inStock: false,
            },
            {
              id: 6,
              name: "Webcam HD",
              description: "1080p with microphone",
              priceCents: 5999,
              category: "Electronics",
              inStock: true,
            },
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = [...new Set(products.map((p) => p.category))];
  const filtered = filter
    ? products.filter((p) => p.category === filter)
    : products;

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.priceCents * item.quantity,
    0,
  );
  const tax = Math.round(subtotal * 0.0825);
  const total = subtotal + tax;

  const placeOrder = () => {
    setView("confirmed");
    setCart([]);
  };

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          [Commerce] Array
          <span className="ml-2 text-sm font-normal text-amber-500">
            Reimagined
          </span>
        </h2>
        <button
          onClick={() => setView(view === "cart" ? "shop" : "cart")}
          className="relative rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {view === "cart" ? "← Shop" : "Cart"}
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {totalItems}
            </span>
          )}
        </button>
      </div>

      {view === "confirmed" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <span className="text-5xl">✅</span>
          <h3 className="text-xl font-bold">Order Confirmed!</h3>
          <p className="text-zinc-500">Thank you for your purchase.</p>
          <button
            onClick={() => setView("shop")}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Continue Shopping
          </button>
        </div>
      )}

      {view === "checkout" && (
        <div className="mx-auto w-full max-w-md space-y-4">
          <h3 className="text-lg font-bold">Checkout</h3>
          <input
            placeholder="Email"
            type="email"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
          <input
            placeholder="Full Name"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
          <input
            placeholder="Address"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="City"
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
            <input
              placeholder="ZIP"
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </div>
          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${(subtotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax (8.25%)</span>
              <span>${(tax / 100).toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between font-bold">
              <span>Total</span>
              <span>${(total / 100).toFixed(2)}</span>
            </div>
          </div>
          <button
            onClick={placeOrder}
            className="w-full rounded bg-green-600 py-2 font-medium text-white"
          >
            Place Order
          </button>
          <button
            onClick={() => setView("cart")}
            className="w-full text-sm text-zinc-500 hover:underline"
          >
            ← Back to cart
          </button>
        </div>
      )}

      {view === "cart" && (
        <div>
          {cart.length === 0 ? (
            <p className="text-zinc-400">Your cart is empty</p>
          ) : (
            <>
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
                  >
                    <div>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-zinc-500">
                        ${(item.product.priceCents / 100).toFixed(2)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="h-8 w-8 rounded bg-zinc-100 dark:bg-zinc-800"
                      >
                        −
                      </button>
                      <span className="font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="h-8 w-8 rounded bg-zinc-100 dark:bg-zinc-800"
                      >
                        +
                      </button>
                      <span className="ml-2 font-bold">
                        $
                        {(
                          (item.product.priceCents * item.quantity) /
                          100
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <span className="text-lg font-bold">
                  Total: ${(subtotal / 100).toFixed(2)}
                </span>
                <button
                  onClick={() => setView("checkout")}
                  className="rounded bg-green-600 px-6 py-2 font-medium text-white"
                >
                  Checkout
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {view === "shop" && (
        <>
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setFilter(null)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${!filter ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-md px-3 py-1 text-sm font-medium ${filter === cat ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex h-32 items-center justify-center bg-linear-to-br from-zinc-50 to-zinc-100 text-4xl dark:from-zinc-800 dark:to-zinc-900">
                  {product.category === "Electronics" ? "🖥️" : "📦"}
                </div>
                <div className="p-4">
                  <h3 className="font-medium">{product.name}</h3>
                  <p className="text-sm text-zinc-500">{product.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold">
                      ${(product.priceCents / 100).toFixed(2)}
                    </span>
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!product.inStock}
                      className="rounded bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {product.inStock ? "Add to Cart" : "Sold Out"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
