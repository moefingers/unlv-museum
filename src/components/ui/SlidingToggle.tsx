"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import styles from "./LandingView.module.css";

/*
 * Segmented-pill toggle with a sliding background indicator that
 * RESIZES to match the active button's width as well as repositions.
 *
 * Architecture:
 *   - Buttons are children rendered by the caller; each is given
 *     a ref via the `registerButtonRef` callback the caller wires up.
 *   - A useLayoutEffect reads the active button's offsetLeft and
 *     offsetWidth (post-layout, pre-paint) and writes them into
 *     local state.
 *   - The indicator div renders with those measured values as inline
 *     `left` and `width` styles. CSS transitions on those two
 *     properties carry the slide + width morph across active-state
 *     changes.
 *
 * Why useLayoutEffect (not useEffect): we want the indicator to
 * paint at the measured position immediately on render. useEffect
 * fires after paint, which would cause a one-frame flash where the
 * indicator is at its previous position before snapping. With
 * useLayoutEffect the measurement happens between layout and paint
 * so the user only sees the final position.
 *
 * Re-measurement triggers:
 *   - `activeKey` changes (the user toggled to a different button)
 *   - Layout could also shift when the parent resizes; we re-measure
 *     on a window resize listener.
 */

export interface SlidingToggleProps<K extends string> {
  /** Stable key for the currently-active button. */
  activeKey: K;
  /**
   * Render-prop children: caller passes a function that returns
   * the buttons. We pass back a `registerRef` that the caller
   * binds to each button's `ref` so we can measure positions.
   * Caller is responsible for the actual button content + onClick.
   */
  children: (
    registerRef: (key: K, el: HTMLButtonElement | null) => void,
  ) => ReactNode;
}

export function SlidingToggle<K extends string>({
  activeKey,
  children,
}: SlidingToggleProps<K>) {
  const buttonRefs = useRef<Map<K, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  const registerRef = useCallback((key: K, el: HTMLButtonElement | null) => {
    if (el) {
      buttonRefs.current.set(key, el);
    } else {
      buttonRefs.current.delete(key);
    }
  }, []);

  // Re-measure whenever activeKey changes. offsetLeft/offsetWidth
  // are relative to the offsetParent — `.viewToggle` is
  // `position: relative` so it IS the offsetParent for its
  // children; the indicator (also a child of `.viewToggle`) uses
  // the same coordinate space. So we can write these values
  // directly without further math.
  useLayoutEffect(() => {
    const btn = buttonRefs.current.get(activeKey);
    if (!btn) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [activeKey]);

  // Re-measure on window resize. Buttons can change width when the
  // viewport changes (e.g. via responsive font scaling) and the
  // indicator should track. ResizeObserver on the container would
  // be more precise but a window listener is enough for the
  // museum's needs and avoids the observer setup cost.
  useLayoutEffect(() => {
    const onResize = () => {
      const btn = buttonRefs.current.get(activeKey);
      if (!btn) return;
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeKey]);

  return (
    <div className={styles.viewToggle} ref={containerRef}>
      <div
        className={styles.viewToggleIndicator}
        style={
          {
            left: `${indicator.left}px`,
            width: `${indicator.width}px`,
          } as CSSProperties
        }
        aria-hidden="true"
      />
      {/*
        registerRef is a stable callback (useCallback above). React 19's
        react-hooks/refs lint can't tell that the callback is invoked
        LATER (during commit, via React's ref-setter mechanism) rather
        than during this render — it just sees the callback being passed
        and flags it because the callback's body touches a ref. Disable
        is intentional; the closure is safe.
      */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {children(registerRef)}
    </div>
  );
}
