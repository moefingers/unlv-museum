"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, Loader2 } from "lucide-react";
import styles from "./AdminPortalEnhanced.module.css";

/**
 * Enhanced-tier Replaced UI for the admin-portal book inventory.
 *
 * The Original tier preserves the source's verb-prefixed admin.html /
 * index.html / api-docs.html exactly (iframed at /js-exercises/admin-portal).
 * This component is the Enhanced surface — a freshly-written museum-era
 * React UI that talks to /api/v2/admin-portal/* (REST shape, audit log,
 * helpful 401, auto-cover synthesis on insert when no imageURL is given).
 *
 * Differences from the source iframe (era-impossible features):
 *   - inline search across title+description via /api/v2/admin-portal/search
 *   - low-stock badge driven by quantity ≤ LOW_STOCK_THRESHOLD
 *   - server-synthesized cover for any book that doesn't have one stored
 *   - audit-row toast after every successful mutation, surfacing the
 *     row that just landed in the audit log
 *   - sign-in required for writes (mirrors the Original-tier carve-out
 *     applied alongside this project; see api-guard.ts)
 *
 * All UI state is local — no global store, no router state. Every
 * mutation re-fetches the book list to stay in sync with the server's
 * post-cover-synthesis values (so newly-added books immediately show
 * the synthesized cover URL).
 */

const LOW_STOCK_THRESHOLD = 5;

interface Book {
  id: number;
  title: string;
  description: string | null;
  year: string | null;
  quantity: number;
  imageURL: string | null;
  createdAt: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; books: Book[] }
  | { kind: "err"; message: string };

interface Toast {
  id: number;
  kind: "success" | "error";
  message: string;
  /** Optional sub-line — used for the "audit row #N" follow-up after a write. */
  detail?: string;
}

interface BookFormState {
  title: string;
  description: string;
  year: string;
  quantity: string;
  imageURL: string;
}

const EMPTY_FORM: BookFormState = {
  title: "",
  description: "",
  year: "",
  quantity: "",
  imageURL: "",
};

/**
 * Debounce window for the search field. 250ms is the conventional
 * "feels instant but actually waits for typing to settle" target —
 * shorter (100ms) still fires several requests per word; longer
 * (500ms+) starts feeling laggy.
 */
const SEARCH_DEBOUNCE_MS = 250;

