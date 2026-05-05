"use client";

export function PlaceholderReimagined({ title }: { title: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-2xl font-bold">
        {title}{" "}
        <span className="text-sm font-normal text-amber-500">Reimagined</span>
      </h2>
      <p className="max-w-md text-center text-zinc-500 dark:text-zinc-400">
        The reimagined version of this project is under construction. Check back
        soon for the full creative expansion with database integration,
        animations, and enhanced interactivity.
      </p>
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
        <span className="animate-pulse">●</span>
        Coming soon
      </div>
    </div>
  );
}
