import { describe, it, expect, vi, afterEach } from "vitest";
import {
  serializeState,
  restoreState,
  createProgressStore,
  type ProgressState,
  type LessonIndexEntry,
} from "@/state/progress";
import { createMemoryBackend, PROGRESS_KEY, CORRUPT_KEY } from "@/state/storage";

afterEach(() => vi.restoreAllMocks());

const fullState: ProgressState = {
  version: 1,
  lastVisitedLessonId: "lesson-a",
  lessons: {
    "lesson-a": {
      questionOutcomes: { 0: "correct", 1: "incorrect" },
      attempts: 2,
      completedAt: "2026-01-01T00:00:00.000Z",
    },
    "lesson-b": { questionOutcomes: {}, attempts: 0, completedAt: null },
  },
};

// ---------------------------------------------------------------------------
// Save/restore symmetry — the centrepiece whitelist round-trip
// ---------------------------------------------------------------------------

describe("save/restore symmetry", () => {
  it("preserves the whole state through serialize -> restore", () => {
    const round = restoreState(JSON.parse(serializeState(fullState)));
    expect(round).toEqual(fullState);
  });

  it("every field of a fully-populated state survives the round-trip (whitelist guard)", () => {
    const round = restoreState(JSON.parse(serializeState(fullState)));

    // Top-level fields all present.
    for (const key of Object.keys(fullState)) {
      expect(round).toHaveProperty(key);
    }
    // Per-lesson record fields all present AND no extras dropped/added — so
    // extending the schema without updating restoreState fails this test.
    const recordKeys = Object.keys(fullState.lessons["lesson-a"]!).sort();
    expect(Object.keys(round.lessons["lesson-a"]!).sort()).toEqual(recordKeys);
  });
});

// ---------------------------------------------------------------------------
// Hierarchy-scoped query isolation (content-isolation rule)
// ---------------------------------------------------------------------------

describe("hierarchy-scoped queries never co-mingle topics", () => {
  const lessons: LessonIndexEntry[] = [
    { id: "a1", subject: "math", topic: "algebra", topicArea: "brackets" },
    { id: "a2", subject: "math", topic: "algebra", topicArea: "factoring" },
    { id: "g1", subject: "math", topic: "geometry", topicArea: "triangles" },
  ];

  it("scopes results to a topic and excludes other topics' records", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), lessons });
    store.recordOutcome("a1", 0, "correct");
    store.recordOutcome("a1", 1, "correct");
    store.recordOutcome("g1", 0, "incorrect");

    const algebra = store.getTopicProgress("math", "algebra");
    expect(algebra.lessonIds).toEqual(["a1"]);
    expect(algebra.correctCount).toBe(2);
    expect(algebra.records["g1"]).toBeUndefined();

    const geometry = store.getTopicProgress("math", "geometry");
    expect(geometry.lessonIds).toEqual(["g1"]);
    expect(geometry.incorrectCount).toBe(1);
    expect(geometry.records["a1"]).toBeUndefined();
  });

  it("scopes further by topic area", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), lessons });
    store.recordOutcome("a1", 0, "correct");
    store.recordOutcome("a2", 0, "correct");
    const brackets = store.getTopicAreaProgress("math", "algebra", "brackets");
    expect(brackets.lessonIds).toEqual(["a1"]);
  });
});

// ---------------------------------------------------------------------------
// Stale-ID guard: excluded from queries, retained in storage, warned once
// ---------------------------------------------------------------------------

