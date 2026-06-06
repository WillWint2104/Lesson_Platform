/**
 * @file progress.ts — Learner progress store (CLAUDE.md §a, §c rules 3 & 7).
 *
 * localStorage-backed, single versioned key `lp:progress:v1`. Records are keyed
 * by the path-derived lesson id, so they are naturally namespaced by lesson
 * identity; hierarchy-scoped query helpers (getTopicProgress / getTopicArea-
 * Progress) ensure NO consumer ever aggregates across topics by accident
 * (content-isolation rule).
 *
 * Save/restore symmetry (lesson 3): ONE serialize + ONE restore, colocated,
 * each with an explicit field whitelist. The round-trip test derives the field
 * list from a fully-populated state and fails if any field is dropped — so the
 * schema cannot be extended without updating `restoreState`.
 *
 * IMPORTANT: bump SCHEMA_VERSION (and add a migration) on ANY breaking change to
 * the stored shape.
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

export interface LessonRecord {
  questionOutcomes: Record<number, Outcome>;
  attempts: number;
  completedAt: string | null;
}

export interface ProgressState {
  version: 1;
  lastVisitedLessonId: string | null;
  lessons: Record<string, LessonRecord>;
}

/** Per-question metadata (by position) used for skill/difficulty scoping. */
export interface QuestionMeta {
  skill?: string;
  difficulty?: string;
}

/** Minimal hierarchy index entry (derived from the loaded registry). */
export interface LessonIndexEntry {
  id: string;
  subject: string;
  topic: string;
  topicArea: string;
  /** Per-question skill/difficulty, indexed by question position. */
  questions?: QuestionMeta[];
}

/** Outcome counts for a skill/difficulty within a topic boundary. */
export interface ScopedQuestionProgress {
  correct: number;
  incorrect: number;
  answered: number;
}

/** Result of a hierarchy-scoped query. Only in-scope, registry-known lessons. */
export interface ScopedProgress {
  lessonIds: string[];
  records: Record<string, LessonRecord>;
  completedCount: number;
  correctCount: number;
  incorrectCount: number;
  attemptCount: number;
}

export interface ProgressStore {
  readonly persistent: boolean;
  /** Deep copy of the current state — callers cannot mutate the store through it. */
  getState(): ProgressState;
  /** Stale-id-guarded: null when the stored id is absent from the registry. */
  getLastVisitedLessonId(): string | null;
  getLessonProgress(lessonId: string): LessonRecord | null;
  getTopicProgress(subject: string, topic: string): ScopedProgress;
  getTopicAreaProgress(subject: string, topic: string, topicArea: string): ScopedProgress;
  /** Outcomes for a skill, scoped to a topic (never cross-topic). */
  getSkillProgress(subject: string, topic: string, skill: string): ScopedQuestionProgress;
  /** Outcomes for a difficulty, scoped to a topic (never cross-topic). */
  getDifficultyProgress(
    subject: string,
    topic: string,
    difficulty: string,
  ): ScopedQuestionProgress;
  recordOutcome(lessonId: string, questionIndex: number, outcome: Outcome): void;
  recordAttempt(lessonId: string, completed: boolean): void;
  setLastVisited(lessonId: string): void;
  resetAll(): void;
  subscribe(listener: () => void): () => void;
  /** One-time UI notice dismissal, persisted through the SAME storage layer as
   * progress (not a parallel localStorage call). Kept out of the versioned
   * progress key — it is UI state, not learner progress. */
  isNoticeDismissed(noticeId: string): boolean;
  dismissNotice(noticeId: string): void;
}

export interface CreateProgressStoreOptions {
  /** Inject a backend (tests); when provided, `persistent` defaults to true. */
  backend?: StorageBackend;
  persistent?: boolean;
  /** Hierarchy index from the registry; enables stale-id guards + scoped queries. */
  lessons?: LessonIndexEntry[];
  /** Injectable clock for completedAt (default: real ISO time). */
  now?: () => string;
}

function freshState(): ProgressState {
  return { version: SCHEMA_VERSION, lastVisitedLessonId: null, lessons: {} };
}

// ---------------------------------------------------------------------------
// Save / restore symmetry — ONE serialize + ONE restore, explicit whitelist.
// ---------------------------------------------------------------------------

