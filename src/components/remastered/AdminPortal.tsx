"use client";

import { useState } from "react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

const INITIAL_USERS: User[] = [
  {
    id: 1,
    name: "Arathrae",
    email: "arathrae@example.com",
    role: "Admin",
    avatar: "🧙",
  },
  {
    id: 2,
    name: "Tess",
    email: "tess@example.com",
    role: "Editor",
    avatar: "👩‍💻",
  },
  {
    id: 3,
    name: "Shinobi",
    email: "shinobi@example.com",
    role: "Viewer",
    avatar: "🥷",
  },
  {
    id: 4,
    name: "Warp",
    email: "warp@example.com",
    role: "Editor",
    avatar: "🚀",
  },
];

export function AdminPortal() {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "Viewer" });

  const startEdit = (user: User) => {
    setEditing(user.id);
    setForm({ name: user.name, email: user.email, role: user.role });
  };

  const saveEdit = () => {
    if (editing === null) return;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === editing
          ? { ...u, name: form.name, email: form.email, role: form.role }
          : u,
      ),
    );
    setEditing(null);
  };

  const deleteUser = (id: number) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const addUser = () => {
    const newId = Math.max(...users.map((u) => u.id), 0) + 1;
    const avatars = ["👤", "🧑‍💼", "🦸", "🤖"];
    setUsers((prev) => [
      ...prev,
      {
        id: newId,
        name: `User ${newId}`,
        email: `user${newId}@example.com`,
        role: "Viewer",
        avatar: avatars[newId % avatars.length]!,
      },
    ]);
  };

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Admin Portal</h2>
        <button
          onClick={addUser}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + Add User
        </button>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex items-center gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
          >
            <span className="text-2xl">{user.avatar}</span>

            {editing === user.id ? (
              <div className="flex flex-1 flex-wrap gap-2">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  placeholder="Name"
                />
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  placeholder="Email"
                />
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                >
                  <option>Admin</option>
                  <option>Editor</option>
                  <option>Viewer</option>
                </select>
                <button
                  onClick={saveEdit}
                  className="rounded bg-green-600 px-3 py-1 text-sm text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded bg-zinc-200 px-3 py-1 text-sm dark:bg-zinc-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-zinc-500">{user.email}</p>
                </div>
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium dark:bg-zinc-800">
                  {user.role}
                </span>
                <button
                  onClick={() => startEdit(user)}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteUser(user.id)}
                  className="text-sm text-red-600 hover:underline dark:text-red-400"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
