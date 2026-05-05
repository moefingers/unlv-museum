"use client";

import { useState } from "react";

interface Item {
  id: number;
  name: string;
  price: number;
  assignees: string[];
}

export function Divvy() {
  const [items, setItems] = useState<Item[]>([
    { id: 1, name: "Pizza Margherita", price: 18.99, assignees: [] },
    { id: 2, name: "Caesar Salad", price: 12.99, assignees: [] },
    { id: 3, name: "Garlic Bread", price: 6.99, assignees: [] },
    { id: 4, name: "Tiramisu", price: 9.99, assignees: [] },
    { id: 5, name: "Sparkling Water", price: 4.99, assignees: [] },
  ]);
  const [people, setPeople] = useState(["Alice", "Bob", "Charlie"]);
  const [newPerson, setNewPerson] = useState("");
  const [newItem, setNewItem] = useState({ name: "", price: "" });

  const toggleAssignment = (itemId: number, person: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              assignees: item.assignees.includes(person)
                ? item.assignees.filter((a) => a !== person)
                : [...item.assignees, person],
            }
          : item,
      ),
    );
  };

  const addPerson = () => {
    if (newPerson.trim() && !people.includes(newPerson.trim())) {
      setPeople([...people, newPerson.trim()]);
      setNewPerson("");
    }
  };

  const addItem = () => {
    if (newItem.name && newItem.price) {
      setItems([
        ...items,
        {
          id: Math.max(...items.map((i) => i.id), 0) + 1,
          name: newItem.name,
          price: parseFloat(newItem.price),
          assignees: [],
        },
      ]);
      setNewItem({ name: "", price: "" });
    }
  };

  const getPersonTotal = (person: string) => {
    return items.reduce((total, item) => {
      if (item.assignees.includes(person)) {
        return total + item.price / item.assignees.length;
      }
      return total;
    }, 0);
  };

  const grandTotal = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-4 text-2xl font-bold">Divvy</h2>

      <div className="mb-4 flex gap-2">
        <input
          value={newPerson}
          onChange={(e) => setNewPerson(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addPerson()}
          placeholder="Add person"
          className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
        <button
          onClick={addPerson}
          className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
              <th className="px-4 py-2 text-left font-medium">Item</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              {people.map((person) => (
                <th key={person} className="px-4 py-2 text-center font-medium">
                  {person}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-4 py-2">{item.name}</td>
                <td className="px-4 py-2 text-right font-mono">
                  ${item.price.toFixed(2)}
                </td>
                {people.map((person) => (
                  <td key={person} className="px-4 py-2 text-center">
                    <button
                      onClick={() => toggleAssignment(item.id, person)}
                      className={`h-6 w-6 rounded border-2 transition-colors ${
                        item.assignees.includes(person)
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-zinc-300 dark:border-zinc-600"
                      }`}
                    >
                      {item.assignees.includes(person) && "✓"}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-50 font-medium dark:bg-zinc-800">
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right font-mono">
                ${grandTotal.toFixed(2)}
              </td>
              {people.map((person) => (
                <td key={person} className="px-4 py-2 text-center font-mono">
                  ${getPersonTotal(person).toFixed(2)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={newItem.name}
          onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          placeholder="Item name"
          className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
        <input
          value={newItem.price}
          onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
          placeholder="Price"
          type="number"
          step="0.01"
          className="w-24 rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
        <button
          onClick={addItem}
          className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add Item
        </button>
      </div>
    </div>
  );
}
