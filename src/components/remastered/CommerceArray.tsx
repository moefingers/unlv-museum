"use client";

import { useState } from "react";

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  inStock: boolean;
}

const PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Wireless Mouse",
    price: 29.99,
    category: "Electronics",
    description: "Ergonomic wireless mouse with USB receiver",
    inStock: true,
  },
  {
    id: 2,
    name: "Mechanical Keyboard",
    price: 89.99,
    category: "Electronics",
    description: "RGB mechanical keyboard with Cherry MX switches",
    inStock: true,
  },
  {
    id: 3,
    name: "USB-C Hub",
    price: 49.99,
    category: "Electronics",
    description: "7-in-1 USB-C hub with HDMI and Ethernet",
    inStock: false,
  },
  {
    id: 4,
    name: "Desk Lamp",
    price: 34.99,
    category: "Office",
    description: "LED desk lamp with adjustable brightness",
    inStock: true,
  },
  {
    id: 5,
    name: "Notebook Set",
    price: 12.99,
    category: "Office",
    description: "Pack of 3 lined notebooks, 100 pages each",
    inStock: true,
  },
  {
    id: 6,
    name: "Monitor Stand",
    price: 44.99,
    category: "Office",
    description: "Adjustable monitor riser with storage drawer",
    inStock: true,
  },
  {
    id: 7,
    name: "Webcam HD",
    price: 59.99,
    category: "Electronics",
    description: "1080p webcam with built-in microphone",
    inStock: true,
  },
  {
    id: 8,
    name: "Cable Organizer",
    price: 14.99,
    category: "Office",
    description: "Silicone cable management clips, pack of 5",
    inStock: true,
  },
];

interface CartItem {
  product: Product;
  quantity: number;
}

export function CommerceArray() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const categories = [...new Set(PRODUCTS.map((p) => p.category))];
  const filtered = filter
    ? PRODUCTS.filter((p) => p.category === filter)
    : PRODUCTS;

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

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">[Commerce] Array</h2>
        <button
          onClick={() => setShowCart(!showCart)}
          className="relative rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Cart
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {totalItems}
            </span>
          )}
        </button>
      </div>

      {showCart ? (
        <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
          <h3 className="mb-4 text-lg font-bold">Shopping Cart</h3>
          {cart.length === 0 ? (
            <p className="text-zinc-400">Your cart is empty</p>
          ) : (
            <>
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between rounded border border-zinc-100 p-3 dark:border-zinc-800"
                  >
                    <div>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-zinc-500">
                        ${item.product.price.toFixed(2)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold">
                        ${(item.product.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <span className="text-lg font-bold">Total</span>
                <span className="text-lg font-bold">
                  ${totalPrice.toFixed(2)}
                </span>
              </div>
            </>
          )}
          <button
            onClick={() => setShowCart(false)}
            className="mt-4 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Continue Shopping
          </button>
        </div>
      ) : (
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
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
              >
                <div className="mb-2 flex h-24 items-center justify-center rounded bg-zinc-50 text-4xl dark:bg-zinc-800">
                  {product.category === "Electronics" ? "🖥️" : "📦"}
                </div>
                <h3 className="font-medium">{product.name}</h3>
                <p className="text-sm text-zinc-500">{product.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-lg font-bold">
                    ${product.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => addToCart(product)}
                    disabled={!product.inStock}
                    className="rounded bg-zinc-900 px-3 py-1 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {product.inStock ? "Add to Cart" : "Out of Stock"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
