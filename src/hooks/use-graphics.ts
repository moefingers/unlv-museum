"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";

/*
 * Graphics settings — preset tier + individual toggles.
 *
 * Mirrors the museum's theme settings pattern: localStorage as the
 * source of truth, useSyncExternalStore subscribes the React tree,
 * a manual `storage` event dispatch broadcasts changes within the
 * same tab. The DOM mirror lives on <html data-graphics="..."> so
 * CSS selectors can react without React in the loop (used for
 * edgeGlow and backgroundHalo — pure visual toggles).
 *
 * The shape is intentionally two-layered:
 *   - `preset` is what the dropdown shows ("low" / "medium" /
 *     "high" / "custom"). When non-custom, the per-toggle fields
 *     are derived from PRESET_DEFINITIONS.
 *   - Per-toggle fields are the source of truth ONLY when
 *     preset === "custom". Touching any toggle individually flips
 *     preset to "custom" and freezes the current values.
 *
 * This matches how every video-game graphics menu works: presets
 * are convenient shortcuts, the underlying toggles are the real
 * thing.
 */

export type GraphicsPreset = "low" | "medium" | "high" | "custom";
export type VertexGlowMode = "all" | "engaged-only" | "off";
export type ReducedMotionMode = "auto" | "force-on" | "force-off";

export interface GraphicsSettings {
  preset: GraphicsPreset;
  edgeGlow: boolean;
  faceShading: boolean;
  vertexGlows: VertexGlowMode;
  breathingMesh: boolean;
  backgroundHalo: boolean;
  reducedMotion: ReducedMotionMode;
}

const STORAGE_KEY = "museum-graphics";

/*
 * Preset definitions — single source of truth for what each tier
 * means. Selecting a preset overwrites the corresponding per-toggle
 * fields; touching a per-toggle field flips preset to "custom".
 *
 * Tuned for the museum's actual heavy hitters: edge-glow halo pass,
 * dynamic face shading, per-vertex glow gradients. The bullseye for
 * "low" is "still legible as a 3D sphere of constellation dots,
 * without any compositing fillrate work."
 */
export const PRESET_DEFINITIONS: Record<
  Exclude<GraphicsPreset, "custom">,
  Omit<GraphicsSettings, "preset">
> = {
  low: {
    edgeGlow: false,
    faceShading: false,
    vertexGlows: "engaged-only",
    breathingMesh: false,
    backgroundHalo: false,
    // reducedMotion stays on "auto" even for Low. The Force-on path
    // zeroes ALL transition durations site-wide, which is way more
    // aggressive than the actual perf goal (cutting rendering fillrate
    // on the globe). It would also visibly break the help/graphics
    // modal morph animations — they rely on transition timings for
    // the open/close choreography. Visitors who specifically want
    // reduced motion can still set it explicitly via the Advanced
    // toggle; on Low, we leave that as their OS preference.
    reducedMotion: "auto",
  },
  medium: {
    edgeGlow: false,
    faceShading: true,
    vertexGlows: "all",
    breathingMesh: true,
    backgroundHalo: true,
    reducedMotion: "auto",
  },
  high: {
    edgeGlow: true,
    faceShading: true,
    vertexGlows: "all",
    breathingMesh: true,
    backgroundHalo: true,
    reducedMotion: "auto",
  },
};

/*
 * Default preset for first-visit users. Configurable for DX so the
 * project lead can try a few defaults before committing. To enable
 * silent auto-detection on first visit, change this to
 * "auto-detect" — the hook will run the static-signal probe (see
 * detectStaticSignal below) and use its result as the initial value.
 */
const GRAPHICS_FIRST_VISIT_DEFAULT: GraphicsPreset | "auto-detect" = "medium";

/*
 * Static-signal auto-detect: classify a device into a preset based
 * on hardware hints. Runs synchronously on first read, no animation
 * frame budget needed. Conservative — only downgrades to "low" on
 * clear signals. Never returns "high"; we keep "high" as an opt-in
 * because it's the most-fillrate-heavy tier and not appropriate as
 * a silent default.
 */
function detectStaticSignal(): "low" | "medium" {
  if (typeof window === "undefined") return "medium";
  const cores = navigator.hardwareConcurrency ?? 8;
  // navigator.deviceMemory is non-standard but widely supported; use
  // a permissive type rather than augmenting global Navigator.
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (reducedMotion) return "low";
  if (cores < 4) return "low";
  if (memory < 4) return "low";
  return "medium";
}

/*
 * Runtime perf probe — measures actual frame timing for ~1 second
 * via requestAnimationFrame. Returns the result via callback so the
 * caller can decide whether to apply. Doesn't auto-apply; surfaces
 * the result so the UI can show "Detected: low — apply?" before
 * changing anything.
 *
 * Cutoffs are conservative on purpose. < 50fps average → "low";
 * > 58fps → "high"; otherwise "medium". The 8fps gap between low
 * and high prevents borderline devices from oscillating.
 */
