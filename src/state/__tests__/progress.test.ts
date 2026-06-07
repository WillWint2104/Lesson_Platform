import { describe, it, expect, vi, afterEach } from "vitest";
import {
  serializeState,
  restoreState,
  migrateToV3,
  createProgressStore,
  type ProgressState,
} from "@/state/progress";
import {
  createMemoryBackend,
  PROGRESS_KEY,
  PROGRESS_KEY_V2,
  PROGRESS_KEY_V1,
  CORRUPT_KEY,
} from "@/state/storage";

afterEach(() => vi.restoreAllMocks());

const AREA = "math/algebra/expanding-brackets";

const fullState: ProgressState = {
  version: 3,
  lastVisited: { areaId: AREA, stageIndex: 1, view: "exercise" },
  areas: {
    [AREA]: {
      stages: {
        0: {
          core: { 0: "correct", 1: "incorrect" },
          extra: { 0: "correct" },
          attempts: 2,
          completedAt: "2026-01-01T00:00:00.000Z",
        },
        2: { core: {}, extra: {}, attempts: 0, completedAt: null },
      },
    },
  },
  legacy: {
    v2: { version: 2, lastVisitedAreaId: null, areas: {}, legacy: null },
    v1: { lessons: { L: {} }, lastVisitedLessonId: null },
  },
};

// ---------------------------------------------------------------------------
// Save/restore symmetry — the whitelist round-trip (centrepiece)
// ---------------------------------------------------------------------------

describe("save/restore symmetry (v3)", () => {
  it("preserves the whole v3 state through serialize -> restore", () => {
    expect(restoreState(JSON.parse(serializeState(fullState)))).toEqual(fullState);
  });

  it("every field of a fully-populated state survives (whitelist guard)", () => {
    const round = restoreState(JSON.parse(serializeState(fullState)));
    for (const key of Object.keys(fullState)) expect(round).toHaveProperty(key);
    const stageKeys = Object.keys(fullState.areas[AREA]!.stages[0]!).sort();
    expect(Object.keys(round.areas[AREA]!.stages[0]!).sort()).toEqual(stageKeys);
    expect(Object.keys(round.legacy!).sort()).toEqual(["v1", "v2"]);
  });
});

// ---------------------------------------------------------------------------
// v2/v1 → v3 migration
// ---------------------------------------------------------------------------

describe("migration to v3", () => {
  const v2 = {
    version: 2,
    lastVisitedAreaId: "x",
    areas: { x: { segments: {} } },
    legacy: { lessons: { L: {} }, lastVisitedLessonId: null },
  };

  it("migrateToV3 preserves a v2 blob verbatim under legacy.v2 (+ nested v1)", () => {
    const v3 = migrateToV3(v2, 2);
    expect(v3.version).toBe(3);
    expect(v3.areas).toEqual({});
    expect(v3.legacy?.v2).toEqual(v2);
    expect(v3.legacy?.v1).toEqual(v2.legacy);
  });

  it("migrateToV3 from v1 preserves it under legacy.v1 only", () => {
    const v1 = { version: 1, lessons: { L: {} }, lastVisitedLessonId: null };
    const v3 = migrateToV3(v1, 1);
    expect(v3.legacy?.v1).toEqual(v1);
    expect(v3.legacy?.v2).toBeUndefined();
  });

  it("loads v2 data as a migrated v3 store, writing v3 and leaving v2 intact", () => {
    const backend = createMemoryBackend();
    backend.setItem(PROGRESS_KEY_V2, JSON.stringify(v2));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const store = createProgressStore({ backend, persistent: true });
    const s = store.getState();
    expect(s.version).toBe(3);
    expect(s.legacy?.v2).toBeDefined();
    expect(s.areas).toEqual({});
    expect(backend.getItem(PROGRESS_KEY)).not.toBeNull();
    expect(backend.getItem(PROGRESS_KEY_V2)).toBe(JSON.stringify(v2));
  });

  it("falls all the way back to v1 when no v2/v3 exists", () => {
    const backend = createMemoryBackend();
    backend.setItem(PROGRESS_KEY_V1, JSON.stringify({ version: 1, lessons: {}, lastVisitedLessonId: null }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });
    expect(store.getState().legacy?.v1).toBeDefined();
  });

  it("a fresh v3 store round-trips through the backend", () => {
    const backend = createMemoryBackend();
    const store = createProgressStore({ backend, persistent: true, now: () => "T" });
    store.recordOutcome("A", 0, "core", 0, "correct");
    store.setLastVisited("A", 0, "exercise");
    const reopened = createProgressStore({ backend, persistent: true });
    expect(reopened.getStageProgress("A", 0)?.core[0]).toBe("correct");
    expect(reopened.getLastVisited()).toEqual({ areaId: "A", stageIndex: 0, view: "exercise" });
  });
});