export function serializeState(state: ProgressState): string {
  const lessons: Record<string, LessonRecord> = {};
  for (const [id, rec] of Object.entries(state.lessons)) {
    lessons[id] = {
      questionOutcomes: { ...rec.questionOutcomes },
      attempts: rec.attempts,
      completedAt: rec.completedAt,
    };
  }
  return JSON.stringify({
    version: SCHEMA_VERSION,
    lastVisitedLessonId: state.lastVisitedLessonId,
    lessons,
  });
}

export function restoreState(parsed: Record<string, unknown>): ProgressState {
  const lessonsIn =
    parsed["lessons"] && typeof parsed["lessons"] === "object"
      ? (parsed["lessons"] as Record<string, unknown>)
      : {};

  const lessons: Record<string, LessonRecord> = {};
  for (const [id, recRaw] of Object.entries(lessonsIn)) {
    if (!recRaw || typeof recRaw !== "object") continue;
    const rec = recRaw as Record<string, unknown>;
    lessons[id] = {
      questionOutcomes: restoreOutcomes(rec["questionOutcomes"]),
      attempts: typeof rec["attempts"] === "number" ? rec["attempts"] : 0,
      completedAt: typeof rec["completedAt"] === "string" ? rec["completedAt"] : null,
    };
  }

  return {
    version: SCHEMA_VERSION,
    lastVisitedLessonId:
      typeof parsed["lastVisitedLessonId"] === "string"
        ? (parsed["lastVisitedLessonId"] as string)
        : null,
    lessons,
  };
}

