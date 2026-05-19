"use client";

import { useState, useRef, useCallback } from "react";
import styles from "./PyodideRunner.module.css";

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
    <div className={styles.shell}>
      <div className={styles.header}>
        <h3 className="text-lg font-semibold">Python Fundamentals</h3>
        <div className={styles.status}>
          {!ready && !loading && (
            <span className={`text-xs ${styles.statusIdle}`}>
              Pyodide loads on first run (~10MB)
            </span>
          )}
          {loading && (
            <span className={`text-xs ${styles.statusLoading}`}>
              Loading Python runtime...
            </span>
          )}
          {ready && (
            <span className={`text-xs ${styles.statusReady}`}>
              Python ready
            </span>
          )}
        </div>
      </div>

      <div className={styles.fileTabs}>
        {files.map((file, i) => (
          <button
            key={file.name}
            onClick={() => {
              setActiveFile(i);
              setOutput("");
            }}
            className={`${styles.fileTab} ${
              activeFile === i ? styles.fileTabActive : ""
            }`}
          >
            {file.name}
          </button>
        ))}
      </div>

      <div className={styles.panes}>
        <div className={styles.pane}>
          <div className={styles.paneHeader}>
            <span className={`text-xs ${styles.paneLabel}`}>
              {files[activeFile]?.name}
            </span>
            <button
              onClick={run}
              disabled={running}
              className={`btn btn-sm ${styles.runButton}`}
            >
              {running ? "Running..." : "Run ▶"}
            </button>
          </div>
          <pre className={styles.codeBlock}>
            <code>{files[activeFile]?.code}</code>
          </pre>
        </div>

        <div className={styles.pane}>
          <span className={`text-xs ${styles.paneLabel}`}>Output</span>
          <pre className={styles.outputBlock}>
            {output || "Click Run to execute the Python code"}
          </pre>
        </div>
      </div>
    </div>
  );
}
