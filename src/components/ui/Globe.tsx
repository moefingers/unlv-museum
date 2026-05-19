"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import styles from "./Globe.module.css";

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
const POLE_LIMIT = 60;

function bounceX(x: number): { x: number; flipped: boolean } {
  let flipped = false;
  while (x > POLE_LIMIT || x < -POLE_LIMIT) {
    if (x > POLE_LIMIT) {
      x = 2 * POLE_LIMIT - x;
      flipped = !flipped;
    }
    if (x < -POLE_LIMIT) {
      x = -2 * POLE_LIMIT - x;
      flipped = !flipped;
    }
  }
  return { x, flipped };
}

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

  /*
   * Position state, keyed by item.id. The card at id X always reads its
   * transform from positionById[X] — never from its index in `items`.
   *
   * Why state and not inline compute: when transforms change inline within
   * a single React render commit, the browser collapses old→new into one
   * paint and the CSS transition has no two-value delta to interpolate.
   * Splitting "DOM order change" from "transform value change" into two
   * separate commits gives the browser two distinct paints to animate
   * between.
   *
   * The signature (joined ids) detects ACTUAL order changes — referential
   * `items` inequality alone would re-fire every parent render and loop.
   * `points` is memoized on length for the same reason.
   */
  const points = useMemo(() => fibonacci(items.length), [items.length]);
  const itemsSignature = items.map((it) => it.id).join("|");

  const [positionById, setPositionById] = useState(() => {
    const map: Record<string, { lon: number; lat: number }> = {};
    items.forEach((item, i) => {
      const p = points[i];
      if (p) map[item.id] = p;
    });
    return map;
  });

  useEffect(() => {
    // Two-phase paint to make the CSS transition fire:
    //  - Phase 1 (this commit): the DOM tree reflects the new `items`
    //    order, but each card still holds its OLD positionById transform.
    //  - Phase 2 (next animation frame): we set the new positions; React
    //    re-renders; the transform value delta is spread across two
    //    paints and the browser interpolates via the transition.
    //
    // Scheduling the state update inside requestAnimationFrame instead of
    // synchronously here keeps the linter happy (avoids the "setState in
    // effect body" warning) AND is functionally identical for our needs.
    // The itemsSignature dep gates the effect to ACTUAL order changes;
    // referential items inequality alone would re-fire every parent
    // render and infinite-loop.
    const map: Record<string, { lon: number; lat: number }> = {};
    items.forEach((item, i) => {
      const p = points[i];
      if (p) map[item.id] = p;
    });
    const frame = requestAnimationFrame(() => setPositionById(map));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSignature, points]);

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

          const rawX = targetX.current - amplitudeX.current * decay;
          const { x: bouncedX, flipped } = bounceX(rawX);
          if (flipped) {
            amplitudeX.current = -amplitudeX.current;
            targetX.current = 2 * bouncedX - targetX.current;
          }

          applyRotation({
            x: bouncedX,
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
      const { x: bx } = bounceX(r.x - dy * 0.3);
      applyRotation({ x: bx, y: r.y + dx * 0.3 });
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
    targetX.current = r.x + amplitudeX.current;
    releaseTime.current = performance.now();
  }, []);

  return (
    <div
      className={styles.stage}
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
        className={styles.center}
        style={{
          transformStyle: "preserve-3d",
          transform: "rotateZ(-18deg)",
        }}
      >
        <div
          className={styles.center}
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          }}
        >
          {items.map((item) => {
            // Read this card's position from state keyed by id, not from its
            // index in `items`. The position state lags one render behind
            // `items` (via the useEffect above) so transforms change in a
            // separate paint and CSS transitions actually fire.
            const point = positionById[item.id];
            if (!point) return null;

            return (
              <div
                key={item.id}
                className={styles.item}
                style={{
                  transformStyle: "preserve-3d",
                  transform: `rotateY(${point.lon}deg) rotateX(${-point.lat}deg) translateZ(${radius}px)`,
                }}
              >
                <div
                  style={{
                    transform: "translate(-88px, -36px)",
                    transformStyle: "preserve-3d",
                    backfaceVisibility: "hidden",
                  }}
                >
                  {item.node}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
