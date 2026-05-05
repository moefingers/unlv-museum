"use client";

import { useState, useEffect, useCallback } from "react";

type Direction = "up" | "down" | "left" | "right";

interface Position {
  x: number;
  y: number;
}

interface GameItem {
  pos: Position;
  type: "key" | "potion" | "sword";
  collected: boolean;
}

const MAP_SIZE = 8;

const TERRAIN: string[][] = Array.from({ length: MAP_SIZE }, (_, y) =>
  Array.from({ length: MAP_SIZE }, (_, x) => {
    if (
      (x === 0 || x === MAP_SIZE - 1 || y === 0 || y === MAP_SIZE - 1) &&
      !(x === 4 && y === 0)
    )
      return "wall";
    if ((x === 3 && y >= 2 && y <= 5) || (x === 5 && y >= 3 && y <= 6))
      return "wall";
    return "floor";
  }),
);

const INITIAL_ITEMS: GameItem[] = [
  { pos: { x: 1, y: 1 }, type: "key", collected: false },
  { pos: { x: 6, y: 2 }, type: "potion", collected: false },
  { pos: { x: 2, y: 6 }, type: "sword", collected: false },
];

const TILE_EMOJI: Record<string, string> = {
  wall: "🧱",
  floor: "",
  player: "🧑",
  key: "🔑",
  potion: "🧪",
  sword: "⚔️",
  exit: "🚪",
};

export function WebGame() {
  const [playerPos, setPlayerPos] = useState<Position>({ x: 1, y: 3 });
  const [items, setItems] = useState<GameItem[]>(INITIAL_ITEMS);
  const [inventory, setInventory] = useState<string[]>([]);
  const [message, setMessage] = useState(
    "Use arrow keys or WASD to move. Collect items!",
  );
  const [won, setWon] = useState(false);

  const move = useCallback(
    (dir: Direction) => {
      if (won) return;
      setPlayerPos((pos) => {
        const next = { ...pos };
        if (dir === "up") next.y--;
        if (dir === "down") next.y++;
        if (dir === "left") next.x--;
        if (dir === "right") next.x++;

        if (
          next.x < 0 ||
          next.x >= MAP_SIZE ||
          next.y < 0 ||
          next.y >= MAP_SIZE
        )
          return pos;
        if (TERRAIN[next.y]?.[next.x] === "wall") return pos;

        if (next.x === 4 && next.y === 0) {
          if (inventory.includes("key")) {
            setWon(true);
            setMessage("You escaped! You win!");
          } else {
            setMessage("The door is locked. Find the key!");
            return pos;
          }
        }

        const item = items.find(
          (i) => !i.collected && i.pos.x === next.x && i.pos.y === next.y,
        );
        if (item) {
          setItems((prev) =>
            prev.map((i) => (i === item ? { ...i, collected: true } : i)),
          );
          setInventory((prev) => [...prev, item.type]);
          setMessage(`Picked up ${TILE_EMOJI[item.type]} ${item.type}!`);
        }

        return next;
      });
    },
    [items, inventory, won],
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
        W: "up",
        S: "down",
        A: "left",
        D: "right",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        move(dir);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [move]);

  const reset = () => {
    setPlayerPos({ x: 1, y: 3 });
    setItems(INITIAL_ITEMS);
    setInventory([]);
    setMessage("Use arrow keys or WASD to move. Collect items!");
    setWon(false);
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-2xl font-bold">Web Game</h2>

      <div className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
        {TERRAIN.map((row, y) => (
          <div key={y} className="flex">
            {row.map((tile, x) => {
              const isPlayer = playerPos.x === x && playerPos.y === y;
              const item = items.find(
                (i) => !i.collected && i.pos.x === x && i.pos.y === y,
              );
              const isExit = x === 4 && y === 0;

              return (
                <div
                  key={x}
                  className={`flex h-10 w-10 items-center justify-center text-lg ${
                    tile === "wall"
                      ? "bg-zinc-700"
                      : "bg-zinc-100 dark:bg-zinc-800"
                  }`}
                >
                  {isPlayer
                    ? TILE_EMOJI.player
                    : item
                      ? TILE_EMOJI[item.type]
                      : isExit
                        ? TILE_EMOJI.exit
                        : TILE_EMOJI[tile]}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>

      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          <span className="text-xs text-zinc-400">Inventory:</span>
          {inventory.length === 0 ? (
            <span className="text-xs text-zinc-400">empty</span>
          ) : (
            inventory.map((item, i) => (
              <span key={i} className="text-lg">
                {TILE_EMOJI[item]}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Mobile controls */}
      <div className="grid grid-cols-3 gap-1 sm:hidden">
        <div />
        <button
          onClick={() => move("up")}
          className="rounded bg-zinc-200 p-2 dark:bg-zinc-700"
        >
          ↑
        </button>
        <div />
        <button
          onClick={() => move("left")}
          className="rounded bg-zinc-200 p-2 dark:bg-zinc-700"
        >
          ←
        </button>
        <button
          onClick={() => move("down")}
          className="rounded bg-zinc-200 p-2 dark:bg-zinc-700"
        >
          ↓
        </button>
        <button
          onClick={() => move("right")}
          className="rounded bg-zinc-200 p-2 dark:bg-zinc-700"
        >
          →
        </button>
      </div>

      {won && (
        <button
          onClick={reset}
          className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white"
        >
          Play Again
        </button>
      )}
    </div>
  );
}
