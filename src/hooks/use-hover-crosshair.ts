"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLatestRef } from "@/hooks/use-latest-ref";

/*
 * Touch hover-mode crosshair gesture state machine.
 *
 * For the interaction story, multi-finger lift hesitation +
 * prevPos race-write undo, duplicate-pointerup guard, tuning
 * constants, and "don't break these" invariants, see
 * CONTEXT/internal_docs/hover-crosshair.md.
 *
 * In short: each finger is a hover cursor, not a drag-grab. The
 * crosshair tracks the centroid of all active fingers; the vertex
 * nearest engages. A quick tap commits; a drag-preview fades.
 * Multi-finger lifts get a 60ms hesitation window so near-
 * simultaneous lifts don't snap to whichever finger lingered.
 */

// Linger (post-release fade) duration. The crosshair stays visible
// for this many ms after the last finger lifts, fading via CSS
// opacity transition. Gives visual confirmation that the gesture
// registered before unmount.
const CROSSHAIR_LINGER_MS = 1000;
// Tap classification: a gesture qualifies as a tap (engages the
// nearest vertex on lift) if duration < TAP_MAX_MS AND total
// movement < TAP_MAX_PX. Otherwise it's a drag-preview and just
// fades.
const TAP_MAX_MS = 400;
const TAP_MAX_PX = 20;
// Engagement radius for the centroid → vertex match (in viewBox
// units, same space as projected vertex coords).
const CROSSHAIR_ENGAGEMENT_RADIUS = 60;
// Multi-finger lift hesitation window. See class docstring above.
const POINTERUP_HESITATION_MS = 60;

interface CrosshairGesture {
  /** Latest crosshair position in viewBox units (read on pointerup
   *  to find the nearest vertex). null while no gesture is active. */
  pos: { x: number; y: number } | null;
  /** Position from BEFORE the most recent writeCrosshair. Used by
   *  pointerup to undo a race-corrupted pointermove write (centroid
   *  computed using a finger that was physically lifting but hadn't
   *  yet sent pointerup, dragging the crosshair toward whichever
   *  finger remained). */
  prevPos: { x: number; y: number } | null;
  /** performance.now() at the first pointerdown of this gesture. */
  startedAt: number;
  /** Client-coord position at first pointerdown — used to measure
   *  total gesture movement for tap-vs-drag classification. */
  startPos: { x: number; y: number } | null;
  /** Max distance the centroid traveled from startPos during this
   *  gesture (px). */
  maxMovement: number;
  /** Active post-release linger fade-out timer. */
  lingerTimer: ReturnType<typeof setTimeout> | null;
  /** Active multi-finger-lift hesitation timer. See docstring. */
  pendingLift: ReturnType<typeof setTimeout> | null;
}

interface CrosshairView {
  /** Mount/unmount gate for the SVG <g>. */
  visible: boolean;
  /** Post-release fade — true during the linger window between
   *  pointerup and unmount. (Currently set imperatively via
   *  writeCrosshairOpacity; kept in React state for completeness.) */
  releasing: boolean;
  /** Position captured when the crosshair became visible. Used as
   *  the SVG <g>'s initial transform at mount; subsequent moves
   *  bypass React via writeCrosshair → style.transform. */
  initialX: number;
  initialY: number;
}

/**
 * Centroid descriptor — supplied by the parent's multi-pointer
 * abstraction. Same shape as PolyhedronGlobe.pointerCentroid().
 */
interface Centroid {
  x: number;
  y: number;
  radius: number;
  count: number;
}

export interface UseHoverCrosshairConfig {
  /** Live touch mode — the hook is dormant unless this is "hover". */
  touchMode: "tap" | "hover";

  // ── Shared state with the parent's multi-pointer code ───
  /**
   * The parent's active-pointer map. Shared with tap-mode pinch
   * tracking. The hook mutates it (set/delete/clear) and reads its
   * size + has() to gate multi-finger logic.
   */
  activePointersRef: React.MutableRefObject<
    Map<number, { x: number; y: number }>
  >;
  /** Compute the current centroid + radius across active pointers. */
  pointerCentroid(): Centroid;

  // ── Pinch baseline (shared with tap-mode pinch zoom) ────
  /** Mutable ref to the parent's pinch-baseline radius. Hook sets it
   *  on pointerdown/up so subsequent pinch math is calibrated. */
  lastPinchDistanceRef: React.RefObject<number | null>;
  /** Emit a pinch zoom delta to the parent. Hook calls this in
   *  pointermove when multi-finger. Returns true if a delta was
   *  emitted. */
  tryEmitPinchZoom(c: Centroid): boolean;

