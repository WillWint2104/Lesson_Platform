/**
 * @file progress.ts — Learner progress store, SCHEMA v2 (CLAUDE.md §a, §c 3 & 7).
 *
 * v2 keys progress by **areaId + segment index**: each exercise segment has its
 * own questionOutcomes / attempts / completedAt. An area is complete when all
 * its exercise segments are complete (computed by consumers from the registry).
 *
 * Save/restore symmetry (lesson 3): ONE serialize + ONE restore, colocated, with
 * an explicit whitelist. The round-trip test fails if a field is dropped.
 *
 * Migration: v1 (per-lesson) data is migrated to v2 on load — v1 lesson records
 * are NOT derivably mappable to v2 area/segments in this pure layer, so they are
 * **preserved verbatim under `legacy`, never destroyed**, and the v1 key is left
 * intact. Bump SCHEMA_VERSION + add a migration on ANY breaking shape change.
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

/** Progress within one exercise segment. */
export interface ExerciseRecord {
  questionOutcomes: Record<number, Outcome>;
  attempts: number;
  completedAt: string | null;
}

/** Per-area record: exercise progress keyed by segment index. */
export interface AreaRecord {
  segments: Record<number, ExerciseRecord>;
}

/** Preserved v1 data that has no derivable v2 mapping (never destroyed). */
export interface LegacyV1 {
  lessons: Record<string, unknown>;
  lastVisitedLessonId: string | null;
}

export interface ProgressState {
  version: 2;
  lastVisitedAreaId: string | null;
  areas: Record<string, AreaRecord>;
  legacy: LegacyV1 | null;
}

export interface ProgressStore {
  readonly persistent: boolean;
  /** Deep copy — callers cannot mutate the store through it. */
  getState(): ProgressState;
  /** Stale-id-guarded: null when the stored area id is absent from the registry. */
  getLastVisitedAreaId(): string | null;
  /** Exercise record for (area, segment), or null (stale area excluded). */
  getExerciseProgress(areaId: string, segmentIndex: number): ExerciseRecord | null;
  recordOutcome(
    areaId: string,
    segmentIndex: number,
    questionIndex: number,
    outcome: Outcome,
  ): void;
  recordAttempt(areaId: string, segmentIndex: number, completed: boolean): void;
  setLastVisited(areaId: string): void;
  resetAll(): void;
  subscribe(listener: () => void): () => void;
  isNoticeDismissed(noticeId: string): boolean;
  dismissNotice(noticeId: string): void;
}

export interface CreateProgressStoreOptions {
  backend?: StorageBackend;
  persistent?: boolean;
  /** Known area ids (from the registry) — enables the stale-id guard on reads. */
  areaIds?: string[];
  now?: () => string;
}

