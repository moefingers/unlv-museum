"use client";

import { useState } from "react";
import styles from "./ApiExplorer.module.css";

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

  const statusClass =
    status === null
      ? ""
      : status >= 200 && status < 300
        ? styles.statusSuccess
        : status >= 400
          ? styles.statusError
          : styles.statusWarning;

  return (
    <div className={styles.shell}>
      <h2 className={`text-2xl font-bold ${styles.title}`}>{title}</h2>
      <p className={`text-xs ${styles.baseUrl}`}>{baseUrl}</p>
      <p className={`text-xs ${styles.intro}`}>
        This project was originally backend-only — no UI was built. The explorer
        below is provided so you can interact with the live API. The endpoints
        are also accessible via Postman, curl, or any HTTP client.
      </p>

      {siblings && siblings.length > 0 && (
        <div className={styles.siblings}>
          <span className={`text-xs ${styles.siblingsLabel}`}>APIs:</span>
          <span
            className={`text-xs ${styles.siblingTab} ${styles.siblingTabCurrent}`}
          >
            {title}
          </span>
          {siblings
            .filter((s) => s.title !== title)
            .map((s) => (
              <button
                key={s.baseUrl}
                onClick={() => onSwitch?.(s)}
                className={`text-xs ${styles.siblingTab}`}
              >
                {s.title}
              </button>
            ))}
        </div>
      )}

      <div className={styles.presetList}>
        {presets.map((preset, i) => (
          <button
            key={i}
            onClick={() => applyPreset(preset)}
            className={`text-xs ${styles.preset}`}
          >
            <span className={styles.methodDot} data-method={preset.method} />
            {preset.label}
          </button>
        ))}
      </div>

      <div className={styles.requestRow}>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as Method)}
          className={`method-button ${styles.methodSelect}`}
          data-method={method}
          aria-label="HTTP method"
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
          className={styles.pathInput}
          placeholder="/endpoint"
        />
        <button
          onClick={send}
          disabled={loading}
          className={`btn btn-primary ${styles.sendButton}`}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>

      {method !== "GET" && (
        <div className={styles.bodyEditor}>
          <label>Request Body (JSON)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className={styles.bodyTextarea}
            placeholder='{"key": "value"}'
          />
        </div>
      )}

      <div className={styles.response}>
        <div className={styles.responseHeader}>
          <span className={`text-xs ${styles.responseLabel}`}>Response</span>
          {status !== null && (
            <span className={`text-xs ${styles.statusBadge} ${statusClass}`}>
              {status}
            </span>
          )}
        </div>
        <pre className={styles.responseBody}>
          {response ?? "Click Send to make a request"}
        </pre>
      </div>

      {history.length > 0 && (
        <div className={styles.history}>
          <p className={`text-xs ${styles.historyLabel}`}>History</p>
          <div className={styles.historyList}>
            {history.map((h, i) => (
              <span key={i} className={`text-xs ${styles.historyItem}`}>
                <span className={styles.methodDot} data-method={h.method} />
                {h.method} {h.path}{" "}
                <span className={styles.historyMeta}>
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