  // ── Geometry + vertex lookup ────────────────────────────
  /** Convert client coords → SVG viewBox coords. */
  clientToViewBox(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null;
  /** Find the assigned vertex nearest to a viewBox-space point
   *  within engagementRadius. */
  findNearestAssignedVertex(
    point: { x: number; y: number },
    engagementRadius: number,
  ): number | null;

  // ── Anchor + engagement state setters ───────────────────
  anchor: {
    handleDotClick(vi: number): void;
    releaseAnchor(): void;
    getAnchoredVi(): number | null;
  };
  setEngagedVertexIdx(updater: number | null | ((prev: number | null) => number | null)): void;
}

export interface UseHoverCrosshairApi {
  /** Bind to the surface's onPointerDown. Surface element is passed
   *  separately because React's synthetic-event currentTarget may
   *  be reset by the time we use it via the dispatcher's
   *  indirection. */
  onPointerDown(e: React.PointerEvent, surface: HTMLElement): void;
  /** Bind to the surface's onPointerMove. */
  onPointerMove(e: React.PointerEvent): void;
  /** Bind to the surface's onPointerUp (and pointercancel). */
  onPointerUp(e?: React.PointerEvent): void;
  /** Whether to render the crosshair <g> in JSX. */
  visible: boolean;
  /** Initial coords at gesture start — used for the <g>'s mount-time
   *  transform attribute. Subsequent updates happen imperatively. */
  initialX: number;
  initialY: number;
  /** Ref callback to attach to the crosshair <g>. (Named without
   *  a `Ref` suffix so it doesn't trigger React 19's
   *  react-hooks/refs lint rule, which flags `.ref` access during
   *  render even on plain hook-returned objects.) */
  bindGroup: (el: SVGGElement | null) => void;
}

export function useHoverCrosshair(
  config: UseHoverCrosshairConfig,
): UseHoverCrosshairApi {
  const {
    touchMode,
    activePointersRef,
    pointerCentroid,
    lastPinchDistanceRef,
    tryEmitPinchZoom,
    clientToViewBox,
    findNearestAssignedVertex,
    anchor,
    setEngagedVertexIdx,
  } = config;

  const touchModeRef = useLatestRef(touchMode);

  const gesture = useRef<CrosshairGesture>({
    pos: null,
    prevPos: null,
    startedAt: 0,
    startPos: null,
    maxMovement: 0,
    lingerTimer: null,
    pendingLift: null,
  });
  const [view, setView] = useState<CrosshairView>({
    visible: false,
    releasing: false,
    initialX: 0,
    initialY: 0,
  });
  const groupRef = useRef<SVGGElement | null>(null);

  // Imperative position writer. Writes via CSS `transform` PROPERTY
  // (not the SVG `transform` ATTRIBUTE) so CSS transitions would
  // apply if added; `px` units on SVG elements inside an <svg>
  // resolve to viewBox user units per CSS Transforms Level 2.
  //
  // Bypasses React reconciliation so the crosshair tracks the
  // centroid at the native pointermove event rate without
  // per-frame state updates.
  const writeCrosshair = (pos: { x: number; y: number } | null) => {
    gesture.current.prevPos = gesture.current.pos;
    gesture.current.pos = pos;
    const g = groupRef.current;
    if (g && pos) {
      g.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    }
  };

  // Imperative opacity writer. The <g>'s style is fully imperative
  // (see ref callback) so React re-renders don't reset opacity back
  // to 1. `true` triggers the CROSSHAIR_LINGER_MS opacity transition
  // that fades the crosshair out before unmount.
  const writeCrosshairOpacity = (releasing: boolean) => {
    const g = groupRef.current;
    if (g) g.style.opacity = releasing ? "0" : "1";
  };

  // Stable ref callback. React only invokes it on mount (with the
  // element) and unmount (with null) since it's useCallback-memoized
  // — NOT on every render, which would reset opacity + transition
  // back to baseline and clobber writeCrosshairOpacity.
  //
  // Reads `view` via the latest-ref pattern. The closure-captured
  // initialX/Y is only used at mount, which is when view was just
  // set to make the element visible — so it's always up-to-date.
  const viewRef = useLatestRef(view);
  const groupRefCallback = useCallback(
    (el: SVGGElement | null) => {
      groupRef.current = el;
      if (el) {
        const v = viewRef.current;
        el.style.transform = `translate(${v.initialX}px, ${v.initialY}px)`;
        el.style.opacity = "1";
        el.style.transitionProperty = "opacity";
        el.style.transitionDuration = `${CROSSHAIR_LINGER_MS}ms`;
        el.style.transitionTimingFunction = "ease-out";
      }
    },
    [viewRef],
  );

  // Cleanup pending timers on unmount. We deliberately read
  // gesture.current AT CLEANUP TIME (that's when the relevant
  // timers exist) — not via a snapshot, since they could be
  // scheduled mid-lifetime by any of the handlers above.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const g = gesture.current;
      if (g.lingerTimer) clearTimeout(g.lingerTimer);
      if (g.pendingLift) clearTimeout(g.pendingLift);
    };
  }, []);

  // ─── Handlers ───────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, surface: HTMLElement) => {
      if (touchModeRef.current !== "hover") return;
      activePointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });
      const c = pointerCentroid();
      const g = gesture.current;
      // A new finger landing cancels any pending pointerup hesitation
      // — the user is re-engaging the gesture, not completing it.
      if (g.pendingLift) {
        clearTimeout(g.pendingLift);
        g.pendingLift = null;
      }
      // Seed pinch baseline only when 2+ fingers are down.
      lastPinchDistanceRef.current = c.count >= 2 ? c.radius : null;
      const vbPoint = clientToViewBox(c.x, c.y);
      if (vbPoint) {
        // Cancel any in-flight linger so a new tap doesn't fade out
        // partway through.
        if (g.lingerTimer) {
          clearTimeout(g.lingerTimer);
          g.lingerTimer = null;
        }
        writeCrosshair(vbPoint);
        // Reset opacity to full in case the previous gesture was
        // mid-fade and the user re-touched before unmount.
        writeCrosshairOpacity(false);
        setView({
          visible: true,
          releasing: false,
          initialX: vbPoint.x,
          initialY: vbPoint.y,
        });
        // Engagement runs from the centroid regardless of finger
        // count — a multi-finger midpoint is still a valid hover
        // target.
        const vi = findNearestAssignedVertex(
          vbPoint,
          CROSSHAIR_ENGAGEMENT_RADIUS,
        );
        if (vi !== null && anchor.getAnchoredVi() !== vi) {
          setEngagedVertexIdx(vi);
        }
        // Tap-vs-drag bookkeeping: only the FIRST finger of a
        // gesture seeds startPos + resets maxMovement. Subsequent
        // pointerdowns (additional fingers) accumulate against the
        // original start so a quick pinch + lift doesn't
        // accidentally count as a tap.
        if (c.count === 1) {
          g.startedAt = performance.now();
          g.startPos = { x: c.x, y: c.y };
          g.maxMovement = 0;
        }
      }
      // Capture on the surface (not e.target, which might be a
      // vertex hit-rect pointerdown bubbled up from).
      surface.setPointerCapture?.(e.pointerId);
    },
    [
      activePointersRef,
      anchor,
      clientToViewBox,
      findNearestAssignedVertex,
      lastPinchDistanceRef,
      pointerCentroid,
      setEngagedVertexIdx,
      touchModeRef,
    ],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (touchModeRef.current !== "hover") return;
      const pt = activePointersRef.current.get(e.pointerId);
      if (!pt) return;
      pt.x = e.clientX;
      pt.y = e.clientY;

      const c = pointerCentroid();
      const g = gesture.current;
      // Track furthest centroid distance from gesture origin. Runs
      // on every move BEFORE any early return — a move that's
      // suppressed for crosshair purposes (e.g. during pendingLift)
      // still counts toward "this gesture moved too much to be a
      // tap" so a sloppy pinch+release doesn't accidentally commit
      // a tap on lift.
      if (g.startPos) {
        const dx = c.x - g.startPos.x;
        const dy = c.y - g.startPos.y;
        const movement = Math.hypot(dx, dy);
        if (movement > g.maxMovement) g.maxMovement = movement;
      }
      // While a pointerup is in its hesitation window, freeze the
      // crosshair — don't update position or emit pinch. Single
      // rule that prevents simultaneous-lift snap regardless of how
      // the OS interleaves up/move events.
      if (g.pendingLift !== null) return;
      const vbPoint = clientToViewBox(c.x, c.y);
      if (!vbPoint) return;
      writeCrosshair(vbPoint);

      // Engagement runs from centroid regardless of finger count.
      // Mild flicker during pinch is preferable to no feedback.
      const vi = findNearestAssignedVertex(vbPoint, CROSSHAIR_ENGAGEMENT_RADIUS);
      const anchoredVi = anchor.getAnchoredVi();
      if (vi !== null && vi !== anchoredVi) {
        setEngagedVertexIdx((prev) => (prev === vi ? prev : vi));
      } else if (vi === null) {
        setEngagedVertexIdx((prev) => (prev === null ? prev : null));
      }

      tryEmitPinchZoom(c);
    },
    [
      activePointersRef,
      anchor,
      clientToViewBox,
      findNearestAssignedVertex,
      pointerCentroid,
      setEngagedVertexIdx,
      touchModeRef,
      tryEmitPinchZoom,
    ],
  );

  const handlePointerUp = useCallback(
    (e?: React.PointerEvent) => {
      if (touchModeRef.current !== "hover") return;
      const g = gesture.current;
      const map = activePointersRef.current;
      // Skip duplicate deliveries: pointerup can fire twice for the
      // same pointerId via synthetic-event delegation. Already-
      // processed pointers aren't in the active map.
      if (e && !map.has(e.pointerId)) return;
      const wasMultiFinger = map.size >= 2;
      if (e) map.delete(e.pointerId);
      else map.clear();
      const c = pointerCentroid();

      if (wasMultiFinger && g.prevPos && !g.pendingLift) {
        // Undo possibly-corrupted race write. Only when no pending
        // lift was in flight — if one was, the move handler was
        // already gated and the last write was legitimate.
        writeCrosshair(g.prevPos);
      }

      // Fully-lifted terminal flow.
      const doFullLift = () => {
        const duration = performance.now() - g.startedAt;
        const wasTap = duration < TAP_MAX_MS && g.maxMovement < TAP_MAX_PX;
        if (wasTap && g.pos) {
          const vi = findNearestAssignedVertex(
            g.pos,
            CROSSHAIR_ENGAGEMENT_RADIUS,
          );
          if (vi !== null) {
            anchor.handleDotClick(vi);
          } else if (anchor.getAnchoredVi() !== null) {
            anchor.releaseAnchor();
          }
        }
        writeCrosshairOpacity(true);
        if (g.lingerTimer) clearTimeout(g.lingerTimer);
        g.lingerTimer = setTimeout(() => {
          setView({
            visible: false,
            releasing: false,
            initialX: 0,
            initialY: 0,
          });
          gesture.current.pos = null;
          gesture.current.lingerTimer = null;
        }, CROSSHAIR_LINGER_MS);
        setEngagedVertexIdx(null);
        g.startPos = null;
        g.maxMovement = 0;
        lastPinchDistanceRef.current = null;
      };

      // Commit "one finger lifted, X-1 remain": snap to new centroid,
      // rebaseline pinch + tap origin.
      const doRebaseline = () => {
        const live = pointerCentroid();
        const livePt = clientToViewBox(live.x, live.y);
        if (livePt) writeCrosshair(livePt);
        lastPinchDistanceRef.current = live.count >= 2 ? live.radius : null;
        g.startedAt = performance.now();
        g.startPos = { x: live.x, y: live.y };
        g.maxMovement = 0;
      };

      // CASE A: pending lift in flight — resolve immediately based
      // on current count.
      if (g.pendingLift) {
        clearTimeout(g.pendingLift);
        g.pendingLift = null;
        if (c.count === 0) doFullLift();
        else doRebaseline();
        return;
      }

      // CASE B: no pending lift. Full lift fires immediately;
      // partial lift schedules hesitation.
      if (c.count === 0) {
        doFullLift();
        return;
      }
      g.pendingLift = setTimeout(() => {
        g.pendingLift = null;
        // Defensive: pointerleave may have cleared the map without
        // pointerups; treat as full lift.
        if (activePointersRef.current.size === 0) doFullLift();
        else doRebaseline();
      }, POINTERUP_HESITATION_MS);
    },
    [
      activePointersRef,
      anchor,
      clientToViewBox,
      findNearestAssignedVertex,
      lastPinchDistanceRef,
      pointerCentroid,
      setEngagedVertexIdx,
      touchModeRef,
    ],
  );

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    visible: view.visible,
    initialX: view.initialX,
    initialY: view.initialY,
    bindGroup: groupRefCallback,
  };
}
