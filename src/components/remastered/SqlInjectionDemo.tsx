"use client";

import { useState } from "react";

const USERS_DB = [
  { id: 1, username: "admin", password: "s3cur3P@ss", role: "admin" },
  { id: 2, username: "alice", password: "alice123", role: "user" },
  { id: 3, username: "bob", password: "b0bRul3s", role: "user" },
];

export function SqlInjectionDemo() {
  const [mode, setMode] = useState<"vulnerable" | "safe">("vulnerable");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const attempt = () => {
    if (mode === "vulnerable") {
      const sql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
      setQuery(sql);

      if (username.includes("'") || password.includes("'")) {
        if (
          username.includes("' OR '1'='1") ||
          password.includes("' OR '1'='1")
        ) {
          setResult(
            `⚠️ SQL INJECTION SUCCESSFUL! All ${USERS_DB.length} users returned.\n\n` +
              USERS_DB.map(
                (u) =>
                  `ID: ${u.id} | ${u.username} | ${u.password} | ${u.role}`,
              ).join("\n"),
          );
          return;
        }
        setResult(
          "⚠️ SQL syntax error — but the injection attempt was detected in the query!",
        );
        return;
      }

      const user = USERS_DB.find(
        (u) => u.username === username && u.password === password,
      );
      setResult(
        user
          ? `✅ Login successful: ${user.username} (${user.role})`
          : "❌ Invalid credentials",
      );
    } else {
      const sql = `SELECT * FROM users WHERE username = $1 AND password = $2\n-- Parameters: [$1='${username}', $2='${password}']`;
      setQuery(sql);

      const user = USERS_DB.find(
        (u) => u.username === username && u.password === password,
      );
      setResult(
        user
          ? `✅ Login successful: ${user.username} (${user.role})`
          : "❌ Invalid credentials (injection attempt safely neutralized by parameterized query)",
      );
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-2 text-2xl font-bold">SQL Injection Demo</h2>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Educational demonstration. Try entering{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
          &apos; OR &apos;1&apos;=&apos;1
        </code>{" "}
        as the password.
      </p>

      <div className="mb-4 inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        <button
          onClick={() => {
            setMode("vulnerable");
            setResult(null);
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "vulnerable" ? "bg-red-500 text-white" : "text-zinc-600 dark:text-zinc-400"}`}
        >
          Vulnerable
        </button>
        <button
          onClick={() => {
            setMode("safe");
            setResult(null);
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === "safe" ? "bg-green-500 text-white" : "text-zinc-600 dark:text-zinc-400"}`}
        >
          Safe (Parameterized)
        </button>
      </div>

      <div className="mx-auto w-full max-w-md space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
        />
        <button
          onClick={attempt}
          className="w-full rounded bg-zinc-900 py-2 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Login
        </button>
      </div>

      {query && (
        <div className="mt-4 rounded bg-zinc-50 p-4 dark:bg-zinc-800">
          <p className="mb-1 text-xs font-medium text-zinc-500">
            Generated SQL
          </p>
          <pre className="overflow-x-auto font-mono text-sm">{query}</pre>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded bg-zinc-50 p-4 dark:bg-zinc-800">
          <pre className="whitespace-pre-wrap font-mono text-sm">{result}</pre>
        </div>
      )}
    </div>
  );
}
