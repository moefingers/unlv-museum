"use client";

import { ApiExplorer } from "@/components/ui/ApiExplorer";

export function MusicTourOriginal() {
  return (
    <ApiExplorer
      title="Music Tour API"
      baseUrl="/api/music-tour"
      presets={[
        { label: "List all bands", method: "GET", path: "/" },
        { label: "Get band #1", method: "GET", path: "/1" },
        { label: "Get band #2 with events", method: "GET", path: "/2" },
        {
          label: "Create a band",
          method: "POST",
          path: "/",
          body: JSON.stringify(
            { name: "Midnight Rodeo", genre: "Country Rock", formedYear: 2022 },
            null,
            2,
          ),
        },
        { label: "Delete band #4", method: "DELETE", path: "/4" },
      ]}
    />
  );
}
