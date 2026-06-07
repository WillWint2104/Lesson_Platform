/**
 * @file progress.ts — Learner progress store, SCHEMA v3 (CLAUDE.md §a, §c 3 & 7).
 *
 * v3 keys progress by **areaId + stage index**, each stage with separate `core`
 * and `extra` outcome maps. A stage is complete when every CORE question has an
 * outcome (ANY outcome — never gated on correctness); extra never affects
 * completion. completedAt is sticky: review re-runs record fresh outcomes +
 * attempts but never clear it.
 *
 * Save/restore symmetry (lesson 3): ONE serialize + ONE restore, colocated, with
 * an explicit whitelist. The round-trip test fails if a field is dropped.
 *
 * Migration: older (v2/v1) data has no derivable v3 mapping in this pure layer,
 * so it is **preserved verbatim under `legacy` (.v2 / .v1), never destroyed**,
 * and the old key is left intact. Bump SCHEMA_VERSION + add a migration on ANY
 * breaking shape change.
 */

import {
  CORRUPT_KEY,
  PROGRESS_KEY,
  SCHEMA_VERSION,
  detectBackend,
  loadRaw,
  type StorageBackend,
} from "./storage";

export type Outcome = "correct" | "incorrect";
export type StageView = "stage" | "exercise";
export type QuestionPool = "core" | "extra";

/** Progress within one stage. */
export interface StageRecord {
  core: Record<number, Outcome>;
  extra: Record<number, Outcome>;
  attempts: number;
  completedAt: string | null;
}

/** Per-area record: stage progress keyed by stage index. */
export interface AreaRecord {
  stages: Record<number, StageRecord>;
}

/** Where the learner last was. */
export interface LastVisited {
  areaId: string;
  stageIndex: number;
  view: StageView;
}

/** Older-schema data preserved verbatim (never destroyed, never re-shaped). */
export interface LegacyBucket {
  v1?: unknown;
  v2?: unknown;
}

export interface ProgressState {
  version: 3;
  lastVisited: LastVisited | null;
  areas: Record<string, AreaRecord>;
  legacy: LegacyBucket | null;
}

export interface ProgressStore {
  readonly persistent: boolean;
  /** Deep copy — callers cannot mutate the store through it. */
  getState(): ProgressState;
  /** Stale-id-guarded: null when the stored area id is absent from the registry. */
  getLastVisited(): LastVisited | null;
  /** Stage record for (area, stage), or null (stale area excluded). */
  getStageProgress(areaId: string, stageIndex: number): StageRecord | null;
  recordOutcome(
    areaId: string,
    stageIndex: number,
    pool: QuestionPool,
    questionIndex: number,
    outcome: Outcome,
  ): void;
  recordAttempt(areaId: string, stageIndex: number, completed: boolean): void;
  setLastVisited(areaId: string, stageIndex: number, view: StageView): void;
  resetAll(): void;
  subscribe(listener: () => void): () => void;
  isNoticeDismissed(noticeId: string): boolean;
  dismissNotice(noticeId: string): void;
}

export interface CreateProgressStoreOptions {
  backend?: StorageBackend;
  persistent?: boolean;
  /** Known area ids (from the registry) — enables the stale-id guard. */
  areaIds?: string[];
  now?: () => string;
}

function freshState(): ProgressState {
  return { version: SCHEMA_VERSION, lastVisited: null, areas: {}, legacy: null };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Save / restore — ONE serialize + ONE restore, explicit whitelist.
// ---------------------------------------------------------------------------

function cloneStage(rec: StageRecord): StageRecord {
  return {
    core: { ...rec.core },
    extra: { ...rec.extra },
    attempts: rec.attempts,
    completedAt: rec.completedAt,
  };
}

function cloneAreas(areas: Record<string, AreaRecord>): Record<string, AreaRecord> {
  const out: Record<string, AreaRecord> = {};
  for (const [areaId, rec] of Object.entries(areas)) {
    const stages: Record<number, StageRecord> = {};
    for (const [idx, st] of Object.entries(rec.stages)) stages[Number(idx)] = cloneStage(st);
    out[areaId] = { stages };
  }
  return out;
}

function cloneLegacy(legacy: LegacyBucket | null): LegacyBucket | null {
  return legacy ? { ...legacy } : null;
}

export function serializeState(state: ProgressState): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    lastVisited: state.lastVisited,
    areas: cloneAreas(state.areas),
    legacy: state.legacy,
  });
}

