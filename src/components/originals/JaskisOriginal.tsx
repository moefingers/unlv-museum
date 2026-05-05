"use client";

import { ApiExplorer } from "@/components/ui/ApiExplorer";

export function JaskisOriginal() {
  return (
    <ApiExplorer
      title="JASKIS API"
      baseUrl="/api/jaskis"
      presets={[
        { label: "List all spots", method: "GET", path: "/" },
        { label: "Get spot #1", method: "GET", path: "/1" },
        {
          label: "Create a spot",
          method: "POST",
          path: "/",
          body: JSON.stringify(
            {
              name: "Golden Waffle House",
              city: "Las Vegas",
              state: "NV",
              cuisine: "Breakfast",
            },
            null,
            2,
          ),
        },
        {
          label: "Update spot #1",
          method: "PUT",
          path: "/1",
          body: JSON.stringify({ cuisine: "Brunch" }, null, 2),
        },
        { label: "Delete spot #2", method: "DELETE", path: "/2" },
      ]}
    />
  );
}
