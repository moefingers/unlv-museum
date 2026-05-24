/**
 * Museum mark — the canonical hexagon + inscribed triangle from
 * `src/app/icon.svg`, inlined as a React component so callers can drop
 * it into buttons / toasts / chrome without a network fetch.
 *
 * Originally inlined in MuseumToastLayer (parameterized by hue for
 * status mood); extracted here so the museum-OAuth login button on
 * any port can use the same glyph. Per
 * CONTEXT/internal_docs/identity-and-signup.md §The login-button UI
 * pattern, every museum-OAuth button MUST use this mark — not the
 * GitHub octocat, even though GitHub is the backing provider.
 *
 * Each instance must have a unique `gradientId` so the `<defs>` from
 * multiple side-by-side marks don't collide.
 */

interface MuseumMarkProps {
  size?: number;
  /** oklch hue degrees. 250=museum blue (default), 70=yellow, 25=red. */
  hue?: number;
  /** Unique id for the gradient `<defs>` block. */
  gradientId: string;
  className?: string;
}

export function MuseumMark({
  size = 18,
  hue = 250,
  gradientId,
  className,
}: MuseumMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop
            offset="35%"
            stopColor={`oklch(0.92 0.10 ${hue})`}
            stopOpacity="0.85"
          />
          <stop
            offset="100%"
            stopColor={`oklch(0.78 0.20 ${hue})`}
            stopOpacity="0.55"
          />
        </radialGradient>
      </defs>
      <polygon
        points="12,2 20.66,7 20.66,17 12,22 3.34,17 3.34,7"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.6"
        fill="none"
      />
      <polygon
        points="12,2 20.66,17 3.34,17"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.4"
        fill="none"
      />
    </svg>
  );
}
