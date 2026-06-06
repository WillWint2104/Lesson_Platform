import { describe, it, expect, vi, afterEach } from "vitest";
import {
  serializeState,
  restoreState,
  migrateV1ToV2,
  createProgressStore,
  type ProgressState,
} from "@/state/progress";
import {
  createMemoryBackend,
  PROGRESS_KEY,
  PROGRESS_KEY_V1,
  CORRUPT_KEY,
} from "@/state/storage";

afterEach(() => vi.restoreAllMocks());

const fullState: ProgressState = {
  version: 2,
  lastVisitedAreaId: "math/algebra/expanding-brackets",
  areas: {
    "math/algebra/expanding-brackets": {
      segments: {
        1: {
          questionOutcomes: { 0: "correct", 1: "incorrect" },
          attempts: 2,
          completedAt: "2026-01-01T00:00:00.000Z",
        },
        3: { questionOutcomes: {}, attempts: 0, completedAt: null },
      },
    },
  },
  legacy: {
    lessons: { "single-brackets-1": { questionOutcomes: { 0: "correct" }, attempts: 1, completedAt: null } },
    lastVisitedLessonId: "single-brackets-1",
  },
};

// ---------------------------------------------------------------------------
// Save/restore symmetry — the whitelist round-trip (centrepiece)
// ---------------------------------------------------------------------------

describe("save/restore symmetry (v2)", () => {
  it("preserves the whole v2 state through serialize -> restore", () => {
    expect(restoreState(JSON.parse(serializeState(fullState)))).toEqual(fullState);
  });

  it("every field of a fully-populated state survives (whitelist guard)", () => {
    const round = restoreState(JSON.parse(serializeState(fullState)));
    for (const key of Object.keys(fullState)) expect(round).toHaveProperty(key);
    const exKeys = Object.keys(fullState.areas["math/algebra/expanding-brackets"]!.segments[1]!).sort();
    expect(Object.keys(round.areas["math/algebra/expanding-brackets"]!.segments[1]!).sort()).toEqual(
      exKeys,
    );
    expect(Object.keys(round.legacy!).sort()).toEqual(["lastVisitedLessonId", "lessons"]);
  });
});

// ---------------------------------------------------------------------------
// v1 → v2 migration
// ---------------------------------------------------------------------------

describe("v1 → v2 migration", () => {
  const v1 = {
    version: 1,
    lastVisitedLessonId: "single-brackets-1",
    lessons: { "single-brackets-1": { questionOutcomes: { 0: "correct" }, attempts: 1, completedAt: "D" } },
  };

  it("migrateV1ToV2 preserves v1 lessons verbatim under legacy (never destroyed)", () => {
    const v2 = migrateV1ToV2(v1);
    expect(v2.version).toBe(2);
    expect(v2.areas).toEqual({});
    expect(v2.legacy?.lessons["single-brackets-1"]).toBeDefined();
    expect(v2.legacy?.lastVisitedLessonId).toBe("single-brackets-1");
  });

  it("loads v1 data as a migrated v2 store, writing v2 and leaving v1 intact", () => {
    const backend = createMemoryBackend();
    backend.setItem(PROGRESS_KEY_V1, JSON.stringify(v1));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const store = createProgressStore({ backend, persistent: true });
    const s = store.getState();
    expect(s.version).toBe(2);
    expect(s.legacy?.lessons["single-brackets-1"]).toBeDefined();
    expect(s.areas).toEqual({});
    // v2 was written; v1 is left untouched.
    expect(backend.getItem(PROGRESS_KEY)).not.toBeNull();
    expect(backend.getItem(PROGRESS_KEY_V1)).toBe(JSON.stringify(v1));
  });

  it("a fresh v2 store round-trips through the backend", () => {
    const backend = createMemoryBackend();
    const store = createProgressStore({ backend, persistent: true, now: () => "T" });
    store.recordOutcome("A", 1, 0, "correct");
    store.setLastVisited("A");
    const reopened = createProgressStore({ backend, persistent: true });
    expect(reopened.getExerciseProgress("A", 1)?.questionOutcomes[0]).toBe("correct");
    expect(reopened.getLastVisitedAreaId()).toBe("A");
  });
});

// ---------------------------------------------------------------------------
// Area + segment recording
// ---------------------------------------------------------------------------

