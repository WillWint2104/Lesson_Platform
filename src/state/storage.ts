/**
 * @file storage.ts — Storage backend + robust load for the progress store.
 *
 * Keeps the unsafe edges (a possibly-absent localStorage, corrupt or
 * future-versioned stored JSON, and a v1→v2 migration) away from the store core.
 *
 *   - localStorage unavailable (private mode / SSR) → in-memory fallback
 *   - unparseable JSON → backed up to lp:progress:corrupt, then fresh
 *   - newer schema version → left untouched, in-memory session
 *   - older (v1) data, no v2 yet → returned for migration (v1 key left intact)
 */

export const PROGRESS_KEY_V1 = "lp:progress:v1";
export const PROGRESS_KEY = "lp:progress:v2"; // current
export const CORRUPT_KEY = "lp:progress:corrupt";
export const SCHEMA_VERSION = 2;

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

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
  | { status: "ok"; parsed: Record<string, unknown> } // current-version data
  | { status: "migrate"; fromVersion: number; parsed: Record<string, unknown> } // older data
  | { status: "corrupt" } // raw already backed up
  | { status: "future" }; // newer schema version; caller must not persist

function safeGet(backend: StorageBackend, key: string): string | null {
  try {
    return backend.getItem(key);
  } catch {
    return null;
  }
}

function parseObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function backupCorrupt(backend: StorageBackend, raw: string): void {
  try {
    backend.setItem(CORRUPT_KEY, raw);
  } catch {
    /* best effort */
  }
}

/**
 * Read + classify stored progress. Prefers the current (v2) key; falls back to
 * the v1 key for migration (leaving v1 intact). Never throws, never destroys.
 */
export function loadRaw(backend: StorageBackend): LoadResult {
  const raw2 = safeGet(backend, PROGRESS_KEY);
  if (raw2 != null) {
    const parsed = parseObject(raw2);
    if (!parsed) {
      backupCorrupt(backend, raw2);
      return { status: "corrupt" };
    }
    const version = parsed["version"];
    if (typeof version === "number" && version > SCHEMA_VERSION) return { status: "future" };
    return { status: "ok", parsed };
  }

  const raw1 = safeGet(backend, PROGRESS_KEY_V1);
  if (raw1 != null) {
    const parsed = parseObject(raw1);
    if (!parsed) {
      backupCorrupt(backend, raw1);
      return { status: "corrupt" };
    }
    const fromVersion = typeof parsed["version"] === "number" ? (parsed["version"] as number) : 1;
    return { status: "migrate", fromVersion, parsed };
  }

  return { status: "empty" };
}
