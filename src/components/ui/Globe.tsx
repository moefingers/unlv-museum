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
  const points: { lon: number; lat: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = ((goldenAngle * i * 180) / Math.PI) % 360;
    points.push({ lon, lat });
  }

  return points;
}

const AUTO_SPEED = 0.08;
const TIME_CONSTANT = 600;
const VELOCITY_THRESHOLD = 0.5;

export function Globe({ items, radius = 340 }: GlobeProps) {
  const [rotation, setRotation] = useState({ x: -15, y: 0 });
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const lastTime = useRef(0);
  const didDrag = useRef(false);
  const velocityY = useRef(0);
  const velocityX = useRef(0);
  const releaseTime = useRef(0);
  const amplitudeY = useRef(0);
  const amplitudeX = useRef(0);
  const targetY = useRef(0);
  const targetX = useRef(0);
  const latestRotation = useRef({ x: -15, y: 0 });

  const points = fibonacci(items.length);

  const applyRotation = useCallback((r: { x: number; y: number }) => {
    latestRotation.current = r;
    setRotation(r);
  }, []);

  useEffect(() => {
    let lastTick = performance.now();
    let frame: number;

    function tick(now: number) {
      const dt = now - lastTick;
      lastTick = now;

      if (!dragging.current) {
        const speed =
          Math.abs(amplitudeY.current) + Math.abs(amplitudeX.current);

        if (speed > VELOCITY_THRESHOLD) {
          const elapsed = now - releaseTime.current;
          const decay = Math.exp(-elapsed / TIME_CONSTANT);

          applyRotation({
            x: Math.max(
              -60,
              Math.min(60, targetX.current - amplitudeX.current * decay),
            ),
            y: targetY.current - amplitudeY.current * decay,
          });

          if (
            Math.abs(amplitudeY.current * decay) < 0.1 &&
            Math.abs(amplitudeX.current * decay) < 0.1
          ) {
            amplitudeY.current = 0;
            amplitudeX.current = 0;
          }
        } else {
          const r = latestRotation.current;
          applyRotation({
            ...r,
            y: r.y + AUTO_SPEED * (dt / 16),
          });
        }
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [applyRotation]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    didDrag.current = false;
    velocityX.current = 0;
    velocityY.current = 0;
    amplitudeX.current = 0;
    amplitudeY.current = 0;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    lastTime.current = performance.now();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;

      const now = performance.now();
      const dt = now - lastTime.current;
      if (dt === 0) return;

      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;

      lastMouse.current = { x: e.clientX, y: e.clientY };
      lastTime.current = now;

      const vxNow = (1000 * dx) / (1 + dt);
      const vyNow = (1000 * dy) / (1 + dt);
      velocityY.current = 0.8 * vxNow + 0.2 * velocityY.current;
      velocityX.current = 0.8 * vyNow + 0.2 * velocityX.current;

      const r = latestRotation.current;
      applyRotation({
        x: Math.max(-60, Math.min(60, r.x - dy * 0.3)),
        y: r.y + dx * 0.3,
      });
    },
    [applyRotation],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;

    if (performance.now() - lastTime.current > 50) {
      velocityY.current = 0;
      velocityX.current = 0;
    }

    const r = latestRotation.current;
    amplitudeY.current = (velocityY.current * TIME_CONSTANT) / 1000;
    amplitudeX.current = (-velocityX.current * TIME_CONSTANT) / 1000;
    targetY.current = r.y + amplitudeY.current;
    targetX.current = Math.max(-60, Math.min(60, r.x + amplitudeX.current));
    releaseTime.current = performance.now();
  }, []);

  return (
    <div
      className="relative mx-auto select-none overflow-hidden"
      style={{
        width: radius * 2 + 200,
        height: radius * 2 + 200,
        perspective: "1200px",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClickCapture={(e) => {
        if (didDrag.current) e.preventDefault();
      }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
        }}
      >
        {items.map((item, i) => {
          const point = points[i];
          if (!point) return null;

          return (
            <div
              key={item.id}
              className="absolute"
              style={{
                transformStyle: "preserve-3d",
                transform: `rotateY(${point.lon}deg) rotateX(${-point.lat}deg) translateZ(${radius}px)`,
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
    </div>
  );
}
