/**
 * @file storage.ts — Storage backend + robust load for the progress store.
 *
 * Keeps the unsafe edges (a possibly-absent localStorage, corrupt or
 * future-versioned stored JSON) away from the store core. Detection and parsing
 * never throw and never destroy data:
 *   - localStorage unavailable (private mode / SSR) → in-memory fallback
 *   - unparseable JSON → backed up to lp:progress:corrupt, then fresh
 *   - newer schema version → left untouched, in-memory session
 * The store emits the user-facing warnings (once per instance) based on the
 * results returned here.
 */

export const PROGRESS_KEY = "lp:progress:v1";
export const CORRUPT_KEY = "lp:progress:corrupt";
export const SCHEMA_VERSION = 1;

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A volatile Map-backed backend used when localStorage is unavailable. */
export function createMemoryBackend(): StorageBackend {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/** Detect a usable persistent backend, falling back to memory. Never throws. */
export function detectBackend(): { backend: StorageBackend; persistent: boolean } {
  try {
    if (typeof localStorage === "undefined") throw new Error("no localStorage");
    const probe = "lp:probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return { backend: localStorage, persistent: true };
  } catch {
    return { backend: createMemoryBackend(), persistent: false };
  }
}

export type LoadResult =
  | { status: "empty" }
  | { status: "ok"; parsed: Record<string, unknown> }
  | { status: "corrupt" } // raw already backed up to CORRUPT_KEY
  | { status: "future" }; // newer schema version; caller must not persist

/**
 * Read + parse the stored progress, classifying the outcome. Side effects are
 * limited to backing up a corrupt blob; it never overwrites or deletes good
 * data and never throws.
 */
export function loadRaw(backend: StorageBackend): LoadResult {
  let raw: string | null = null;
  try {
    raw = backend.getItem(PROGRESS_KEY);
  } catch {
    return { status: "empty" };
  }
  if (raw == null) return { status: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    backupCorrupt(backend, raw);
    return { status: "corrupt" };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    backupCorrupt(backend, raw);
    return { status: "corrupt" };
  }

  const version = (parsed as Record<string, unknown>)["version"];
  if (typeof version === "number" && version > SCHEMA_VERSION) {
    return { status: "future" };
  }

  return { status: "ok", parsed: parsed as Record<string, unknown> };
}

function backupCorrupt(backend: StorageBackend, raw: string): void {
  try {
    backend.setItem(CORRUPT_KEY, raw);
  } catch {
    // Best effort — if we can't back up, we still must not destroy the original
    // until we overwrite it on the next successful save.
  }
}
