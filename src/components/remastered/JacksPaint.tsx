"use client";

import { useRef, useState, useEffect, useCallback } from "react";

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
];

const SIZES = [2, 4, 8, 12, 20];

export function JacksPaint() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(4);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = useCallback(
    (
      e:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      if ("touches" in e) {
        const touch = e.touches[0]!;
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const draw = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    },
    [color, size],
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
    setDrawing(false);
    lastPos.current = null;
  };

  const clear = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center gap-4 p-6">
      <h2 className="text-2xl font-bold">Jack&apos;s Paint</h2>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? "scale-125 border-zinc-900 dark:border-white" : "border-transparent"}`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`flex h-8 w-8 items-center justify-center rounded ${size === s ? "bg-zinc-200 dark:bg-zinc-700" : ""}`}
              aria-label={`Size ${s}`}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: s, height: s }}
              />
            </button>
          ))}
        </div>
        <button
          onClick={clear}
          className="rounded bg-red-100 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
        >
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full max-w-lg flex-1 cursor-crosshair rounded-lg border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900"
        style={{ minHeight: 400, touchAction: "none" }}
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
