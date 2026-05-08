"use client";

import { ApiExplorer } from "@/components/ui/ApiExplorer";

export function AdminPortalOriginal() {
  return (
    <ApiExplorer
      title="Admin Portal — Books API"
      baseUrl="/api/admin-portal"
      presets={[
        { label: "List all books", method: "GET", path: "/" },
        { label: "Get book #1", method: "GET", path: "/1" },
        {
          label: "Create a book",
          method: "POST",
          path: "/",
          body: JSON.stringify(
            {
              title: "Warp Speed",
              description: "A sci-fi thriller about faster-than-light travel",
              year: "2023",
              quantity: 50,
            },
            null,
            2,
          ),
        },
        {
          label: "Update book #1",
          method: "PUT",
          path: "/1",
          body: JSON.stringify({ quantity: 500 }, null, 2),
        },
        { label: "Delete book #3", method: "DELETE", path: "/3" },
      ]}
    />
  );
}