export function AdminPortalEnhanced() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // `query` is what the input shows (updates on every keystroke).
  // `debouncedQuery` is what the fetch effect actually reads — it
  // trails `query` by SEARCH_DEBOUNCE_MS so we don't hammer
  // /api/v2/admin-portal/search on every character.
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [editing, setEditing] = useState<Book | null>(null);
  const [adding, setAdding] = useState(false);

  // Reload counter — bumped by mutations to force a re-fetch even when
  // the debounced query hasn't changed. Read by the effect below
  // alongside `debouncedQuery`, so we don't need a `refresh` function
  // in scope at render-time (which would put setState reachable from
  // the effect's dep chain and trip react-hooks/set-state-in-effect).
  const [reloadKey, setReloadKey] = useState(0);
  const triggerReload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Debounce `query` → `debouncedQuery`. Bare-minimum implementation:
  // each `query` change schedules a setState that runs after the
  // debounce window; if `query` changes again first, the timeout is
  // cleared by the effect's cleanup. No external library needed.
  useEffect(() => {
    // No-op when query hasn't actually changed (avoids triggering a
    // re-fetch on initial mount, since debouncedQuery starts at "" too).
    if (debouncedQuery === query) return;
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, debouncedQuery]);

  // Fetch on mount, on debounced-query change, and on every
  // triggerReload(). The setState calls happen inside an awaited body
  // — they're microtask-deferred, not synchronous-in-effect — and the
  // AbortController unmount-guard prevents stale responses from
  // overwriting newer state if the debounced query advances again
  // while a fetch is still in flight.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setStatus({ kind: "loading" });
      try {
        const url = debouncedQuery.trim()
          ? `/api/v2/admin-portal/search?q=${encodeURIComponent(debouncedQuery.trim())}`
          : "/api/v2/admin-portal/books";
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) {
          setStatus({
            kind: "err",
            message: `Couldn't load books (status ${res.status})`,
          });
          return;
        }
        const data = await res.json();
        // Search returns { rows: [...] }, list returns the array directly.
        const rows: Book[] = Array.isArray(data) ? data : (data.rows ?? []);
        setStatus({ kind: "ok", books: rows });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setStatus({
          kind: "err",
          message: err instanceof Error ? err.message : "Network error",
        });
      }
    })();
    return () => ctrl.abort();
  }, [debouncedQuery, reloadKey]);

  // Toast helpers — show, auto-dismiss after a few seconds. Each toast
  // gets a unique id (incrementing counter via the timestamp + random).
  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { ...t, id }]);
    // Auto-dismiss after 5s for success, 8s for errors (more time to read).
    const ttl = t.kind === "error" ? 8000 : 5000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, ttl);
  }, []);

  // After a successful mutation, look up the audit-log row that was
  // just written so the toast can surface its id. Done as a separate
  // fetch (rather than reading from the mutation response) because the
  // current API doesn't return the audit-row id inline — the audit
  // endpoint is the canonical source.
  const showWriteToast = useCallback(
    async (verb: string, book: Book) => {
      pushToast({
        kind: "success",
        message: `${verb}: ${book.title}`,
        detail: "Recording audit entry…",
      });
      try {
        const res = await fetch(
          "/api/v2/admin-portal/audit-log?limit=1&tier=enhanced",
        );
        if (res.ok) {
          const body = (await res.json()) as {
            rows?: { id: number; actor_login: string | null }[];
          };
          const row = body.rows?.[0];
          if (row) {
            // Replace the most-recent toast with the audit-id follow-up.
            setToasts((prev) => {
              const next = [...prev];
              const idx = next.findIndex(
                (t) => t.message === `${verb}: ${book.title}`,
              );
              if (idx !== -1) {
                next[idx] = {
                  ...next[idx]!,
                  detail: `Recorded as audit entry #${row.id}${row.actor_login ? ` (by ${row.actor_login})` : ""}`,
                };
              }
              return next;
            });
          }
        }
      } catch {
        // Audit lookup is best-effort — the write already succeeded.
      }
    },
    [pushToast],
  );

  // POST /books — auto-cover fills imageURL when blank.
  const createBook = async (form: BookFormState): Promise<boolean> => {
    const body: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      quantity: form.quantity,
    };
    if (form.year) body.year = form.year;
    if (form.imageURL) body.imageURL = form.imageURL;

    try {
      const res = await fetch("/api/v2/admin-portal/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        pushToast({
          kind: "error",
          message:
            errBody.message ??
            errBody.error ??
            `Couldn't create the book (status ${res.status}).`,
          detail:
            res.status === 401
              ? "Sign in via the avatar menu (top-right) to add books."
              : undefined,
        });
        return false;
      }
      const created = (await res.json()) as Book;
      triggerReload();
      void showWriteToast("Added", created);
      return true;
    } catch (err) {
      pushToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
      return false;
    }
  };

  // PATCH /books/:id
  const updateBook = async (
    id: number,
    form: BookFormState,
  ): Promise<boolean> => {
    const body: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      quantity: form.quantity,
    };
    if (form.year) body.year = form.year;
    if (form.imageURL) body.imageURL = form.imageURL;
    try {
      const res = await fetch(`/api/v2/admin-portal/books/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        pushToast({
          kind: "error",
          message:
            errBody.message ??
            `Couldn't update the book (status ${res.status}).`,
          detail:
            res.status === 401
              ? "Sign in via the avatar menu (top-right) to edit books."
              : undefined,
        });
        return false;
      }
      const updated = (await res.json()) as Book;
      triggerReload();
      void showWriteToast("Updated", updated);
      return true;
    } catch (err) {
      pushToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
      return false;
    }
  };

  // DELETE /books/:id with confirm prompt (low-friction, matches the
  // source's admin.js prompt for delete confirmation).
  const deleteBook = async (book: Book) => {
    const ok = window.confirm(`Delete "${book.title}"? This can't be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/v2/admin-portal/books/${book.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        pushToast({
          kind: "error",
          message:
            errBody.message ??
            `Couldn't delete the book (status ${res.status}).`,
          detail:
            res.status === 401
              ? "Sign in via the avatar menu (top-right) to delete books."
              : undefined,
        });
        return;
      }
      triggerReload();
      void showWriteToast("Deleted", book);
    } catch (err) {
      pushToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  };

  const books = status.kind === "ok" ? status.books : [];

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.searchGroup}>
          <Search size={16} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or description"
            className={`text-sm ${styles.searchInput}`}
            aria-label="Search books"
          />
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={`btn btn-primary ${styles.addButton}`}
        >
          <Plus size={14} aria-hidden="true" />
          Add a book
        </button>
      </header>

      {status.kind === "loading" && (
        <div className={styles.center}>
          <Loader2 size={18} className={styles.spin} aria-hidden="true" />
          <span>Loading books…</span>
        </div>
      )}

      {status.kind === "err" && (
        <div className={`${styles.center} ${styles.error}`}>
          <p>{status.message}</p>
          <button type="button" onClick={triggerReload} className="btn">
            Try again
          </button>
        </div>
      )}

      {status.kind === "ok" && books.length === 0 && (
        <div className={styles.center}>
          <p>
            {/* Use debouncedQuery here, not query — the displayed
                results reflect the debounced fetch, so the empty-state
                copy should match. Otherwise, briefly after a user
                clears the input, we'd see "No books yet" alongside
                stale filtered results. */}
            {debouncedQuery.trim()
              ? `No books matching “${debouncedQuery.trim()}.”`
              : "No books yet — click “Add a book” to seed the inventory."}
          </p>
        </div>
      )}

      {books.length > 0 && (
        <div className={styles.grid}>
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onEdit={() => setEditing(book)}
              onDelete={() => void deleteBook(book)}
            />
          ))}
        </div>
      )}

      {adding && (
        <BookFormModal
          mode="add"
          initial={EMPTY_FORM}
          onClose={() => setAdding(false)}
          onSubmit={async (form) => {
            const ok = await createBook(form);
            if (ok) setAdding(false);
            return ok;
          }}
        />
      )}

      {editing && (
        <BookFormModal
          mode="edit"
          initial={{
            title: editing.title,
            description: editing.description ?? "",
            year: editing.year ?? "",
            quantity: String(editing.quantity),
            imageURL: editing.imageURL ?? "",
          }}
          editingId={editing.id}
          onClose={() => setEditing(null)}
          onSubmit={async (form) => {
            const ok = await updateBook(editing.id, form);
            if (ok) setEditing(null);
            return ok;
          }}
        />
      )}

      {/* Toast stack — newest at the bottom-right. */}
      <div className={styles.toasts} aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${
              t.kind === "error" ? styles.toastError : styles.toastSuccess
            }`}
          >
            <p className="text-sm">{t.message}</p>
            {t.detail && (
              <p className={`text-xs ${styles.toastDetail}`}>{t.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookCard({
  book,
  onEdit,
  onDelete,
}: {
  book: Book;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const low = book.quantity <= LOW_STOCK_THRESHOLD;
  return (
    <article className={styles.card}>
      <div className={styles.coverFrame}>
        {book.imageURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.imageURL}
            alt={`${book.title} cover`}
            className={styles.cover}
          />
        ) : (
          <div className={styles.coverPlaceholder}>No cover</div>
        )}
        {low && (
          <span className={styles.lowStockBadge} title="Low stock">
            {book.quantity} left
          </span>
        )}
      </div>
      <div className={styles.cardBody}>
        <h3 className={`text-sm ${styles.cardTitle}`}>{book.title}</h3>
        <p className={`text-xs ${styles.cardMeta}`}>
          {book.year ?? "—"} · {book.quantity} in stock
        </p>
        {book.description && (
          <p className={`text-xs ${styles.cardDescription}`}>
            {book.description}
          </p>
        )}
        <div className={styles.cardActions}>
          <button type="button" onClick={onEdit} className={styles.iconButton}>
            <Pencil size={14} aria-hidden="true" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
          >
            <Trash2 size={14} aria-hidden="true" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function BookFormModal({
  mode,
  initial,
  editingId,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit";
  initial: BookFormState;
  editingId?: number;
  onClose: () => void;
  onSubmit: (form: BookFormState) => Promise<boolean>;
}) {
  const [form, setForm] = useState<BookFormState>(initial);
  const [submitting, setSubmitting] = useState(false);

  // Esc closes the modal — same UX as ApiKeyModal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const previewUrl = (() => {
    if (form.imageURL.trim()) return form.imageURL.trim();
    if (!form.title.trim()) return null;
    // Preview-only cover URL — uses the editing book's id for stable
    // hashing on edit, or a `preview` slug for adds (since we don't
    // know the id yet).
    const seed = editingId !== undefined ? String(editingId) : "preview";
    const params = new URLSearchParams();
    params.set("title", form.title.trim());
    if (form.year.trim()) params.set("year", form.year.trim());
    return `/api/v2/admin-portal/cover/${seed}?${params.toString()}`;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalScrim}>
      <div className={styles.modal}>
        <header className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {mode === "add" ? "Add a book" : `Edit “${initial.title}”`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.modalClose}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>

        <form onSubmit={submit} className={styles.modalBody}>
          <div className={styles.modalGrid}>
            <div className={styles.modalForm}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Title</span>
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  required
                  maxLength={200}
                  className={styles.fieldInput}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  required
                  maxLength={500}
                  rows={3}
                  className={styles.fieldTextarea}
                />
              </label>
              <div className={styles.fieldRow}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Year</span>
                  <input
                    value={form.year}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, year: e.target.value }))
                    }
                    maxLength={10}
                    placeholder="2026"
                    className={styles.fieldInput}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Quantity</span>
                  <input
                    type="number"
                    min={0}
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, quantity: e.target.value }))
                    }
                    required
                    className={styles.fieldInput}
                  />
                </label>
              </div>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Image URL{" "}
                  <span className={styles.fieldHint}>
                    (leave blank to auto-synthesize)
                  </span>
                </span>
                <input
                  value={form.imageURL}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, imageURL: e.target.value }))
                  }
                  maxLength={500}
                  placeholder="https://… or blank"
                  className={styles.fieldInput}
                />
              </label>
            </div>
            <div className={styles.modalPreview}>
              <span className={`text-xs ${styles.fieldLabel}`}>Preview</span>
              <div className={styles.modalPreviewFrame}>
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Cover preview"
                    className={styles.modalPreviewImage}
                  />
                ) : (
                  <div className={styles.coverPlaceholder}>
                    Type a title to preview
                  </div>
                )}
              </div>
            </div>
          </div>

          <footer className={styles.modalFooter}>
            <button type="button" onClick={onClose} className="btn">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting
                ? "Saving…"
                : mode === "add"
                  ? "Add book"
                  : "Save changes"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