function restoreOutcomes(raw: unknown): Record<number, Outcome> {
  const out: Record<number, Outcome> = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      if (value === "correct" || value === "incorrect") {
        out[Number(key)] = value;
      }
    }
  }
  return out;
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

  const index = options.lessons ?? [];
  const knownIds = new Set(index.map((l) => l.id));
  const hasRegistry = knownIds.size > 0;
  const now = options.now ?? (() => new Date().toISOString());

  const listeners = new Set<() => void>();
  // Session-level fallback so a dismissal still hides even if the write fails.
  const dismissedNotices = new Set<string>();

  // ---- Load (robust) ----
  const load = loadRaw(backend);
  let persistDisabled = false;
  let state: ProgressState;
  switch (load.status) {
    case "ok":
      state = restoreState(load.parsed);
      break;
    case "future":
      persistDisabled = true; // never overwrite newer data
      state = freshState();
      break;
    case "corrupt":
    case "empty":
    default:
      state = freshState();
      break;
  }

  // Persistence is OFF if the backend can't persist OR a future-schema blob
  // forced an in-memory session.
  const persistent = backendPersistent && !persistDisabled;

  // ---- One-time warnings (per store instance ~ per session) ----
  if (!backendPersistent) {
    console.warn(
      "[progress] localStorage is unavailable; progress will be kept in memory for this session only.",
    );
  }
  if (load.status === "corrupt") {
    console.warn(
      `[progress] stored progress was unparseable; the raw value was backed up to "${CORRUPT_KEY}" and a fresh store was started.`,
    );
  }
  if (load.status === "future") {
    console.warn(
      "[progress] stored progress is from a newer version; leaving it untouched and using an in-memory session.",
    );
  }
  if (hasRegistry) {
    const stale = Object.keys(state.lessons).filter((id) => !knownIds.has(id));
    if (stale.length > 0) {
      console.warn(
        `[progress] ${stale.length} stored lesson id(s) are not in the current registry and are excluded from queries (retained in storage): ${stale.join(", ")}`,
      );
    }
  }

  function persist(): void {
    if (persistDisabled) return;
    try {
      backend.setItem(PROGRESS_KEY, serializeState(state));
    } catch {
      // Quota/serialisation failure must not crash the app.
    }
  }

  function notify(): void {
    for (const listener of listeners) listener();
  }

  function ensure(lessonId: string): LessonRecord {
    let rec = state.lessons[lessonId];
    if (!rec) {
      rec = { questionOutcomes: {}, attempts: 0, completedAt: null };
      state.lessons[lessonId] = rec;
    }
    return rec;
  }

  // Reads hand out copies so callers can never mutate the store's state
  // outside the single recordOutcome/recordAttempt/... mutation path.
  function cloneRecord(rec: LessonRecord): LessonRecord {
    return {
      questionOutcomes: { ...rec.questionOutcomes },
      attempts: rec.attempts,
      completedAt: rec.completedAt,
    };
  }

  function scope(filter: (l: LessonIndexEntry) => boolean): ScopedProgress {
    const records: Record<string, LessonRecord> = {};
    const lessonIds: string[] = [];
    let completedCount = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let attemptCount = 0;

    // Iterate the REGISTRY (not storage), so stale/unknown ids are naturally
    // excluded and topics never co-mingle.
    for (const lesson of index) {
      if (!filter(lesson)) continue;
      const rec = state.lessons[lesson.id];
      if (!rec) continue;
      records[lesson.id] = cloneRecord(rec);
      lessonIds.push(lesson.id);
      if (rec.completedAt) completedCount += 1;
      attemptCount += rec.attempts;
      for (const outcome of Object.values(rec.questionOutcomes)) {
        if (outcome === "correct") correctCount += 1;
        else incorrectCount += 1;
      }
    }

    return { lessonIds, records, completedCount, correctCount, incorrectCount, attemptCount };
  }

  // Per-question scoping (skill/difficulty) — always bounded by the topic filter
  // so it can never aggregate across topics.
  function scopeQuestions(
    filter: (l: LessonIndexEntry) => boolean,
    match: (m: QuestionMeta) => boolean,
  ): ScopedQuestionProgress {
    let correct = 0;
    let incorrect = 0;
    for (const lesson of index) {
      if (!filter(lesson)) continue;
      const rec = state.lessons[lesson.id];
      if (!rec) continue;
      const metas = lesson.questions ?? [];
      metas.forEach((meta, i) => {
        if (!match(meta)) return;
        const outcome = rec.questionOutcomes[i];
        if (outcome === "correct") correct += 1;
        else if (outcome === "incorrect") incorrect += 1;
      });
    }
    return { correct, incorrect, answered: correct + incorrect };
  }

  return {
    persistent,

    getState() {
      const lessons: Record<string, LessonRecord> = {};
      for (const [id, rec] of Object.entries(state.lessons)) lessons[id] = cloneRecord(rec);
      return { version: state.version, lastVisitedLessonId: state.lastVisitedLessonId, lessons };
    },

    getLastVisitedLessonId() {
      // Stale-id guard (lesson 7): a stored id absent from the registry is not
      // acted on, though it is retained in storage.
      const id = state.lastVisitedLessonId;
      if (id !== null && hasRegistry && !knownIds.has(id)) return null;
      return id;
    },

    getLessonProgress(lessonId) {
      // Stale-id guard: validate against the registry when one is loaded.
      if (hasRegistry && !knownIds.has(lessonId)) return null;
      const rec = state.lessons[lessonId];
      return rec ? cloneRecord(rec) : null;
    },

    getTopicProgress(subject, topic) {
      return scope((l) => l.subject === subject && l.topic === topic);
    },

    getTopicAreaProgress(subject, topic, topicArea) {
      return scope(
        (l) => l.subject === subject && l.topic === topic && l.topicArea === topicArea,
      );
    },

    getSkillProgress(subject, topic, skill) {
      return scopeQuestions((l) => l.subject === subject && l.topic === topic, (m) => m.skill === skill);
    },

    getDifficultyProgress(subject, topic, difficulty) {
      return scopeQuestions(
        (l) => l.subject === subject && l.topic === topic,
        (m) => m.difficulty === difficulty,
      );
    },

    recordOutcome(lessonId, questionIndex, outcome) {
      ensure(lessonId).questionOutcomes[questionIndex] = outcome;
      persist();
      notify();
    },

    recordAttempt(lessonId, completed) {
      const rec = ensure(lessonId);
      rec.attempts += 1;
      // Set completedAt on the first all-correct attempt; never erase it.
      if (completed && rec.completedAt === null) rec.completedAt = now();
      persist();
      notify();
    },

    setLastVisited(lessonId) {
      state.lastVisitedLessonId = lessonId;
      persist();
      notify();
    },

    resetAll() {
      state = freshState();
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
      // Hold it in memory first so the dismissal sticks for this session even if
      // the persistent write below fails.
      dismissedNotices.add(noticeId);
      try {
        backend.setItem(`lp:notice:${noticeId}`, "1");
      } catch {
        // Best effort — the in-memory flag still hides it for the session.
      }
      notify();
    },
  };
}
