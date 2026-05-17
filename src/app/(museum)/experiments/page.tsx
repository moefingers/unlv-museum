import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

interface Gallery {
  dir: string;
  title: string;
  href: string;
  sample: string | null;
  count: number;
}

/**
 * Auto-discovers every `public/banner-experiments*` directory that has an
 * `index.html`. Each becomes a card on /experiments. Picks a roughly-middle
 * SVG as the sample so it represents the gallery rather than the very first
 * or last iteration.
 */
function discoverGalleries(): Gallery[] {
  const publicDir = join(process.cwd(), "public");
  return readdirSync(publicDir)
    .filter((name) => name.startsWith("banner-experiments"))
    .filter((name) => {
      const full = join(publicDir, name);
      return (
        statSync(full).isDirectory() && existsSync(join(full, "index.html"))
      );
    })
    .map((name) => {
      const full = join(publicDir, name);
      const svgs = readdirSync(full)
        .filter((f) => f.endsWith(".svg"))
        .sort();
      const sample = svgs[Math.floor(svgs.length / 2)] ?? null;
      const suffix = name.replace(/^banner-experiments-?/, "");
      return {
        dir: name,
        title: suffix ? `Banner experiments — ${suffix}` : "Banner experiments",
        href: `/${name}/`,
        sample: sample ? `/${name}/${sample}` : null,
        count: svgs.length,
      };
    })
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

export default function ExperimentsPage() {
  const galleries = discoverGalleries();
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Experiments</h1>
      <p className="mb-8 text-zinc-500 dark:text-zinc-400">
        Visual research and prototyping for the museum-header banner card. Each
        gallery lazy-mounts items as they scroll into view.
      </p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {galleries.map((g) => (
          <li key={g.dir}>
            <a
              href={g.href}
              className="block overflow-hidden rounded-lg border border-zinc-200 bg-white transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <div
                className="grid place-items-center bg-zinc-50 p-4 dark:bg-zinc-950"
                style={{ aspectRatio: "16/7" }}
              >
                {g.sample && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.sample}
                    alt=""
                    className="max-h-full max-w-full"
                  />
                )}
              </div>
              <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                <h2 className="font-medium">{g.title}</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {g.count} SVG{g.count === 1 ? "" : "s"}
                </p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