describe("area/segment recording", () => {
  it("records per-segment outcomes + attempts; completedAt is sticky", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), now: () => "DAY1" });
    store.recordOutcome("A", 1, 0, "correct");
    store.recordAttempt("A", 1, true);
    expect(store.getExerciseProgress("A", 1)?.completedAt).toBe("DAY1");
    expect(store.getExerciseProgress("A", 1)?.attempts).toBe(1);

    // Review re-run: fresh (worse) outcome + another attempt, never clears completedAt.
    store.recordOutcome("A", 1, 0, "incorrect");
    store.recordAttempt("A", 1, false);
    const seg = store.getExerciseProgress("A", 1);
    expect(seg?.completedAt).toBe("DAY1");
    expect(seg?.questionOutcomes[0]).toBe("incorrect");
    expect(seg?.attempts).toBe(2);
  });

  it("keeps segments independent within an area", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), now: () => "T" });
    store.recordAttempt("A", 1, true);
    store.recordAttempt("A", 3, false);
    expect(store.getExerciseProgress("A", 1)?.completedAt).toBe("T");
    expect(store.getExerciseProgress("A", 3)?.completedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Stale-id guard + encapsulation
// ---------------------------------------------------------------------------

describe("stale-id guard + encapsulation", () => {
  it("excludes unknown area ids from reads but retains them in storage", () => {
    const backend = createMemoryBackend();
    backend.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        version: 2,
        lastVisitedAreaId: "ghost",
        areas: {
          ghost: { segments: { 0: { questionOutcomes: {}, attempts: 1, completedAt: null } } },
          real: { segments: {} },
        },
        legacy: null,
      }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true, areaIds: ["real"] });

    expect(store.getExerciseProgress("ghost", 0)).toBeNull(); // excluded
    expect(store.getLastVisitedAreaId()).toBeNull(); // stale → excluded
    expect(store.getState().areas["ghost"]).toBeDefined(); // retained
  });

  it("getState returns a copy that cannot mutate the store", () => {
    const store = createProgressStore({ backend: createMemoryBackend() });
    store.recordOutcome("A", 0, 0, "correct");
    const snap = store.getState();
    snap.areas["A"]!.segments[0]!.attempts = 999;
    snap.areas["hacked"] = { segments: {} };
    expect(store.getState().areas["A"]!.segments[0]!.attempts).toBe(0);
    expect(store.getState().areas["hacked"]).toBeUndefined();
  });

  it("resetAll clears area progress but preserves legacy", () => {
    const backend = createMemoryBackend();
    backend.setItem(PROGRESS_KEY_V1, JSON.stringify({ version: 1, lessons: { L: {} }, lastVisitedLessonId: null }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });
    store.recordOutcome("A", 0, 0, "correct");
    store.resetAll();
    expect(store.getState().areas).toEqual({});
    expect(store.getState().legacy?.lessons["L"]).toBeDefined(); // legacy never destroyed
  });
});

// ---------------------------------------------------------------------------
// Robustness
// ---------------------------------------------------------------------------

describe("robustness", () => {
  it("backs up and recovers from corrupt stored JSON", () => {
    const backend = createMemoryBackend();
    backend.setItem(PROGRESS_KEY, "{not valid json");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });
    expect(backend.getItem(CORRUPT_KEY)).toBe("{not valid json");
    expect(store.getState().areas).toEqual({});
  });

  it("falls back to in-memory when localStorage is unavailable (node)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore();
    expect(store.persistent).toBe(false);
    store.recordOutcome("A", 0, 0, "correct");
    expect(store.getExerciseProgress("A", 0)?.questionOutcomes[0]).toBe("correct");
  });

  it("leaves newer-version stored data untouched and reports persistent=false", () => {
    const backend = createMemoryBackend();
    const future = JSON.stringify({ version: 99, lastVisitedAreaId: null, areas: {}, legacy: null });
    backend.setItem(PROGRESS_KEY, future);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });
    store.recordOutcome("A", 0, 0, "correct"); // would persist if allowed
    expect(backend.getItem(PROGRESS_KEY)).toBe(future);
    expect(store.persistent).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// One-time notice dismissal (soft-launch)
// ---------------------------------------------------------------------------

describe("notice dismissal", () => {
  it("persists through the storage layer without touching the progress key", () => {
    const backend = createMemoryBackend();
    const store = createProgressStore({ backend, persistent: true });
    expect(store.isNoticeDismissed("local-progress")).toBe(false);
    store.dismissNotice("local-progress");
    expect(store.isNoticeDismissed("local-progress")).toBe(true);
    expect(createProgressStore({ backend, persistent: true }).isNoticeDismissed("local-progress")).toBe(
      true,
    );
    expect(backend.getItem(PROGRESS_KEY)).toBeNull();
  });

  it("stays dismissed for the session even if the persistent write fails", () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };
    const store = createProgressStore({ backend: failing, persistent: true });
    store.dismissNotice("local-progress");
    expect(store.isNoticeDismissed("local-progress")).toBe(true);
    expect(createProgressStore({ backend: failing, persistent: true }).isNoticeDismissed("local-progress")).toBe(
      false,
    );
  });
});
