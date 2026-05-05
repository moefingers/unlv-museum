"use client";

export function CopycatActivity() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 shadow-lg dark:border-zinc-700">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-8 text-white">
          <h2 className="text-2xl font-bold">Design Recreation</h2>
          <p className="mt-2 text-indigo-100">
            A faithful copy of a reference design mockup, demonstrating
            pixel-perfect CSS implementation.
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
              <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900" />
              <span className="mt-2 text-xs font-medium">Layout</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
              <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900" />
              <span className="mt-2 text-xs font-medium">Colors</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
              <div className="h-10 w-10 rounded-full bg-pink-100 dark:bg-pink-900" />
              <span className="mt-2 text-xs font-medium">Typography</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            The original exercise focused on matching a provided design exactly
            using only HTML and CSS. This remastered version uses Tailwind
            utility classes and responsive design.
          </p>
        </div>
      </div>
    </div>
  );
}
