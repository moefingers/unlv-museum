"use client";

import { useState, useEffect, useCallback } from "react";

type Direction = "up" | "down" | "left" | "right";
type TileType = "floor" | "wall" | "water" | "lava" | "grass";

interface Position {
  x: number;
  y: number;
}
interface GameItem {
  pos: Position;
  type: "key" | "potion" | "sword" | "shield" | "gem";
  collected: boolean;
  emoji: string;
}
interface NPC {
  pos: Position;
  name: string;
  emoji: string;
  dialogue: string[];
  dialogueIndex: number;
}

const MAP_SIZE = 12;

const TERRAIN: TileType[][] = Array.from({ length: MAP_SIZE }, (_, y) =>
  Array.from({ length: MAP_SIZE }, (_, x) => {
    if (x === 0 || x === MAP_SIZE - 1 || y === 0 || y === MAP_SIZE - 1) {
      if (x === 6 && y === 0) return "floor";
      return "wall";
    }
    if ((x === 4 && y >= 2 && y <= 7) || (x === 8 && y >= 4 && y <= 9))
      return "wall";
    if (x >= 5 && x <= 7 && y >= 5 && y <= 7) return "water";
    if (x === 2 && y === 9) return "lava";
    if (x >= 9 && x <= 10 && y >= 1 && y <= 3) return "grass";
    return "floor";
  }),
);

const TILE_BG: Record<TileType, string> = {
  floor: "bg-zinc-100 dark:bg-zinc-800",
  wall: "bg-zinc-700 dark:bg-zinc-600",
  water: "bg-blue-300 dark:bg-blue-800",
  lava: "bg-red-500 dark:bg-red-700",
  grass: "bg-green-200 dark:bg-green-900",
};

const INITIAL_ITEMS: GameItem[] = [
  { pos: { x: 1, y: 1 }, type: "key", collected: false, emoji: "🔑" },
  { pos: { x: 10, y: 2 }, type: "potion", collected: false, emoji: "🧪" },
  { pos: { x: 2, y: 8 }, type: "sword", collected: false, emoji: "⚔️" },
  { pos: { x: 9, y: 10 }, type: "shield", collected: false, emoji: "🛡️" },
  { pos: { x: 3, y: 3 }, type: "gem", collected: false, emoji: "💎" },
];

const INITIAL_NPCS: NPC[] = [
  {
    pos: { x: 2, y: 2 },
    name: "Old Sage",
    emoji: "🧙",
    dialogue: [
      "Welcome, adventurer!",
      "Find the key to escape.",
      "Beware the lava...",
    ],
    dialogueIndex: 0,
  },
  {
    pos: { x: 10, y: 10 },
    name: "Merchant",
    emoji: "🧑‍💼",
    dialogue: [
      "Trade? I have nothing to sell.",
      "Nice gems you have there.",
      "Good luck out there!",
    ],
    dialogueIndex: 0,
  },
];

export function WebGameReimagined() {
  const [playerPos, setPlayerPos] = useState<Position>({ x: 1, y: 5 });
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [npcs, setNpcs] = useState(INITIAL_NPCS);
  const [inventory, setInventory] = useState<GameItem[]>([]);
  const [hp, setHp] = useState(100);
  const [message, setMessage] = useState(
    "WASD or arrows to move. Talk to NPCs. Collect items. Find the exit!",
  );
  const [won, setWon] = useState(false);
  const [dead, setDead] = useState(false);
  const [steps, setSteps] = useState(0);

  const move = useCallback(
    (dir: Direction) => {
      if (won || dead) return;
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
        const tile = TERRAIN[next.y]?.[next.x];
        if (tile === "wall") return pos;
        if (tile === "water" && !inventory.some((i) => i.type === "shield")) {
          setMessage("You can't swim! Find a shield first.");
          return pos;
        }
        if (tile === "lava") {
          setHp((h) => {
            const newHp = Math.max(0, h - 25);
            if (newHp <= 0) {
              setDead(true);
              setMessage("You died! Try again.");
            } else {
              setMessage("Ouch! Lava burns! -25 HP");
            }
            return newHp;
          });
        }

        if (next.x === 6 && next.y === 0) {
          if (inventory.some((i) => i.type === "key")) {
            setWon(true);
            setMessage(`You escaped in ${steps} steps!`);
          } else {
            setMessage("The exit is locked. Find the key!");
            return pos;
          }
        }

        const npc = npcs.find((n) => n.pos.x === next.x && n.pos.y === next.y);
        if (npc) {
          const line = npc.dialogue[npc.dialogueIndex % npc.dialogue.length]!;
          setMessage(`${npc.name}: "${line}"`);
          setNpcs((prev) =>
            prev.map((n) =>
              n === npc ? { ...n, dialogueIndex: n.dialogueIndex + 1 } : n,
            ),
          );
          return pos;
        }

        const item = items.find(
          (i) => !i.collected && i.pos.x === next.x && i.pos.y === next.y,
        );
        if (item) {
          setItems((prev) =>
            prev.map((i) => (i === item ? { ...i, collected: true } : i)),
          );
          setInventory((prev) => [...prev, item]);
          setMessage(`Found ${item.emoji} ${item.type}!`);
          if (item.type === "potion") setHp((h) => Math.min(100, h + 30));
        }

        setSteps((s) => s + 1);
        return next;
      });
    },
    [items, inventory, npcs, won, dead, steps],
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
    setPlayerPos({ x: 1, y: 5 });
    setItems(INITIAL_ITEMS);
    setNpcs(INITIAL_NPCS);
    setInventory([]);
    setHp(100);
    setSteps(0);
    setWon(false);
    setDead(false);
    setMessage(
      "WASD or arrows to move. Talk to NPCs. Collect items. Find the exit!",
    );
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6">
      <h2 className="text-2xl font-bold">
        Web Game{" "}
        <span className="text-sm font-normal text-amber-500">Reimagined</span>
      </h2>

      <div className="flex items-center gap-4 text-sm">
        <span>
          HP:{" "}
          <span className={hp <= 25 ? "text-red-500 font-bold" : ""}>
            {hp}/100
          </span>
        </span>
        <span>Steps: {steps}</span>
        <span>Items: {inventory.map((i) => i.emoji).join("") || "none"}</span>
      </div>

      <div className="rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
        {TERRAIN.map((row, y) => (
          <div key={y} className="flex">
            {row.map((tile, x) => {
              const isPlayer = playerPos.x === x && playerPos.y === y;
              const item = items.find(
                (i) => !i.collected && i.pos.x === x && i.pos.y === y,
              );
              const npc = npcs.find((n) => n.pos.x === x && n.pos.y === y);
              const isExit = x === 6 && y === 0;
              return (
                <div
                  key={x}
                  className={`flex h-8 w-8 items-center justify-center text-sm ${TILE_BG[tile]}`}
                >
                  {isPlayer
                    ? "🧑"
                    : npc
                      ? npc.emoji
                      : item
                        ? item.emoji
                        : isExit
                          ? "🚪"
                          : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="max-w-md text-center text-sm text-zinc-600 dark:text-zinc-400">
        {message}
      </p>

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

      {(won || dead) && (
        <button
          onClick={reset}
          className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white"
        >
          {won ? "Play Again" : "Retry"}
        </button>
      )}
    </div>
  );
}
