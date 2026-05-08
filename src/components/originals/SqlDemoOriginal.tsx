"use client";

import { ApiExplorer } from "@/components/ui/ApiExplorer";

export function SqlDemoOriginal() {
  return (
    <ApiExplorer
      title="SQL Injection Demo — Live Database"
      baseUrl="/api/sql-demo"
      presets={[
        {
          label: "Normal login (vulnerable)",
          method: "POST",
          path: "/",
          body: JSON.stringify(
            { username: "admin", password: "s3cur3P@ss", mode: "vulnerable" },
            null,
            2,
          ),
        },
        {
          label: "SQL injection attack!",
          method: "POST",
          path: "/",
          body: JSON.stringify(
            {
              username: "' OR '1'='1' --",
              password: "anything",
              mode: "vulnerable",
            },
            null,
            2,
          ),
        },
        {
          label: "Same attack (safe mode)",
          method: "POST",
          path: "/",
          body: JSON.stringify(
            {
              username: "' OR '1'='1' --",
              password: "anything",
              mode: "safe",
            },
            null,
            2,
          ),
        },
        {
          label: "Normal login (safe)",
          method: "POST",
          path: "/",
          body: JSON.stringify(
            { username: "alice", password: "alice123", mode: "safe" },
            null,
            2,
          ),
        },
      ]}
    />
  );
}
