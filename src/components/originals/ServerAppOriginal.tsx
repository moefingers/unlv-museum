"use client";

interface ServerAppOriginalProps {
  title: string;
  tech: string;
  description: string;
  note: string;
}

export function ServerAppOriginal({
  title,
  tech,
  description,
  note,
}: ServerAppOriginalProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{tech}</p>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
        <div className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          {note}
        </div>
      </div>
    </div>
  );
}
