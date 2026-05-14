"use client";

import { useState } from "react";
import { ApiExplorer, type ApiConfig } from "@/components/ui/ApiExplorer";

const ALL_APIS: ApiConfig[] = [
  {
    title: "Music Tour API",
    baseUrl: "/api/music-tour",
    presets: [
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
    ],
  },
  {
    title: "JASKIS API",
    baseUrl: "/api/jaskis",
    presets: [
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
    ],
  },
  {
    title: "Admin Portal",
    baseUrl: "/api/admin-portal",
    presets: [
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
    ],
  },
  {
    title: "Rest-Rant API",
    baseUrl: "/api/rest-rant",
    presets: [
      { label: "List all places", method: "GET", path: "/places" },
      {
        label: "Get place #1 (with comments)",
        method: "GET",
        path: "/places/1",
      },
      {
        label: "Create a place",
        method: "POST",
        path: "/places",
        body: JSON.stringify(
          {
            name: "Magnolia Bakery",
            city: "Las Vegas",
            state: "NV",
            cuisines: "Bakery, Coffee",
            pic: "https://placebear.com/g/405/400",
            founded: 2014,
          },
          null,
          2,
        ),
      },
      {
        label: "Update place #1",
        method: "PUT",
        path: "/places/1",
        body: JSON.stringify({ cuisines: "Thai" }, null, 2),
      },
      { label: "Delete place #5", method: "DELETE", path: "/places/5" },
      {
        label: "Comment on place #2",
        method: "POST",
        path: "/places/2/comments",
        body: JSON.stringify(
          {
            authorId: 1,
            stars: 5,
            content: "Best cappuccino in Phoenix.",
            rant: false,
          },
          null,
          2,
        ),
      },
      {
        label: "Delete comment #1 of place #1",
        method: "DELETE",
        path: "/places/1/comments/1",
      },
      {
        label: "Sign up new user",
        method: "POST",
        path: "/users",
        body: JSON.stringify(
          {
            firstName: "Alex",
            lastName: "Sample",
            email: "alex@example.com",
            password: "password",
          },
          null,
          2,
        ),
      },
      {
        label: "Login (john@example.com)",
        method: "POST",
        path: "/authentication",
        body: JSON.stringify(
          { email: "john@example.com", password: "password" },
          null,
          2,
        ),
      },
    ],
  },
  {
    title: "SQL Injection Demo",
    baseUrl: "/api/sql-demo",
    presets: [
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
    ],
  },
];

export function ApiOriginal({ startWith }: { startWith: string }) {
  const initial = ALL_APIS.find((a) => a.title === startWith) ?? ALL_APIS[0]!;
  const [active, setActive] = useState<ApiConfig>(initial);

  return (
    <ApiExplorer
      key={active.baseUrl}
      title={active.title}
      baseUrl={active.baseUrl}
      presets={active.presets}
      siblings={ALL_APIS}
      onSwitch={setActive}
    />
  );
}
