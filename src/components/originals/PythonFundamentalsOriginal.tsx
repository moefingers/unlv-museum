"use client";

import { useState, useEffect } from "react";
import { PyodideRunner } from "@/components/ui/PyodideRunner";

const FILE_NAMES = [
  "ppp-3-basic-oop.py",
  "ppp-3-the-four-pillars-of-object-oriented-programming.py",
  "ppp-3-reflecting-on-coding-paradigms.py",
  "ppp-4-currency-exchange-emulator.py",
  "ppp-4-error-checking-and-handling.py",
  "ppp-4-functional-programming-in-python.py",
  "functions_practice_mohammad.py",
  "functions.py",
];

export function PythonFundamentalsOriginal() {
  const [files, setFiles] = useState<{ name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const loaded: { name: string; code: string }[] = [];
      for (const name of FILE_NAMES) {
        try {
          const res = await fetch(`/originals/python-fundamentals/${name}`);
          if (res.ok) {
            const code = await res.text();
            loaded.push({ name, code });
          }
        } catch {
          /* skip missing files */
        }
      }
      if (!cancelled) {
        setFiles(loaded);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-400">Loading Python files...</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-400">No Python files found</p>
      </div>
    );
  }

  return <PyodideRunner files={files} />;
}
