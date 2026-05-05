"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface PyodideRunnerProps {
  files: { name: string; code: string }[];
}

export function PyodideRunner({ files }: PyodideRunnerProps) {
  const [activeFile, setActiveFile] = useState(0);
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const pyodideRef = useRef<unknown>(null);

  const loadPyodide = useCallback(async () => {
    if (pyodideRef.current) return pyodideRef.current;
    setLoading(true);
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js";
    document.head.appendChild(script);
    await new Promise<void>((resolve) => {
      script.onload = () => resolve();
    });
    const pyodide = await (
      window as unknown as {
        loadPyodide: () => Promise<unknown>;
      }
    ).loadPyodide();
    pyodideRef.current = pyodide;
    setLoading(false);
    setReady(true);
    return pyodide;
  }, []);

  const run = async () => {
    setRunning(true);
    setOutput("");
    try {
      const pyodide = (await loadPyodide()) as {
        runPython: (code: string) => unknown;
        setStdout: (opts: { batched: (s: string) => void }) => void;
        setStderr: (opts: { batched: (s: string) => void }) => void;
      };

      let captured = "";
      pyodide.setStdout({
        batched: (s: string) => {
          captured += s + "\n";
        },
      });
      pyodide.setStderr({
        batched: (s: string) => {
          captured += "[stderr] " + s + "\n";
        },
      });

      const file = files[activeFile];
      if (!file) return;

      try {
        pyodide.runPython(file.code);
        setOutput(captured || "(no output)");
      } catch (err) {
        setOutput(
          captured + "\n" + (err instanceof Error ? err.message : String(err)),
        );
      }
    } catch (err) {
      setOutput("Failed to load Pyodide: " + String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Python Fundamentals</h3>
        <div className="flex items-center gap-2">
          {!ready && !loading && (
            <span className="text-xs text-zinc-400">
              Pyodide loads on first run (~10MB)
            </span>
          )}
          {loading && (
            <span className="text-xs text-amber-500 animate-pulse">
              Loading Python runtime...
            </span>
          )}
          {ready && (
            <span className="text-xs text-green-500">Python ready</span>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {files.map((file, i) => (
          <button
            key={file.name}
            onClick={() => {
              setActiveFile(i);
              setOutput("");
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeFile === i
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {file.name}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">
              {files[activeFile]?.name}
            </span>
            <button
              onClick={run}
              disabled={running}
              className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {running ? "Running..." : "Run ▶"}
            </button>
          </div>
          <pre className="flex-1 overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-sm text-green-400">
            <code>{files[activeFile]?.code}</code>
          </pre>
        </div>

        <div className="flex flex-col">
          <span className="mb-1 text-xs font-medium text-zinc-500">Output</span>
          <pre className="flex-1 overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-sm text-zinc-300">
            {output || "Click Run to execute the Python code"}
          </pre>
        </div>
      </div>
    </div>
  );
}
