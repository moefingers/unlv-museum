"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

interface GlobeProps {
  items: { id: string; node: ReactNode }[];
  radius?: number;
}

function fibonacci(count: number) {
  const points: { theta: number; phi: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    const phi = Math.asin(y);

    points.push({
      theta: theta % (2 * Math.PI),
      phi,
    });
  }

  return points;
}

export function Globe({ items, radius = 340 }: GlobeProps) {
  const [rotation, setRotation] = useState({ x: -15, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const lastMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const points = fibonacci(items.length);

  useEffect(() => {
    if (!autoRotate || dragging) return;
    const frame = setInterval(() => {
      setRotation((r) => ({ ...r, y: r.y + 0.15 }));
    }, 16);
    return () => clearInterval(frame);
  }, [autoRotate, dragging]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    setAutoRotate(false);
    lastMouse.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setRotation((r) => ({
        x: Math.max(-60, Math.min(60, r.x - dy * 0.3)),
        y: r.y + dx * 0.3,
      }));
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto select-none"
      style={{
        width: radius * 2 + 200,
        height: radius * 2 + 200,
        perspective: "1200px",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transition: dragging ? "none" : "transform 0.05s linear",
        }}
      >
        {items.map((item, i) => {
          const point = points[i];
          if (!point) return null;

          const x = radius * Math.cos(point.phi) * Math.cos(point.theta);
          const y = radius * Math.sin(point.phi);
          const z = radius * Math.cos(point.phi) * Math.sin(point.theta);

          const thetaDeg = (point.theta * 180) / Math.PI;
          const phiDeg = (point.phi * 180) / Math.PI;

          return (
            <div
              key={item.id}
              className="absolute left-1/2 top-1/2"
              style={{
                transformStyle: "preserve-3d",
                transform: `translate3d(${x}px, ${-y}px, ${z}px) rotateY(${thetaDeg}deg) rotateX(${-phiDeg}deg)`,
              }}
            >
              <div
                className="-translate-x-1/2 -translate-y-1/2"
                style={{ backfaceVisibility: "hidden" }}
              >
                {item.node}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setAutoRotate(!autoRotate)}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-zinc-100/80 px-3 py-1 text-xs text-zinc-500 backdrop-blur transition-colors hover:text-zinc-900 dark:bg-zinc-800/80 dark:hover:text-zinc-100"
      >
        {autoRotate ? "Pause" : "Spin"}
      </button>
    </div>
  );
}
