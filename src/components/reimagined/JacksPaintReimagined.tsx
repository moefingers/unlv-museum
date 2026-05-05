"use client";

import { useRef, useState, useEffect, useCallback } from "react";

type Tool = "brush" | "eraser" | "fill" | "line";

const COLORS = [
  "#000000",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
  "#7c3aed",
  "#0ea5e9",
  "#14b8a6",
  "#84cc16",
  "#f43f5e",
];

const SIZES = [1, 2, 4, 8, 12, 20, 32];

export function JacksPaintReimagined() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(4);
  const [tool, setTool] = useState<Tool>("brush");
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  const saveHistory = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), data]);
    setHistoryIndex((i) => i + 1);
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex <= 0) return;
    const ctx = getCtx();
    if (!ctx) return;
    const newIndex = historyIndex - 1;
    const data = history[newIndex];
    if (data) ctx.putImageData(data, 0, 0);
    setHistoryIndex(newIndex);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const ctx = getCtx();
    if (!ctx) return;
    const newIndex = historyIndex + 1;
    const data = history[newIndex];
    if (data) ctx.putImageData(data, 0, 0);
    setHistoryIndex(newIndex);
  };

  const getPos = useCallback(
    (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ("touches" in e) {
        const touch = e.touches[0]!;
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [],
  );

  const draw = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = getCtx();
      if (!ctx) return;
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation =
        tool === "eraser" ? "destination-out" : "source-over";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    },
    [color, size, tool],
  );

  const handleStart = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const handleMove = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!drawing || !lastPos.current) return;
    e.preventDefault();
    const pos = getPos(e);
    draw(lastPos.current, pos);
    lastPos.current = pos;
  };

  const handleEnd = () => {
    if (drawing) saveHistory();
    setDrawing(false);
    lastPos.current = null;
  };

  const clear = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "painting.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 800, 600);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([data]);
    setHistoryIndex(0);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const tools: { id: Tool; label: string; icon: string }[] = [
    { id: "brush", label: "Brush", icon: "🖌️" },
    { id: "eraser", label: "Eraser", icon: "🧹" },
  ];

  return (
    <div className="flex min-h-[60vh] flex-col items-center gap-4 p-6">
      <h2 className="text-2xl font-bold">
        Jack&apos;s Paint
        <span className="ml-2 text-sm font-normal text-amber-500">
          Reimagined
        </span>
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`rounded px-2 py-1 text-sm ${tool === t.id ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 ${color === c ? "scale-125 border-zinc-900 dark:border-white" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`flex h-8 w-8 items-center justify-center rounded ${size === s ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: Math.min(s, 16), height: Math.min(s, 16) }}
              />
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="rounded bg-zinc-100 px-2 py-1 text-sm disabled:opacity-30 dark:bg-zinc-800"
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="rounded bg-zinc-100 px-2 py-1 text-sm disabled:opacity-30 dark:bg-zinc-800"
          >
            Redo
          </button>
          <button
            onClick={clear}
            className="rounded bg-red-100 px-2 py-1 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400"
          >
            Clear
          </button>
          <button
            onClick={exportImage}
            className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          >
            Export PNG
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full max-w-3xl cursor-crosshair rounded-lg border border-zinc-300 dark:border-zinc-600"
        style={{ aspectRatio: "4/3", touchAction: "none" }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </div>
  );
}
