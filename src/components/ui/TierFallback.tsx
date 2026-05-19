import { ExternalLink } from "lucide-react";
import type { ViewMode } from "@/lib/projects";
import styles from "./TierFallback.module.css";

const TIER_LABEL: Record<ViewMode, string> = {
  original: "Original",
  enhanced: "Enhanced",
  reimagined: "Reimagined",
};

export function UnavailableSlot({ tier }: { tier: ViewMode }) {
  return (
    <div className={styles.unavailable}>
      <p className={styles.unavailableText}>No {tier} tier for this project.</p>
    </div>
  );
}

export function ExternalTierCard({
  tier,
  title,
  href,
}: {
  tier: "enhanced" | "reimagined";
  title: string;
  href: string;
}) {
  return (
    <div className={styles.external}>
      <p className="text-muted">
        The {tier} version lives as its own application.
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
      >
        Open {title} {TIER_LABEL[tier]}
        <ExternalLink size={16} />
      </a>
    </div>
  );
}
