"use client";

const VALUES = [
  {
    name: "Integrity",
    description: "Doing what's right even when no one is watching",
    icon: "⚖️",
  },
  {
    name: "Growth",
    description: "Continuously learning and improving every day",
    icon: "🌱",
  },
  {
    name: "Family",
    description: "The foundation that everything else is built on",
    icon: "🏠",
  },
  {
    name: "Creativity",
    description: "Finding new solutions and expressing ideas",
    icon: "🎨",
  },
  {
    name: "Perseverance",
    description: "Never giving up when things get difficult",
    icon: "🏔️",
  },
  {
    name: "Community",
    description: "Giving back and lifting others up",
    icon: "🤝",
  },
];

export function MyValues() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center p-6">
      <h2 className="text-3xl font-bold">My Values</h2>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        The principles that guide my decisions
      </p>

      <div className="mt-8 grid w-full max-w-2xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VALUES.map((value) => (
          <div
            key={value.name}
            className="rounded-lg border border-zinc-200 p-4 text-center transition-shadow hover:shadow-md dark:border-zinc-700"
          >
            <span className="text-3xl">{value.icon}</span>
            <h3 className="mt-2 font-semibold">{value.name}</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {value.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