export function probeRuntimePerf(
  onResult: (preset: "low" | "medium" | "high") => void,
  durationMs = 1000,
) {
  if (typeof window === "undefined") {
    onResult("medium");
    return () => {};
  }
  let frameCount = 0;
  let cancelled = false;
  const start = performance.now();
  function tick() {
    if (cancelled) return;
    frameCount++;
    const elapsed = performance.now() - start;
    if (elapsed >= durationMs) {
      const fps = (frameCount * 1000) / elapsed;
      if (fps < 50) onResult("low");
      else if (fps > 58) onResult("high");
      else onResult("medium");
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return () => {
    cancelled = true;
  };
}

/*
 * Resolve a settings record to its full per-toggle values. When
 * preset is "custom", the stored per-toggle values are used as-is;
 * otherwise they're overwritten from PRESET_DEFINITIONS so callers
 * always see consistent fields.
 */
function resolve(settings: GraphicsSettings): GraphicsSettings {
  if (settings.preset === "custom") return settings;
  return { preset: settings.preset, ...PRESET_DEFINITIONS[settings.preset] };
}

function defaultSettings(): GraphicsSettings {
  const initial: GraphicsPreset =
    GRAPHICS_FIRST_VISIT_DEFAULT === "auto-detect"
      ? detectStaticSignal()
      : GRAPHICS_FIRST_VISIT_DEFAULT;
  return resolve({
    preset: initial,
    ...PRESET_DEFINITIONS[initial === "custom" ? "medium" : initial],
  });
}

function readStored(): GraphicsSettings {
  if (typeof window === "undefined") return defaultSettings();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultSettings();
  try {
    const parsed = JSON.parse(raw) as Partial<GraphicsSettings>;
    // Validate shape — missing or wrong-typed fields fall back to
    // medium so a corrupt entry doesn't break the page. Whitelist
    // the known preset values to keep the dropdown sane.
    const preset: GraphicsPreset =
      parsed.preset === "low" ||
      parsed.preset === "medium" ||
      parsed.preset === "high" ||
      parsed.preset === "custom"
        ? parsed.preset
        : "medium";
    return resolve({
      preset,
      edgeGlow: typeof parsed.edgeGlow === "boolean" ? parsed.edgeGlow : true,
      faceShading:
        typeof parsed.faceShading === "boolean" ? parsed.faceShading : true,
      vertexGlows:
        parsed.vertexGlows === "all" ||
        parsed.vertexGlows === "engaged-only" ||
        parsed.vertexGlows === "off"
          ? parsed.vertexGlows
          : "all",
      breathingMesh:
        typeof parsed.breathingMesh === "boolean" ? parsed.breathingMesh : true,
      backgroundHalo:
        typeof parsed.backgroundHalo === "boolean"
          ? parsed.backgroundHalo
          : true,
      reducedMotion:
        parsed.reducedMotion === "auto" ||
        parsed.reducedMotion === "force-on" ||
        parsed.reducedMotion === "force-off"
          ? parsed.reducedMotion
          : "auto",
    });
  } catch {
    return defaultSettings();
  }
}

function writeStored(next: GraphicsSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  // Manual same-tab dispatch — the native `storage` event only
  // fires in OTHER tabs by spec. Without this, the hook in the
  // same tab wouldn't notice the update until something else
  // triggered a re-subscription. Same pattern useTheme uses.
  window.dispatchEvent(new Event("storage"));
}

/*
 * Snapshot caching for useSyncExternalStore. The hook contract
 * requires getSnapshot() to return a referentially stable value
 * when nothing has changed — otherwise React's bail-out check
 * fails ("getSnapshot should be cached to avoid an infinite loop")
 * and we hit a re-render loop.
 *
 * readStored() rebuilds a new object every call (it parses JSON
 * and constructs fresh fields), so we need a cache layer keyed
 * by the raw localStorage string. If the string hasn't changed,
 * return the previously parsed object. If it has, parse fresh
 * and remember. The subscribe() callback invalidates by simply
 * letting the next getSnapshot() see a new raw string.
 *
 * The OS prefers-reduced-motion change is the one edge case where
 * the raw string is identical but the *resolved* settings could
 * differ (because reducedMotion === "auto" depends on the OS).
 * The mq listener in subscribe() triggers a re-read, but since
 * the raw localStorage hasn't changed our cache would short-
 * circuit. So we also key the cache on the matchMedia state.
 */
let cachedRaw: string | null = null;
let cachedMqMatches: boolean | null = null;
let cachedSnapshot: GraphicsSettings | null = null;

function getSnapshot(): GraphicsSettings {
  if (typeof window === "undefined") return defaultSettings();
  const raw = localStorage.getItem(STORAGE_KEY);
  const mqMatches = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (
    cachedSnapshot !== null &&
    raw === cachedRaw &&
    mqMatches === cachedMqMatches
  ) {
    return cachedSnapshot;
  }
  const next = readStored();
  cachedRaw = raw;
  cachedMqMatches = mqMatches;
  cachedSnapshot = next;
  return next;
}

/*
 * Server snapshot — must be a stable reference for the lifetime of
 * the module, since useSyncExternalStore caches it as the
 * initial-mount value. Computed once at module load. The actual
 * value is intentionally the medium-preset baseline (NOT the
 * auto-detect result) because auto-detect reads `navigator.*` which
 * isn't safe at module-eval time on the server.
 */
const SERVER_SNAPSHOT: GraphicsSettings = Object.freeze({
  preset: "medium" as const,
  ...PRESET_DEFINITIONS.medium,
}) as GraphicsSettings;

function getServerSnapshot(): GraphicsSettings {
  return SERVER_SNAPSHOT;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  // Also re-poll when the OS's prefers-reduced-motion flips, because
  // the resolved value depends on it (when reducedMotion is "auto").
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    mq.removeEventListener("change", callback);
  };
}

/*
 * Apply the settings to the DOM:
 *   - data-graphics on <html> drives CSS-only toggles (edgeGlow,
 *     backgroundHalo). Value mirrors `preset` directly, so a
 *     selector like [data-graphics="low"] .edgeGlowLayer { display:
 *     none } can target tier-based visual changes.
 *   - data-graphics-edge-glow on <html> handles the "custom" case
 *     where edgeGlow can differ from its preset's default. Same for
 *     the other CSS-driven toggles. This way CSS doesn't need to
 *     replicate the preset-vs-toggle resolution logic.
 *   - data-reduced-motion on <html> for the forced override; the
 *     existing @media (prefers-reduced-motion) rule in globals.css
 *     gets paired with a [data-reduced-motion="force"] selector.
 */
function applyToDOM(settings: GraphicsSettings) {
  const html = document.documentElement;
  html.setAttribute("data-graphics", settings.preset);
  html.setAttribute(
    "data-graphics-edge-glow",
    settings.edgeGlow ? "on" : "off",
  );
  html.setAttribute(
    "data-graphics-background-halo",
    settings.backgroundHalo ? "on" : "off",
  );
  if (settings.reducedMotion === "force-on") {
    html.setAttribute("data-reduced-motion", "force");
  } else if (settings.reducedMotion === "force-off") {
    html.setAttribute("data-reduced-motion", "off");
  } else {
    html.removeAttribute("data-reduced-motion");
  }
}

function withViewTransition(fn: () => void) {
  if (typeof document !== "undefined" && document.startViewTransition) {
    // Same swallowing pattern as useTheme — a rapid second
    // settings change rejects the previous transition's `finished`
    // promise with InvalidStateError. The new one takes over;
    // silent rejection is correct.
    document.startViewTransition(fn).finished.catch(() => {});
  } else {
    fn();
  }
}

/*
 * Main hook. Returns the resolved settings + setters. Three setters:
 *   - setPreset: pick a named preset. Overwrites per-toggle fields
 *     from PRESET_DEFINITIONS.
 *   - setToggle: change one individual field. Flips preset to
 *     "custom" automatically.
 *   - detect: run the runtime probe and apply its result.
 *
 * All mutations write to localStorage and dispatch the storage
 * event so the same tab + other tabs both update. View transitions
 * wrap the mutation so the visual change crossfades rather than
 * snapping.
 */
export function useGraphics() {
  const settings = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Mirror to DOM on every render. Idempotent — setAttribute with
  // the same value is a no-op for the browser. View-transition
  // wrapper is owned by the setters (not this effect) because we
  // only want the crossfade on user actions, not on initial mount.
  useEffect(() => {
    applyToDOM(settings);
  }, [settings]);

  const setPreset = useCallback((next: GraphicsPreset) => {
    withViewTransition(() => {
      if (next === "custom") {
        // Selecting "custom" from outside is a no-op — custom is
        // entered implicitly by touching a toggle. We ignore it
        // rather than throw so a future menu typo doesn't crash.
        return;
      }
      writeStored(resolve({ preset: next, ...PRESET_DEFINITIONS[next] }));
    });
  }, []);

  const setToggle = useCallback(
    <K extends keyof Omit<GraphicsSettings, "preset">>(
      key: K,
      value: GraphicsSettings[K],
    ) => {
      withViewTransition(() => {
        const current = readStored();
        // Resolve to the CURRENT effective values first (so when we
        // flip to custom, the other toggles freeze at what the user
        // was actually looking at — not at some stale "custom"
        // state from before they picked a preset).
        const effective = resolve(current);
        writeStored({
          ...effective,
          preset: "custom",
          [key]: value,
        });
      });
    },
    [],
  );

  const detect = useCallback(() => {
    return new Promise<"low" | "medium" | "high">((resolveResult) => {
      probeRuntimePerf((result) => {
        resolveResult(result);
      });
    });
  }, []);

  return {
    settings,
    setPreset,
    setToggle,
    detect,
  };
}
