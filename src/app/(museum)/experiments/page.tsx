interface Gallery {
  title: string;
  href: string;
  sample: string;
}

const GALLERIES: Gallery[] = [
  {
    title: "Banner experiments",
    href: "/banner-experiments/",
    sample: "/banner-experiments/15-multi-300x140x9_150x50x6.svg",
  },
  {
    title: "Banner experiments — v2",
    href: "/banner-experiments-v2/",
    sample: "/banner-experiments-v2/step5b-primitive-precess.svg",
  },
  {
    title: "Banner experiments — v3",
    href: "/banner-experiments-v3/",
    sample:
      "/banner-experiments-v3/v3-300x140x9-staticx1_150x80x6-staticx-1@24s_60x35x4-precess@12s.svg",
  },
  {
    title: "Verified banner experiments",
    href: "/verified-banner-experiments/",
    sample: "/verified-banner-experiments/11.1-globe-spin-y-axis.svg",
  },
];

export default function ExperimentsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Experiments</h1>
      <p className="mb-8 text-zinc-500 dark:text-zinc-400">
        Visual research and prototyping for the museum-header banner card. Each
        gallery lazy-mounts items as they scroll into view.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {GALLERIES.map((g) => (
          <li key={g.href}>
            <a
              href={g.href}
              className="block overflow-hidden rounded-lg border border-zinc-200 bg-white transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <div
                className="grid place-items-center bg-zinc-50 p-4 dark:bg-zinc-950"
                style={{ aspectRatio: "16/7" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.sample} alt="" className="max-h-full max-w-full" />
              </div>
              <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                <h2 className="font-medium">{g.title}</h2>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