describe("stale-id guard", () => {
  it("excludes unknown ids from queries but retains them in storage", () => {
    const backend = createMemoryBackend();
    backend.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        version: 1,
        lastVisitedLessonId: null,
        lessons: {
          ghost: { questionOutcomes: { 0: "correct" }, attempts: 1, completedAt: null },
          a1: { questionOutcomes: {}, attempts: 0, completedAt: null },
        },
      }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({
      backend,
      persistent: true,
      lessons: [{ id: "a1", subject: "math", topic: "algebra", topicArea: "x" }],
    });

    // Excluded from queries.
    expect(store.getLessonProgress("ghost")).toBeNull();
    // Retained in state...
    expect(store.getState().lessons["ghost"]).toBeDefined();
    // ...and still written back on the next save (not destroyed).
    store.recordOutcome("a1", 0, "correct");
    expect(JSON.parse(backend.getItem(PROGRESS_KEY)!).lessons.ghost).toBeDefined();
    // Warned once, listing the stale id.
    expect(warn.mock.calls.some((c) => String(c[0]).includes("ghost"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Robustness
// ---------------------------------------------------------------------------

describe("robustness", () => {
  it("backs up and recovers from corrupt stored JSON", () => {
    const backend = createMemoryBackend();
    backend.setItem(PROGRESS_KEY, "{not valid json");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });

    expect(backend.getItem(CORRUPT_KEY)).toBe("{not valid json");
    expect(store.getState().lessons).toEqual({});
    expect(warn).toHaveBeenCalled();
  });

  it("falls back to in-memory when localStorage is unavailable (node)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore(); // node has no localStorage
    expect(store.persistent).toBe(false);
    store.recordOutcome("x", 0, "correct");
    expect(store.getState().lessons["x"]).toBeDefined();
    expect(warn).toHaveBeenCalled();
  });

  it("leaves newer-version stored data untouched (in-memory session)", () => {
    const backend = createMemoryBackend();
    const futureRaw = JSON.stringify({ version: 99, lastVisitedLessonId: "z", lessons: {} });
    backend.setItem(PROGRESS_KEY, futureRaw);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });

    store.recordOutcome("x", 0, "correct"); // would persist if allowed
    expect(backend.getItem(PROGRESS_KEY)).toBe(futureRaw); // untouched
    expect(warn).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Encapsulation + lastVisited stale-id guard + persistent accuracy
// ---------------------------------------------------------------------------

describe("encapsulation and guards", () => {
  it("getState returns a copy that cannot mutate the store", () => {
    const store = createProgressStore({
      backend: createMemoryBackend(),
      lessons: [{ id: "a", subject: "s", topic: "t", topicArea: "x" }],
    });
    store.recordOutcome("a", 0, "correct");

    const snap = store.getState();
    snap.lessons["a"]!.attempts = 999;
    snap.lessons["hacked"] = { questionOutcomes: {}, attempts: 1, completedAt: null };

    expect(store.getState().lessons["a"]!.attempts).toBe(0);
    expect(store.getState().lessons["hacked"]).toBeUndefined();
  });

  it("getLastVisitedLessonId excludes ids absent from the registry", () => {
    const backend = createMemoryBackend();
    backend.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 1, lastVisitedLessonId: "ghost", lessons: {} }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({
      backend,
      persistent: true,
      lessons: [{ id: "a", subject: "s", topic: "t", topicArea: "x" }],
    });

    expect(store.getLastVisitedLessonId()).toBeNull(); // stale → excluded
    store.setLastVisited("a");
    expect(store.getLastVisitedLessonId()).toBe("a"); // valid → returned
  });

  it("persists a one-time notice dismissal through the storage layer", () => {
    const backend = createMemoryBackend();
    const store = createProgressStore({ backend, persistent: true });
    expect(store.isNoticeDismissed("local-progress")).toBe(false);

    store.dismissNotice("local-progress");
    expect(store.isNoticeDismissed("local-progress")).toBe(true);

    // A fresh store sharing the backend still sees the dismissal (persisted).
    const reopened = createProgressStore({ backend, persistent: true });
    expect(reopened.isNoticeDismissed("local-progress")).toBe(true);
    // ...and it did NOT touch the versioned progress key.
    expect(backend.getItem(PROGRESS_KEY)).toBeNull();
  });

  it("keeps a notice dismissed for the session even if the persistent write fails", () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {},
    };
    const store = createProgressStore({ backend: failing, persistent: true });
    store.dismissNotice("local-progress");
    expect(store.isNoticeDismissed("local-progress")).toBe(true);
  });

  it("persistent is false when stored data is a newer version", () => {
    const backend = createMemoryBackend();
    backend.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 99, lastVisitedLessonId: null, lessons: {} }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });
    expect(store.persistent).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// completedAt semantics
// ---------------------------------------------------------------------------

describe("recordAttempt / completedAt", () => {
  it("sets completedAt only on an all-correct attempt and never erases it", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), now: () => "FIXED" });

    store.recordAttempt("a", false);
    expect(store.getState().lessons["a"]!.attempts).toBe(1);
    expect(store.getState().lessons["a"]!.completedAt).toBeNull();

    store.recordAttempt("a", true);
    expect(store.getState().lessons["a"]!.attempts).toBe(2);
    expect(store.getState().lessons["a"]!.completedAt).toBe("FIXED");

    store.recordAttempt("a", false); // later imperfect run must not erase it
    expect(store.getState().lessons["a"]!.completedAt).toBe("FIXED");
  });

  it("review re-run records fresh outcomes + attempts but NEVER clears completedAt", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), now: () => "DAY1" });
    store.recordOutcome("L", 0, "correct");
    store.recordAttempt("L", true); // completes the lesson
    expect(store.getState().lessons["L"]!.completedAt).toBe("DAY1");

    // Review re-run: a fresh (worse) outcome + another attempt.
    store.recordOutcome("L", 0, "incorrect");
    store.recordAttempt("L", false);
    const rec = store.getState().lessons["L"]!;
    expect(rec.completedAt).toBe("DAY1"); // preserved
    expect(rec.questionOutcomes[0]).toBe("incorrect"); // fresh outcome recorded
    expect(rec.attempts).toBe(2); // incremented
  });
});

// ---------------------------------------------------------------------------
// Per-skill / per-difficulty scoping — bounded by topic, never cross-topic
// ---------------------------------------------------------------------------

describe("skill/difficulty scoping", () => {
  const lessons: LessonIndexEntry[] = [
    {
      id: "a1",
      subject: "math",
      topic: "algebra",
      topicArea: "brackets",
      questions: [
        { skill: "expand", difficulty: "easy" },
        { skill: "factor", difficulty: "hard" },
      ],
    },
    {
      id: "g1",
      subject: "math",
      topic: "geometry",
      topicArea: "triangles",
      questions: [{ skill: "expand", difficulty: "easy" }],
    },
  ];

  it("aggregates a skill within a topic and never co-mingles a same-named skill from another topic", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), lessons });
    store.recordOutcome("a1", 0, "correct"); // algebra · expand
    store.recordOutcome("g1", 0, "incorrect"); // geometry · expand (same skill name!)

    expect(store.getSkillProgress("math", "algebra", "expand")).toEqual({
      correct: 1,
      incorrect: 0,
      answered: 1,
    });
    expect(store.getSkillProgress("math", "geometry", "expand")).toEqual({
      correct: 0,
      incorrect: 1,
      answered: 1,
    });
  });

  it("aggregates by difficulty within a topic", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), lessons });
    store.recordOutcome("a1", 0, "correct"); // easy
    store.recordOutcome("a1", 1, "incorrect"); // hard
    expect(store.getDifficultyProgress("math", "algebra", "easy")).toEqual({
      correct: 1,
      incorrect: 0,
      answered: 1,
    });
    expect(store.getDifficultyProgress("math", "algebra", "hard")).toEqual({
      correct: 0,
      incorrect: 1,
      answered: 1,
    });
  });
});
