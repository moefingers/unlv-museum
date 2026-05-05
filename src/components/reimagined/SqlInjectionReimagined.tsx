"use client";

import { useState } from "react";

interface Step {
  id: number;
  title: string;
  description: string;
  vulnerableCode: string;
  safeCode: string;
  testInput: string;
  explanation: string;
}

const STEPS: Step[] = [
  {
    id: 1,
    title: "Basic SQL Injection",
    description: "The classic ' OR '1'='1 attack that bypasses authentication.",
    vulnerableCode: `SELECT * FROM users
WHERE username = '\${input}'
AND password = '\${password}'`,
    safeCode: `SELECT * FROM users
WHERE username = $1
AND password = $2
-- Parameters: [$1, $2]`,
    testInput: "' OR '1'='1",
    explanation:
      "By injecting a quote and OR condition, the attacker makes the WHERE clause always true, returning all rows.",
  },
  {
    id: 2,
    title: "UNION-based Extraction",
    description: "Using UNION to extract data from other tables.",
    vulnerableCode: `SELECT name, price FROM products
WHERE id = \${input}`,
    safeCode: `SELECT name, price FROM products
WHERE id = $1
-- $1 is validated as integer`,
    testInput: "1 UNION SELECT username, password FROM users--",
    explanation:
      "The attacker appends a UNION query to extract sensitive data from the users table alongside product data.",
  },
  {
    id: 3,
    title: "DROP TABLE Attack",
    description: "Destructive injection that deletes entire tables.",
    vulnerableCode: `SELECT * FROM posts
WHERE title LIKE '%\${input}%'`,
    safeCode: `SELECT * FROM posts
WHERE title LIKE '%' || $1 || '%'
-- $1 is escaped`,
    testInput: "'; DROP TABLE posts; --",
    explanation:
      "The attacker terminates the query, injects a DROP TABLE command, and comments out the rest. This destroys the entire table.",
  },
];

export function SqlInjectionReimagined() {
  const [currentStep, setCurrentStep] = useState(0);
  const [showSafe, setShowSafe] = useState(false);
  const [input, setInput] = useState("");
  const [showResult, setShowResult] = useState(false);

  const step = STEPS[currentStep]!;

  const simulateQuery = () => {
    setShowResult(true);
  };

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-2 text-2xl font-bold">
        SQL Injection Tutorial
        <span className="ml-2 text-sm font-normal text-amber-500">
          Reimagined
        </span>
      </h2>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Learn how SQL injection works and how to prevent it. Interactive, safe,
        educational.
      </p>

      <div className="mb-6 flex gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => {
              setCurrentStep(i);
              setShowResult(false);
              setShowSafe(false);
              setInput("");
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${currentStep === i ? "bg-red-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            Step {s.id}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            {step.description}
          </p>

          <div className="mb-3 inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              onClick={() => setShowSafe(false)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${!showSafe ? "bg-red-500 text-white" : ""}`}
            >
              Vulnerable
            </button>
            <button
              onClick={() => setShowSafe(true)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${showSafe ? "bg-green-500 text-white" : ""}`}
            >
              Safe
            </button>
          </div>

          <pre className="mb-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-green-400">
            {showSafe ? step.safeCode : step.vulnerableCode}
          </pre>

          <div className="space-y-2">
            <label className="text-sm font-medium">Try an input:</label>
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setShowResult(false);
                }}
                placeholder="Enter user input..."
                className="flex-1 rounded border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-800"
              />
              <button
                onClick={() => setInput(step.testInput)}
                className="rounded bg-red-100 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400"
              >
                Use Attack
              </button>
            </div>
            <button
              onClick={simulateQuery}
              className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Execute
            </button>
          </div>
        </div>

        <div>
          {showResult && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950">
                <p className="mb-1 text-xs font-bold text-red-600 dark:text-red-400">
                  VULNERABLE RESULT
                </p>
                <pre className="text-sm">
                  {step.vulnerableCode
                    .replace("${input}", input)
                    .replace("${password}", input)}
                </pre>
                {input.includes("'") && (
                  <p className="mt-2 text-sm font-bold text-red-700 dark:text-red-300">
                    ⚠️ SQL injection detected! The query structure was modified.
                  </p>
                )}
              </div>

              <div className="rounded-lg border-2 border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950">
                <p className="mb-1 text-xs font-bold text-green-600 dark:text-green-400">
                  SAFE RESULT
                </p>
                <pre className="text-sm">{step.safeCode}</pre>
                <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                  ✅ Input is treated as data, not code. Attack neutralized.
                </p>
              </div>

              <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                <p className="text-xs font-bold text-zinc-500">EXPLANATION</p>
                <p className="mt-1 text-sm">{step.explanation}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
