"use client";

import { useState } from "react";

type Method = "GET" | "POST" | "PUT" | "DELETE";

interface Preset {
  label: string;
  method: Method;
  path: string;
  body?: string;
}

export interface ApiConfig {
  title: string;
  baseUrl: string;
  presets: Preset[];
}

interface ApiExplorerProps {
  title: string;
  baseUrl: string;
  presets: Preset[];
  siblings?: ApiConfig[];
  onSwitch?: (config: ApiConfig) => void;
}

export function ApiExplorer({
  title,
  baseUrl,
  presets,
  siblings,
  onSwitch,
}: ApiExplorerProps) {
  const [method, setMethod] = useState<Method>("GET");
  const [path, setPath] = useState(presets[0]?.path ?? "/");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<
    { method: Method; path: string; status: number; time: number }[]
  >([]);

  const send = async () => {
    setLoading(true);
    setResponse(null);
    setStatus(null);
    const url = `${baseUrl}${path}`;
    const start = performance.now();

    try {
      const opts: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (method !== "GET" && body.trim()) {
        opts.body = body;
      }

      const res = await fetch(url, opts);
      const elapsed = Math.round(performance.now() - start);
      setStatus(res.status);

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResponse(JSON.stringify(json, null, 2));
      } catch {
        setResponse(text);
      }

      setHistory((prev) => [
        { method, path, status: res.status, time: elapsed },
        ...prev.slice(0, 19),
      ]);
    } catch (err) {
      setStatus(0);
      setResponse(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (preset: Preset) => {
    setMethod(preset.method);
    setPath(preset.path);
    setBody(preset.body ?? "");
  };

  const METHOD_COLORS: Record<Method, string> = {
    GET: "bg-green-600",
    POST: "bg-blue-600",
    PUT: "bg-amber-600",
    DELETE: "bg-red-600",
  };

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-1 text-2xl font-bold">{title}</h2>
      <p className="mb-2 text-xs font-mono text-zinc-400">{baseUrl}</p>
      <p className="mb-4 rounded bg-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        This project was originally backend-only — no UI was built. The explorer
        below is provided so you can interact with the live API. The endpoints
        are also accessible via Postman, curl, or any HTTP client.
      </p>

      {siblings && siblings.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          <span className="mr-1 self-center text-xs text-zinc-400">APIs:</span>
          <span className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
            {title}
          </span>
          {siblings
            .filter((s) => s.title !== title)
            .map((s) => (
              <button
                key={s.baseUrl}
                onClick={() => onSwitch?.(s)}
                className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              >
                {s.title}
              </button>
            ))}
        </div>
      )}

      {/* Presets */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {presets.map((preset, i) => (
          <button
            key={i}
            onClick={() => applyPreset(preset)}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${METHOD_COLORS[preset.method]}`}
            />
            {preset.label}
          </button>
        ))}
      </div>

      {/* Request builder */}
      <div className="mb-4 flex gap-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as Method)}
          className={`rounded-md px-3 py-2 text-sm font-bold text-white ${METHOD_COLORS[method]}`}
        >
          {(["GET", "POST", "PUT", "DELETE"] as const).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-800"
          placeholder="/endpoint"
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>

      {/* Body editor (for POST/PUT/DELETE) */}
      {method !== "GET" && (
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Request Body (JSON)
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-800"
            placeholder='{"key": "value"}'
          />
        </div>
      )}

      {/* Response */}
      <div className="flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Response</span>
          {status !== null && (
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                status >= 200 && status < 300
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : status >= 400
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              {status}
            </span>
          )}
        </div>
        <pre className="max-h-80 overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-sm text-green-400">
          {response ?? "Click Send to make a request"}
        </pre>
      </div>

      {/* Request history */}
      {history.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-medium text-zinc-500">History</p>
          <div className="flex flex-wrap gap-1">
            {history.map((h, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${METHOD_COLORS[h.method]}`}
                />
                {h.method} {h.path}{" "}
                <span className="text-zinc-400">
                  {h.status} · {h.time}ms
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
