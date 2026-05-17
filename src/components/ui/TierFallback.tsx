import { ExternalLink } from "lucide-react";
import type { ViewMode } from "@/lib/projects";

const TIER_LABEL: Record<ViewMode, string> = {
  original: "Original",
  enhanced: "Enhanced",
  reimagined: "Reimagined",
};

export function UnavailableSlot({ tier }: { tier: ViewMode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <p className="text-center text-zinc-400 dark:text-zinc-600">
        No {tier} tier for this project.
      </p>
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <p className="text-zinc-600 dark:text-zinc-400">
        The {tier} version lives as its own application.
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Open {title} {TIER_LABEL[tier]}
        <ExternalLink size={16} />
      </a>
    </div>
  );
}