function restoreOutcomes(raw: unknown): Record<number, Outcome> {
  const out: Record<number, Outcome> = {};
  if (isObject(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (v === "correct" || v === "incorrect") out[Number(k)] = v;
    }
  }
  return out;
}

function restoreStage(raw: unknown): StageRecord {
  const r = isObject(raw) ? raw : {};
  return {
    core: restoreOutcomes(r["core"]),
    extra: restoreOutcomes(r["extra"]),
    attempts: typeof r["attempts"] === "number" ? (r["attempts"] as number) : 0,
    completedAt: typeof r["completedAt"] === "string" ? (r["completedAt"] as string) : null,
  };
}

function restoreLastVisited(raw: unknown): LastVisited | null {
  if (!isObject(raw)) return null;
  const areaId = raw["areaId"];
  const stageIndex = raw["stageIndex"];
  const view = raw["view"];
  if (typeof areaId !== "string") return null;
  if (typeof stageIndex !== "number") return null;
  if (view !== "stage" && view !== "exercise") return null;
  return { areaId, stageIndex, view };
}

export function restoreState(parsed: Record<string, unknown>): ProgressState {
  const areasIn = isObject(parsed["areas"]) ? (parsed["areas"] as Record<string, unknown>) : {};
  const areas: Record<string, AreaRecord> = {};
  for (const [areaId, recRaw] of Object.entries(areasIn)) {
    const stagesIn =
      isObject(recRaw) && isObject((recRaw as Record<string, unknown>)["stages"])
        ? ((recRaw as Record<string, unknown>)["stages"] as Record<string, unknown>)
        : {};
    const stages: Record<number, StageRecord> = {};
    for (const [idx, stRaw] of Object.entries(stagesIn)) stages[Number(idx)] = restoreStage(stRaw);
    areas[areaId] = { stages };
  }

  let legacy: LegacyBucket | null = null;
  if (isObject(parsed["legacy"])) {
    const l = parsed["legacy"] as Record<string, unknown>;
    legacy = {};
    if (l["v1"] !== undefined) legacy.v1 = l["v1"];
    if (l["v2"] !== undefined) legacy.v2 = l["v2"];
  }

  return {
    version: SCHEMA_VERSION,
    lastVisited: restoreLastVisited(parsed["lastVisited"]),
    areas,
    legacy,
  };
}

/**
 * Migrate older (v2/v1) data to v3. Older records have no derivable area/stage
 * mapping in this pure layer, so they are preserved VERBATIM under `legacy`:
 * `legacy.v2` = the v2 blob, and `legacy.v1` = any v1 nested inside it (or the
 * v1 blob directly when migrating straight from v1).
 */
