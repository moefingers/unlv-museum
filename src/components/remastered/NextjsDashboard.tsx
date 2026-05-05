"use client";

import { useState } from "react";

interface Invoice {
  id: string;
  customer: string;
  email: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  date: string;
}

const INVOICES: Invoice[] = [
  {
    id: "INV-001",
    customer: "Delba de Oliveira",
    email: "delba@example.com",
    amount: 15795,
    status: "pending",
    date: "2024-06-01",
  },
  {
    id: "INV-002",
    customer: "Lee Robinson",
    email: "lee@example.com",
    amount: 20348,
    status: "paid",
    date: "2024-05-28",
  },
  {
    id: "INV-003",
    customer: "Hector Simpson",
    email: "hector@example.com",
    amount: 3040,
    status: "overdue",
    date: "2024-04-15",
  },
  {
    id: "INV-004",
    customer: "Steven Tey",
    email: "steven@example.com",
    amount: 44800,
    status: "paid",
    date: "2024-05-20",
  },
  {
    id: "INV-005",
    customer: "Steph Dietz",
    email: "steph@example.com",
    amount: 34577,
    status: "pending",
    date: "2024-06-03",
  },
  {
    id: "INV-006",
    customer: "Michael Novotny",
    email: "michael@example.com",
    amount: 8945,
    status: "paid",
    date: "2024-05-10",
  },
];

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  pending:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export function NextjsDashboard() {
  const [search, setSearch] = useState("");

  const filtered = INVOICES.filter(
    (inv) =>
      inv.customer.toLowerCase().includes(search.toLowerCase()) ||
      inv.id.toLowerCase().includes(search.toLowerCase()),
  );

  const totalRevenue = INVOICES.filter((i) => i.status === "paid").reduce(
    (sum, i) => sum + i.amount,
    0,
  );
  const totalPending = INVOICES.filter((i) => i.status === "pending").reduce(
    (sum, i) => sum + i.amount,
    0,
  );
  const totalOverdue = INVOICES.filter((i) => i.status === "overdue").reduce(
    (sum, i) => sum + i.amount,
    0,
  );

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-4 text-2xl font-bold">Dashboard</h2>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="text-sm text-zinc-500">Total Revenue</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            ${(totalRevenue / 100).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="text-sm text-zinc-500">Pending</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            ${(totalPending / 100).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <p className="text-sm text-zinc-500">Overdue</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            ${(totalOverdue / 100).toLocaleString()}
          </p>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search invoices..."
        className="mb-4 w-full rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600 dark:bg-zinc-800"
      />

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
              <th className="px-4 py-3 text-left font-medium">Invoice</th>
              <th className="px-4 py-3 text-left font-medium">Customer</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr
                key={inv.id}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-4 py-3 font-mono">{inv.id}</td>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{inv.customer}</p>
                    <p className="text-xs text-zinc-400">{inv.email}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  ${(inv.amount / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-zinc-500">{inv.date}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status]}`}
                  >
                    {inv.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
