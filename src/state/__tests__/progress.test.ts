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
});