export function migrateToV3(parsed: Record<string, unknown>, fromVersion: number): ProgressState {
  const legacy: LegacyBucket = {};
  if (fromVersion >= 2) {
    legacy.v2 = parsed;
    // A v2 blob carries its own `legacy` (the original v1) — preserve it too.
    if (isObject(parsed["legacy"])) legacy.v1 = parsed["legacy"];
  } else {
    legacy.v1 = parsed;
  }
  return { version: SCHEMA_VERSION, lastVisited: null, areas: {}, legacy };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export function createProgressStore(options: CreateProgressStoreOptions = {}): ProgressStore {
  const detected = options.backend
    ? { backend: options.backend, persistent: options.persistent ?? true }
    : detectBackend();
  const backend = detected.backend;
  const backendPersistent = detected.persistent;

  const knownAreaIds = new Set(options.areaIds ?? []);
  // Truthiness is not validity (CLAUDE.md §c rule 7): the registry is "present"
  // whenever areaIds was supplied — even as an empty array.
  const hasRegistry = options.areaIds !== undefined;
  const now = options.now ?? (() => new Date().toISOString());

  function isKnownAreaId(areaId: string): boolean {
    return !hasRegistry || knownAreaIds.has(areaId);
  }

  const listeners = new Set<() => void>();
  const dismissedNotices = new Set<string>();

  const load = loadRaw(backend);
  let persistDisabled = false;
  let state: ProgressState;
  let migrated = false;
  switch (load.status) {
    case "ok":
      state = restoreState(load.parsed);
      break;
    case "migrate":
      state = migrateToV3(load.parsed, load.fromVersion);
      migrated = true; // persist the migrated v3 (leaving the old key intact)
      break;
    case "future":
      persistDisabled = true;
      state = freshState();
      break;
    case "corrupt":
    case "empty":
    default:
      state = freshState();
      break;
  }

  const persistent = backendPersistent && !persistDisabled;

  function persist(): void {
    if (persistDisabled) return;
    try {
      backend.setItem(PROGRESS_KEY, serializeState(state));
    } catch {
      /* quota/serialisation failure must not crash */
    }
  }

  if (!backendPersistent) {
    console.warn(
      "[progress] localStorage is unavailable; progress will be kept in memory for this session only.",
    );
  }
  if (load.status === "corrupt") {
    console.warn(
      `[progress] stored progress was unparseable; backed up to "${CORRUPT_KEY}" and started fresh.`,
    );
  }
  if (load.status === "future") {
    console.warn(
      "[progress] stored progress is from a newer version; leaving it untouched and using an in-memory session.",
    );
  }
  if (migrated) {
    console.warn(
      "[progress] migrated older progress to v3 — old records preserved verbatim under `legacy` (the old key is left intact).",
    );
    persist();
  }
  if (hasRegistry) {
    const stale = Object.keys(state.areas).filter((id) => !knownAreaIds.has(id));
    if (stale.length > 0) {
      console.warn(
        `[progress] ${stale.length} stored area id(s) are not in the registry and are excluded from queries (retained): ${stale.join(", ")}`,
      );
    }
  }

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function ensureStage(areaId: string, stageIndex: number): StageRecord {
    let area = state.areas[areaId];
    if (!area) {
      area = { stages: {} };
      state.areas[areaId] = area;
    }
    let stage = area.stages[stageIndex];
    if (!stage) {
      stage = { core: {}, extra: {}, attempts: 0, completedAt: null };
      area.stages[stageIndex] = stage;
    }
    return stage;
  }

  return {
    persistent,

    getState() {
      return {
        version: state.version,
        lastVisited: state.lastVisited ? { ...state.lastVisited } : null,
        areas: cloneAreas(state.areas),
        legacy: cloneLegacy(state.legacy),
      };
    },

    getLastVisited() {
      const lv = state.lastVisited;
      if (lv === null) return null;
      if (!isKnownAreaId(lv.areaId)) return null;
      return { ...lv };
    },

    getStageProgress(areaId, stageIndex) {
      if (!isKnownAreaId(areaId)) return null;
      const stage = state.areas[areaId]?.stages[stageIndex];
      return stage ? cloneStage(stage) : null;
    },

    recordOutcome(areaId, stageIndex, pool, questionIndex, outcome) {
      if (!isKnownAreaId(areaId)) return; // never persist ghost area records
      ensureStage(areaId, stageIndex)[pool][questionIndex] = outcome;
      persist();
      notify();
    },

    recordAttempt(areaId, stageIndex, completed) {
      if (!isKnownAreaId(areaId)) return;
      const stage = ensureStage(areaId, stageIndex);
      stage.attempts += 1;
      if (completed && stage.completedAt === null) stage.completedAt = now();
      persist();
      notify();
    },

    setLastVisited(areaId, stageIndex, view) {
      if (!isKnownAreaId(areaId)) return; // never persist a stale last-visited id
      state.lastVisited = { areaId, stageIndex, view };
      persist();
      notify();
    },

    resetAll() {
      const keepLegacy = state.legacy; // resetting current progress must not destroy legacy
      state = freshState();
      state.legacy = keepLegacy;
      persist();
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    isNoticeDismissed(noticeId) {
      if (dismissedNotices.has(noticeId)) return true;
      try {
        return backend.getItem(`lp:notice:${noticeId}`) === "1";
      } catch {
        return false;
      }
    },

    dismissNotice(noticeId) {
      dismissedNotices.add(noticeId);
      try {
        backend.setItem(`lp:notice:${noticeId}`, "1");
      } catch {
        /* in-memory flag still hides it for the session */
      }
      notify();
    },
  };
}
