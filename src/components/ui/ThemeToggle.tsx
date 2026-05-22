"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import styles from "./ThemeToggle.module.css";

/**
 * Theme mode toggle — circular icon button that flips light ↔ dark.
 *
 * Two placements (same component, both consume the same `useTheme`
 * hook so they stay in lockstep):
 *   1. Landing: top-right corner, sibling to HelpModal's closed-state
 *      button. The two share visual vocabulary — 2rem circle, same
 *      surface tokens, side-by-side with a small gap.
 *   2. MuseumChrome: inside the header's trailGroup, before the
 *      SignInChip. Inherits row flex layout.
 *
 * The `variant` prop picks the layout mode. Both render the SAME
 * inner element (Sun/Moon icon in a circle); only positioning differs.
 *
 * `hidden` lets the landing-variant fade out when HelpModal is open
 * (so the toggle doesn't sit orphaned in the corner while the modal
 * commands the foreground). Chrome callers don't need it.
 *
 * The icon is the OPPOSITE of the current mode — Sun while in dark
 * mode (click to go light), Moon while in light mode (click to go
 * dark). This is the convention users expect: the icon is the
 * destination, not the current state.
 */
export function ThemeToggle({
  variant = "chrome",
  hidden = false,
}: {
  variant?: "landing" | "chrome";
  hidden?: boolean;
}) {
  const { resolvedMode, toggleMode } = useTheme();

  return (
    <button
      type="button"
      className={
        variant === "landing"
          ? `${styles.button} ${styles.landingVariant}`
          : `${styles.button} ${styles.chromeVariant}`
      }
      data-hidden={hidden || undefined}
      onClick={toggleMode}
      aria-label={
        resolvedMode === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
    >
      {resolvedMode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
