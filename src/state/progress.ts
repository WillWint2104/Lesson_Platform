/**
 * @file progress.ts — Learner progress store, SCHEMA v4 (CLAUDE.md §a, §c 3 & 7).
 *
 * v4 keys progress by **areaId + stage index**, each stage with separate `core`
 * and `extra` maps. Each entry is an **AnswerRecord `{ answer, correct }`** — the
 * learner's typed answer and whether the algebraic-equivalence check passed
 * (design-language-v2 §8, replacing the v3 honour-system outcome). A stage is
 * complete when every CORE question has a recorded answer (ANY result — never
 * gated on correctness); extra never affects completion. completedAt is sticky:
 * review re-runs record fresh results + attempts but never clear it.
 *
 * Save/restore symmetry (lesson 3): ONE serialize + ONE restore, colocated, with
 * an explicit whitelist. The round-trip test fails if a field is dropped.
 *
 * Migration: older (v3/v2/v1) data is **preserved verbatim under `legacy`
 * (.v3 / .v2 / .v1), never destroyed**, and the old key is left intact; current
 * progress starts fresh. Bump SCHEMA_VERSION + add a migration on ANY breaking
 * shape change.
 */

import {
  CORRUPT_KEY,
  PROGRESS_KEY,
  SCHEMA_VERSION,
  detectBackend,
  loadRaw,
  type StorageBackend,
} from "./storage";

export type StageView = "stage" | "exercise";
export type QuestionPool = "core" | "extra";

/**
 * One answered question (design-language-v2 §8): the learner's typed answer and
 * whether the algebraic-equivalence check marked it correct. The result IS the
 * mark — there is no honour-system self-mark.
 */
export interface AnswerRecord {
  answer: string;
  correct: boolean;
}

/** Progress within one stage. */
export interface StageRecord {
  core: Record<number, AnswerRecord>;
  extra: Record<number, AnswerRecord>;
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
  v3?: unknown;
}

export interface ProgressState {
  version: 4;
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
  recordResult(
    areaId: string,
    stageIndex: number,
    pool: QuestionPool,
    questionIndex: number,
    result: AnswerRecord,
  ): void;
  recordAttempt(areaId: string, stageIndex: number, completed: boolean): void;
  setLastVisited(areaId: string, stageIndex: number, view: StageView): void;
  resetAll(): void;
  subscribe(listener: () => void): () => void;
  isNoticeDismissed(noticeId: string): boolean;
  dismissNotice(noticeId: string): void;
  /** The remembered selected course (content-architecture-v1 §4), or null. */
  getSelectedCourse(): string | null;
  setSelectedCourse(courseId: string): void;
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

function cloneResults(m: Record<number, AnswerRecord>): Record<number, AnswerRecord> {
  const out: Record<number, AnswerRecord> = {};
  for (const [k, v] of Object.entries(m)) out[Number(k)] = { answer: v.answer, correct: v.correct };
  return out;
}

function cloneStage(rec: StageRecord): StageRecord {
  return {
    core: cloneResults(rec.core),
    extra: cloneResults(rec.extra),
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

function restoreResults(raw: unknown): Record<number, AnswerRecord> {
  const out: Record<number, AnswerRecord> = {};
  if (isObject(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (isObject(v) && typeof v["answer"] === "string" && typeof v["correct"] === "boolean") {
        out[Number(k)] = { answer: v["answer"] as string, correct: v["correct"] as boolean };
      }
    }
  }
  return out;
}

function restoreStage(raw: unknown): StageRecord {
  const r = isObject(raw) ? raw : {};
  return {
    core: restoreResults(r["core"]),
    extra: restoreResults(r["extra"]),
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
    if (l["v3"] !== undefined) legacy.v3 = l["v3"];
  }

  return {
    version: SCHEMA_VERSION,
    lastVisited: restoreLastVisited(parsed["lastVisited"]),
    areas,
    legacy,
  };
}

/**
 * Migrate older (v3/v2/v1) data to v4. The leaf shape changed (an honour-system
 * outcome → an `{ answer, correct }` AnswerRecord) with no faithful answer to
 * recover, so older records are preserved VERBATIM under `legacy` and current
 * progress starts fresh:
 *   - from v3 → `legacy.v3` = the v3 blob (carrying forward its own v2/v1 chain),
 *   - from v2 → `legacy.v2` = the v2 blob (+ nested v1),
 *   - from v1 → `legacy.v1` = the v1 blob.
 */
export function migrateToV4(parsed: Record<string, unknown>, fromVersion: number): ProgressState {
  const legacy: LegacyBucket = {};
  if (fromVersion >= 3) {
    legacy.v3 = parsed;
    // A v3 blob carries its own `legacy` ({ v1, v2 }) — carry the chain forward.
    if (isObject(parsed["legacy"])) {
      const l = parsed["legacy"] as Record<string, unknown>;
      if (l["v1"] !== undefined) legacy.v1 = l["v1"];
      if (l["v2"] !== undefined) legacy.v2 = l["v2"];
    }
  } else if (fromVersion >= 2) {
    legacy.v2 = parsed;
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
  // Remembered course selection (content-architecture-v1 §4) — UI state, kept in
  // its own key (lp:selected-course), NOT inside the versioned progress key.
  let selectedCourse: string | null = null;

  const load = loadRaw(backend);
  let persistDisabled = false;
  let state: ProgressState;
  let migrated = false;
  switch (load.status) {
    case "ok":
      state = restoreState(load.parsed);
      break;
    case "migrate":
      state = migrateToV4(load.parsed, load.fromVersion);
      migrated = true; // persist the migrated v4 (leaving the old key intact)
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
      "[progress] migrated older progress to v4 — old records preserved verbatim under `legacy` (the old key is left intact); current progress starts fresh.",
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

    recordResult(areaId, stageIndex, pool, questionIndex, result) {
      if (!isKnownAreaId(areaId)) return; // never persist ghost area records
      ensureStage(areaId, stageIndex)[pool][questionIndex] = {
        answer: result.answer,
        correct: result.correct,
      };
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

    getSelectedCourse() {
      if (selectedCourse !== null) return selectedCourse;
      try {
        const v = backend.getItem("lp:selected-course");
        return typeof v === "string" && v.length > 0 ? v : null;
      } catch {
        return null;
      }
    },

    setSelectedCourse(courseId) {
      selectedCourse = courseId;
      try {
        backend.setItem("lp:selected-course", courseId);
      } catch {
        /* in-memory value still remembers it for the session */
      }
      notify();
    },
  };
}
