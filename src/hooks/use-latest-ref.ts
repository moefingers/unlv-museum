"use client";

import { useEffect, useRef } from "react";

/**
 * Mirror a reactive value (state/prop) into a ref so side-effect
 * callbacks (rAF ticks, pointer-event handlers, etc.) can read the
 * LATEST value without depending on it — listing the value as a
 * dep would re-create the callback on every change, which we don't
 * want for hot paths like rAF loops or memoized handlers.
 *
 * The underlying pattern is "useRef + useEffect to sync"; this hook
 * names the pattern so callsites don't redeclare it inline.
 *
 * Trade-off vs. always reading state directly: a one-frame lag is
 * possible if a callback runs in the same render commit that
 * changed the value, because the effect hasn't synced yet. Acceptable
 * for the loop/handler use cases here, where "latest plus a frame"
 * is indistinguishable from "latest" to the eye.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
