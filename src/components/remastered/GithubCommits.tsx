"use client";

import { useState } from "react";

interface RepoStats {
  name: string;
  commits: number;
  language: string;
  lastPush: string;
}

const MOCK_REPOS: RepoStats[] = [
  {
    name: "zcanon",
    commits: 47,
    language: "TypeScript",
    lastPush: "2 hours ago",
  },
  {
    name: "infinite-syndicate",
    commits: 124,
    language: "TypeScript",
    lastPush: "1 day ago",
  },
  { name: "OWN3", commits: 89, language: "TypeScript", lastPush: "3 days ago" },
  {
    name: "unlv-museum",
    commits: 5,
    language: "TypeScript",
    lastPush: "just now",
  },
  {
    name: "mp2-ecommerce",
    commits: 32,
    language: "JavaScript",
    lastPush: "8 months ago",
  },
  {
    name: "gwhac-a-mole",
    commits: 15,
    language: "JavaScript",
    lastPush: "1 year ago",
  },
  {
    name: "UNLV-MilestO-W-N",
    commits: 28,
    language: "JavaScript",
    lastPush: "1 year ago",
  },
  {
    name: "enterprize",
    commits: 41,
    language: "TypeScript",
    lastPush: "10 months ago",
  },
];

export function GithubCommits() {
  const [username, setUsername] = useState("moefingers");
  const [searched, setSearched] = useState(false);

  const totalCommits = MOCK_REPOS.reduce((sum, r) => sum + r.commits, 0);

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-4 text-2xl font-bold">How Many Commits Do I Have?</h2>

      <div className="mb-6 flex gap-2">
        <input
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setSearched(false);
          }}
          placeholder="GitHub username"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
        />
        <button
          onClick={() => setSearched(true)}
          className="rounded bg-zinc-900 px-4 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Count
        </button>
      </div>

      {searched && (
        <div>
          <div className="mb-6 rounded-lg border border-zinc-200 p-6 text-center dark:border-zinc-700">
            <p className="text-zinc-500">Total commits for @{username}</p>
            <p className="mt-2 text-5xl font-bold">{totalCommits}</p>
            <p className="mt-1 text-sm text-zinc-400">
              across {MOCK_REPOS.length} repositories
            </p>
          </div>

          <div className="space-y-2">
            {MOCK_REPOS.sort((a, b) => b.commits - a.commits).map((repo) => (
              <div
                key={repo.name}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 rounded bg-zinc-200 dark:bg-zinc-700"
                    style={{
                      width: `${Math.max((repo.commits / totalCommits) * 200, 8)}px`,
                    }}
                  />
                  <div>
                    <p className="font-medium">{repo.name}</p>
                    <p className="text-xs text-zinc-500">{repo.lastPush}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold">{repo.commits}</p>
                  <p className="text-xs text-zinc-400">{repo.language}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