function freshState(): ProgressState {
  return { version: SCHEMA_VERSION, lastVisitedAreaId: null, areas: {}, legacy: null };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// Save / restore — ONE serialize + ONE restore, explicit whitelist.
// ---------------------------------------------------------------------------

function cloneExercise(rec: ExerciseRecord): ExerciseRecord {
  return {
    questionOutcomes: { ...rec.questionOutcomes },
    attempts: rec.attempts,
    completedAt: rec.completedAt,
  };
}

function cloneAreas(areas: Record<string, AreaRecord>): Record<string, AreaRecord> {
  const out: Record<string, AreaRecord> = {};
  for (const [areaId, rec] of Object.entries(areas)) {
    const segments: Record<number, ExerciseRecord> = {};
    for (const [seg, ex] of Object.entries(rec.segments)) segments[Number(seg)] = cloneExercise(ex);
    out[areaId] = { segments };
  }
  return out;
}

export function serializeState(state: ProgressState): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    lastVisitedAreaId: state.lastVisitedAreaId,
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

function restoreExercise(raw: unknown): ExerciseRecord {
  const r = isObject(raw) ? raw : {};
  return {
    questionOutcomes: restoreOutcomes(r["questionOutcomes"]),
    attempts: typeof r["attempts"] === "number" ? (r["attempts"] as number) : 0,
    completedAt: typeof r["completedAt"] === "string" ? (r["completedAt"] as string) : null,
  };
}

export function restoreState(parsed: Record<string, unknown>): ProgressState {
  const areasIn = isObject(parsed["areas"]) ? (parsed["areas"] as Record<string, unknown>) : {};
  const areas: Record<string, AreaRecord> = {};
  for (const [areaId, recRaw] of Object.entries(areasIn)) {
    const segIn = isObject(recRaw) && isObject((recRaw as Record<string, unknown>)["segments"])
      ? ((recRaw as Record<string, unknown>)["segments"] as Record<string, unknown>)
      : {};
    const segments: Record<number, ExerciseRecord> = {};
    for (const [seg, exRaw] of Object.entries(segIn)) segments[Number(seg)] = restoreExercise(exRaw);
    areas[areaId] = { segments };
  }

  let legacy: LegacyV1 | null = null;
  if (isObject(parsed["legacy"])) {
    const l = parsed["legacy"] as Record<string, unknown>;
    legacy = {
      lessons: isObject(l["lessons"]) ? (l["lessons"] as Record<string, unknown>) : {},
      lastVisitedLessonId:
        typeof l["lastVisitedLessonId"] === "string" ? (l["lastVisitedLessonId"] as string) : null,
    };
  }

  return {
    version: SCHEMA_VERSION,
    lastVisitedAreaId:
      typeof parsed["lastVisitedAreaId"] === "string"
        ? (parsed["lastVisitedAreaId"] as string)
        : null,
    areas,
    legacy,
  };
}

/** Migrate v1 (per-lesson) data to v2. v1 lesson records are preserved verbatim
 * under `legacy` (no derivable area/segment mapping in this pure layer). */
export function migrateV1ToV2(v1: Record<string, unknown>): ProgressState {
  return {
    version: SCHEMA_VERSION,
    lastVisitedAreaId: null,
    areas: {},
    legacy: {
      lessons: isObject(v1["lessons"]) ? (v1["lessons"] as Record<string, unknown>) : {},
      lastVisitedLessonId:
        typeof v1["lastVisitedLessonId"] === "string" ? (v1["lastVisitedLessonId"] as string) : null,
    },
  };
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
  const hasRegistry = knownAreaIds.size > 0;
  const now = options.now ?? (() => new Date().toISOString());

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
      state = migrateV1ToV2(load.parsed);
      migrated = true; // persist the migrated v2 (leaving the v1 key intact)
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
      "[progress] migrated v1 progress to v2 — v1 lesson records preserved under `legacy` (the v1 key is left intact).",
    );
    persist(); // write the migrated v2 snapshot
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

  function ensureExercise(areaId: string, segmentIndex: number): ExerciseRecord {
    let area = state.areas[areaId];
    if (!area) {
      area = { segments: {} };
      state.areas[areaId] = area;
    }
    let seg = area.segments[segmentIndex];
    if (!seg) {
      seg = { questionOutcomes: {}, attempts: 0, completedAt: null };
      area.segments[segmentIndex] = seg;
    }
    return seg;
  }

  return {
    persistent,

    getState() {
      return {
        version: state.version,
        lastVisitedAreaId: state.lastVisitedAreaId,
        areas: cloneAreas(state.areas),
        legacy: state.legacy ? { ...state.legacy, lessons: { ...state.legacy.lessons } } : null,
      };
    },

    getLastVisitedAreaId() {
      const id = state.lastVisitedAreaId;
      if (id !== null && hasRegistry && !knownAreaIds.has(id)) return null;
      return id;
    },

    getExerciseProgress(areaId, segmentIndex) {
      if (hasRegistry && !knownAreaIds.has(areaId)) return null;
      const seg = state.areas[areaId]?.segments[segmentIndex];
      return seg ? cloneExercise(seg) : null;
    },

    recordOutcome(areaId, segmentIndex, questionIndex, outcome) {
      ensureExercise(areaId, segmentIndex).questionOutcomes[questionIndex] = outcome;
      persist();
      notify();
    },

    recordAttempt(areaId, segmentIndex, completed) {
      const seg = ensureExercise(areaId, segmentIndex);
      seg.attempts += 1;
      if (completed && seg.completedAt === null) seg.completedAt = now();
      persist();
      notify();
    },

    setLastVisited(areaId) {
      state.lastVisitedAreaId = areaId;
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