// ---------------------------------------------------------------------------
// Stage recording — core vs extra, sticky completedAt
// ---------------------------------------------------------------------------

describe("stage recording", () => {
  it("records core + extra separately; completedAt is sticky", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), now: () => "DAY1" });
    store.recordOutcome("A", 0, "core", 0, "correct");
    store.recordOutcome("A", 0, "extra", 0, "incorrect");
    store.recordAttempt("A", 0, true);
    const st = store.getStageProgress("A", 0);
    expect(st?.core[0]).toBe("correct");
    expect(st?.extra[0]).toBe("incorrect");
    expect(st?.completedAt).toBe("DAY1");
    expect(st?.attempts).toBe(1);

    // Review re-run records fresh outcomes + attempt, never clears completedAt.
    store.recordOutcome("A", 0, "core", 0, "incorrect");
    store.recordAttempt("A", 0, true);
    const after = store.getStageProgress("A", 0);
    expect(after?.completedAt).toBe("DAY1");
    expect(after?.core[0]).toBe("incorrect");
    expect(after?.attempts).toBe(2);
  });

  it("keeps stages independent within an area", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), now: () => "T" });
    store.recordAttempt("A", 0, true);
    store.recordAttempt("A", 1, false);
    expect(store.getStageProgress("A", 0)?.completedAt).toBe("T");
    expect(store.getStageProgress("A", 1)?.completedAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Stale-id guard + encapsulation
// ---------------------------------------------------------------------------

describe("stale-id guard + encapsulation", () => {
  it("rejects reads AND writes for unknown area ids", () => {
    const store = createProgressStore({
      backend: createMemoryBackend(),
      areaIds: ["real"],
      now: () => "T",
    });
    store.recordOutcome("ghost", 0, "core", 0, "correct");
    store.recordAttempt("ghost", 0, true);
    store.setLastVisited("ghost", 0, "stage");
    expect(store.getState().areas["ghost"]).toBeUndefined();
    expect(store.getLastVisited()).toBeNull();

    store.recordOutcome("real", 0, "core", 0, "correct");
    expect(store.getStageProgress("real", 0)?.core[0]).toBe("correct");
  });

  it("getState returns a copy that cannot mutate the store", () => {
    const store = createProgressStore({ backend: createMemoryBackend() });
    store.recordOutcome("A", 0, "core", 0, "correct");
    const snap = store.getState();
    snap.areas["A"]!.stages[0]!.attempts = 999;
    snap.areas["hacked"] = { stages: {} };
    expect(store.getState().areas["A"]!.stages[0]!.attempts).toBe(0);
    expect(store.getState().areas["hacked"]).toBeUndefined();
  });

  it("resetAll clears area progress but preserves legacy", () => {
    const backend = createMemoryBackend();
    backend.setItem(PROGRESS_KEY_V2, JSON.stringify({ version: 2, areas: {}, lastVisitedAreaId: null, legacy: null }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });
    store.recordOutcome("A", 0, "core", 0, "correct");
    store.resetAll();
    expect(store.getState().areas).toEqual({});
    expect(store.getState().legacy?.v2).toBeDefined(); // legacy never destroyed
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
    store.recordOutcome("A", 0, "core", 0, "correct");
    expect(store.getStageProgress("A", 0)?.core[0]).toBe("correct");
  });

  it("leaves newer-version stored data untouched and reports persistent=false", () => {
    const backend = createMemoryBackend();
    const future = JSON.stringify({ version: 99, lastVisited: null, areas: {}, legacy: null });
    backend.setItem(PROGRESS_KEY, future);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });
    store.recordOutcome("A", 0, "core", 0, "correct");
    expect(backend.getItem(PROGRESS_KEY)).toBe(future);
    expect(store.persistent).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// One-time notice dismissal
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
});
