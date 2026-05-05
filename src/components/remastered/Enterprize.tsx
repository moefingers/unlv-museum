"use client";

import { useState } from "react";

interface Entity {
  id: number;
  name: string;
  type: "department" | "team" | "asset";
  parentId: number | null;
  metadata: Record<string, string>;
}

const ENTITIES: Entity[] = [
  {
    id: 1,
    name: "Engineering",
    type: "department",
    parentId: null,
    metadata: { head: "Sarah Chen", budget: "$2.4M" },
  },
  {
    id: 2,
    name: "Frontend Team",
    type: "team",
    parentId: 1,
    metadata: { lead: "Alex Rivera", size: "8" },
  },
  {
    id: 3,
    name: "Backend Team",
    type: "team",
    parentId: 1,
    metadata: { lead: "Jordan Park", size: "6" },
  },
  {
    id: 4,
    name: 'MacBook Pro 16"',
    type: "asset",
    parentId: 2,
    metadata: { serial: "FVFXM3KDQH", assignee: "Dev Workstation #1" },
  },
  {
    id: 5,
    name: "Marketing",
    type: "department",
    parentId: null,
    metadata: { head: "Lisa Wong", budget: "$1.8M" },
  },
  {
    id: 6,
    name: "Content Team",
    type: "team",
    parentId: 5,
    metadata: { lead: "Mia Thompson", size: "4" },
  },
  {
    id: 7,
    name: "Design Team",
    type: "team",
    parentId: 5,
    metadata: { lead: "Chris Lee", size: "3" },
  },
  {
    id: 8,
    name: "Adobe CC License",
    type: "asset",
    parentId: 7,
    metadata: { seats: "5", renewal: "2025-03-01" },
  },
];

const TYPE_STYLES: Record<string, string> = {
  department:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  team: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  asset: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export function Enterprize() {
  const [selected, setSelected] = useState<Entity | null>(null);
  const [view, setView] = useState<"tree" | "list">("tree");

  const getChildren = (parentId: number | null) =>
    ENTITIES.filter((e) => e.parentId === parentId);

  const renderTree = (
    parentId: number | null,
    depth: number = 0,
  ): React.ReactNode => {
    const children = getChildren(parentId);
    return children.map((entity) => (
      <div key={entity.id} style={{ marginLeft: depth * 24 }}>
        <button
          onClick={() => setSelected(entity)}
          className={`mb-1 flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors ${selected?.id === entity.id ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}
        >
          <span className="text-sm">
            {entity.type === "department"
              ? "🏢"
              : entity.type === "team"
                ? "👥"
                : "💻"}
          </span>
          <span className="flex-1 text-sm font-medium">{entity.name}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-xs ${TYPE_STYLES[entity.type]}`}
          >
            {entity.type}
          </span>
        </button>
        {renderTree(entity.id, depth + 1)}
      </div>
    ));
  };

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">EnterPrize</h2>
        <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            onClick={() => setView("tree")}
            className={`rounded-md px-3 py-1 text-sm font-medium ${view === "tree" ? "bg-white shadow-sm dark:bg-zinc-700" : ""}`}
          >
            Tree
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded-md px-3 py-1 text-sm font-medium ${view === "list" ? "bg-white shadow-sm dark:bg-zinc-700" : ""}`}
          >
            List
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          {view === "tree" ? (
            renderTree(null)
          ) : (
            <div className="space-y-1">
              {ENTITIES.map((entity) => (
                <button
                  key={entity.id}
                  onClick={() => setSelected(entity)}
                  className={`flex w-full items-center justify-between rounded p-2 text-left ${selected?.id === entity.id ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"}`}
                >
                  <span className="text-sm font-medium">{entity.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${TYPE_STYLES[entity.type]}`}
                  >
                    {entity.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          {selected ? (
            <div>
              <h3 className="text-lg font-bold">{selected.name}</h3>
              <span
                className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${TYPE_STYLES[selected.type]}`}
              >
                {selected.type}
              </span>
              <div className="mt-4 space-y-2">
                {Object.entries(selected.metadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="capitalize text-zinc-500">{key}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
              {getChildren(selected.id).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-zinc-400">Children</p>
                  {getChildren(selected.id).map((child) => (
                    <p key={child.id} className="text-sm">
                      {child.name}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-zinc-400">Select an entity to view details</p>
          )}
        </div>
      </div>
    </div>
  );
}
