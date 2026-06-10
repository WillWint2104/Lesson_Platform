import { describe, it, expect, vi, afterEach } from "vitest";
import {
  serializeState,
  restoreState,
  migrateToV4,
  createProgressStore,
  type ProgressState,
} from "@/state/progress";
import {
  createMemoryBackend,
  PROGRESS_KEY,
  PROGRESS_KEY_V3,
  PROGRESS_KEY_V2,
  PROGRESS_KEY_V1,
  CORRUPT_KEY,
} from "@/state/storage";

afterEach(() => vi.restoreAllMocks());

const AREA = "math/algebra/expanding-brackets";
const r = (answer: string, correct: boolean) => ({ answer, correct });

const fullState: ProgressState = {
  version: 4,
  lastVisited: { areaId: AREA, stageIndex: 1, view: "exercise" },
  areas: {
    [AREA]: {
      stages: {
        0: {
          core: { 0: r("4x + 12", true), 1: r("x", false) },
          extra: { 0: r("6x + 12", true) },
          attempts: 2,
          completedAt: "2026-01-01T00:00:00.000Z",
        },
        2: { core: {}, extra: {}, attempts: 0, completedAt: null },
      },
    },
  },
  legacy: {
    v3: { version: 3, lastVisited: null, areas: {}, legacy: null },
    v2: { version: 2, lastVisitedAreaId: null, areas: {}, legacy: null },
    v1: { lessons: { L: {} }, lastVisitedLessonId: null },
  },
};

// ---------------------------------------------------------------------------
// Save/restore symmetry — the whitelist round-trip (centrepiece)
// ---------------------------------------------------------------------------

describe("save/restore symmetry (v4)", () => {
  it("preserves the whole v4 state through serialize -> restore", () => {
    expect(restoreState(JSON.parse(serializeState(fullState)))).toEqual(fullState);
  });

  it("every field of a fully-populated state survives (whitelist guard)", () => {
    const round = restoreState(JSON.parse(serializeState(fullState)));
    for (const key of Object.keys(fullState)) expect(round).toHaveProperty(key);
    const stageKeys = Object.keys(fullState.areas[AREA]!.stages[0]!).sort();
    expect(Object.keys(round.areas[AREA]!.stages[0]!).sort()).toEqual(stageKeys);
    // AnswerRecord leaf survives intact.
    expect(round.areas[AREA]!.stages[0]!.core[0]).toEqual({ answer: "4x + 12", correct: true });
    expect(Object.keys(round.legacy!).sort()).toEqual(["v1", "v2", "v3"]);
  });
});

// ---------------------------------------------------------------------------
// v3/v2/v1 → v4 migration (old progress preserved verbatim, current starts fresh)
// ---------------------------------------------------------------------------

describe("migration to v4", () => {
  const v3blob = {
    version: 3,
    lastVisited: { areaId: AREA, stageIndex: 0, view: "exercise" },
    areas: { [AREA]: { stages: { 0: { core: { 0: "correct" }, extra: {}, attempts: 1, completedAt: "T" } } } },
    legacy: { v2: { version: 2, areas: {} }, v1: { lessons: {} } },
  };

  it("migrateToV4 from v3 preserves it under legacy.v3 and carries the v2/v1 chain", () => {
    const v4 = migrateToV4(v3blob, 3);
    expect(v4.version).toBe(4);
    expect(v4.areas).toEqual({}); // current progress resets
    expect(v4.legacy?.v3).toEqual(v3blob);
    expect(v4.legacy?.v2).toEqual(v3blob.legacy.v2);
    expect(v4.legacy?.v1).toEqual(v3blob.legacy.v1);
  });

  it("migrateToV4 from v2 preserves it under legacy.v2 (+ nested v1)", () => {
    const v2 = { version: 2, areas: {}, legacy: { lessons: {} } };
    const v4 = migrateToV4(v2, 2);
    expect(v4.legacy?.v2).toEqual(v2);
    expect(v4.legacy?.v1).toEqual(v2.legacy);
    expect(v4.legacy?.v3).toBeUndefined();
  });

  it("migrateToV4 from v1 preserves it under legacy.v1 only", () => {
    const v1 = { version: 1, lessons: { L: {} }, lastVisitedLessonId: null };
    const v4 = migrateToV4(v1, 1);
    expect(v4.legacy?.v1).toEqual(v1);
    expect(v4.legacy?.v2).toBeUndefined();
  });

  it("loads v3 data as a migrated v4 store, writing v4 and leaving v3 intact", () => {
    const backend = createMemoryBackend();
    backend.setItem(PROGRESS_KEY_V3, JSON.stringify(v3blob));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const store = createProgressStore({ backend, persistent: true });
    const s = store.getState();
    expect(s.version).toBe(4);
    expect(s.legacy?.v3).toBeDefined();
    expect(s.areas).toEqual({}); // current progress starts fresh
    expect(backend.getItem(PROGRESS_KEY)).not.toBeNull();
    expect(backend.getItem(PROGRESS_KEY_V3)).toBe(JSON.stringify(v3blob));
  });

  it("falls all the way back to v1 when no newer key exists", () => {
    const backend = createMemoryBackend();
    backend.setItem(PROGRESS_KEY_V1, JSON.stringify({ version: 1, lessons: {}, lastVisitedLessonId: null }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });
    expect(store.getState().legacy?.v1).toBeDefined();
  });

  it("a fresh v4 store round-trips through the backend", () => {
    const backend = createMemoryBackend();
    const store = createProgressStore({ backend, persistent: true, now: () => "T" });
    store.recordResult("A", 0, "core", 0, r("4x+12", true));
    store.setLastVisited("A", 0, "exercise");
    const reopened = createProgressStore({ backend, persistent: true });
    expect(reopened.getStageProgress("A", 0)?.core[0]).toEqual({ answer: "4x+12", correct: true });
    expect(reopened.getLastVisited()).toEqual({ areaId: "A", stageIndex: 0, view: "exercise" });
  });
});

// ---------------------------------------------------------------------------
// Stage recording — core vs extra, sticky completedAt
// ---------------------------------------------------------------------------

describe("stage recording", () => {
  it("records core + extra separately; completedAt is sticky", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), now: () => "DAY1" });
    store.recordResult("A", 0, "core", 0, r("4x+12", true));
    store.recordResult("A", 0, "extra", 0, r("oops", false));
    store.recordAttempt("A", 0, true);
    const st = store.getStageProgress("A", 0);
    expect(st?.core[0]).toEqual({ answer: "4x+12", correct: true });
    expect(st?.extra[0]).toEqual({ answer: "oops", correct: false });
    expect(st?.completedAt).toBe("DAY1");
    expect(st?.attempts).toBe(1);

    // Review re-run records fresh results + attempt, never clears completedAt.
    store.recordResult("A", 0, "core", 0, r("wrong", false));
    store.recordAttempt("A", 0, true);
    const after = store.getStageProgress("A", 0);
    expect(after?.completedAt).toBe("DAY1");
    expect(after?.core[0]).toEqual({ answer: "wrong", correct: false });
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
    store.recordResult("ghost", 0, "core", 0, r("x", true));
    store.recordAttempt("ghost", 0, true);
    store.setLastVisited("ghost", 0, "stage");
    expect(store.getState().areas["ghost"]).toBeUndefined();
    expect(store.getLastVisited()).toBeNull();

    store.recordResult("real", 0, "core", 0, r("x", true));
    expect(store.getStageProgress("real", 0)?.core[0]).toEqual({ answer: "x", correct: true });
  });

  it("getState returns a copy that cannot mutate the store", () => {
    const store = createProgressStore({ backend: createMemoryBackend() });
    store.recordResult("A", 0, "core", 0, r("x", true));
    const snap = store.getState();
    snap.areas["A"]!.stages[0]!.attempts = 999;
    snap.areas["A"]!.stages[0]!.core[0]!.correct = false;
    snap.areas["hacked"] = { stages: {} };
    expect(store.getState().areas["A"]!.stages[0]!.attempts).toBe(0);
    expect(store.getState().areas["A"]!.stages[0]!.core[0]).toEqual({ answer: "x", correct: true });
    expect(store.getState().areas["hacked"]).toBeUndefined();
  });

  it("resetAll clears area progress but preserves legacy", () => {
    const backend = createMemoryBackend();
    backend.setItem(PROGRESS_KEY_V2, JSON.stringify({ version: 2, areas: {}, lastVisitedAreaId: null, legacy: null }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });
    store.recordResult("A", 0, "core", 0, r("x", true));
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
    store.recordResult("A", 0, "core", 0, r("x", true));
    expect(store.getStageProgress("A", 0)?.core[0]).toEqual({ answer: "x", correct: true });
  });

  it("leaves newer-version stored data untouched and reports persistent=false", () => {
    const backend = createMemoryBackend();
    const future = JSON.stringify({ version: 99, lastVisited: null, areas: {}, legacy: null });
    backend.setItem(PROGRESS_KEY, future);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = createProgressStore({ backend, persistent: true });
    store.recordResult("A", 0, "core", 0, r("x", true));
    expect(backend.getItem(PROGRESS_KEY)).toBe(future);
    expect(store.persistent).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// One-time notice dismissal
// ---------------------------------------------------------------------------

describe("selected course (stale-id guarded)", () => {
  it("remembers + persists the selected course, and excludes a stale one", () => {
    const backend = createMemoryBackend();
    const a = createProgressStore({ backend, courseIds: ["year-8", "year-11-advanced"] });
    expect(a.getSelectedCourse()).toBeNull();
    a.setSelectedCourse("year-8");
    expect(a.getSelectedCourse()).toBe("year-8");
    expect(backend.getItem("lp:selected-course")).toBe("year-8");

    // A reopened store with a registry that no longer has that course excludes it.
    const b = createProgressStore({ backend, courseIds: ["year-11-advanced"] });
    expect(b.getSelectedCourse()).toBeNull(); // stale → guarded out
    // Without a course registry (no guard), the stored value is returned as-is.
    const c = createProgressStore({ backend });
    expect(c.getSelectedCourse()).toBe("year-8");
  });
});

describe("local enrolment (joinedCourses, dashboard-register-v1)", () => {
  const COURSES = ["year-8", "year-11-advanced", "year-12-advanced"];

  it("join/leave/isJoined persist through the backend and a fresh store", () => {
    const backend = createMemoryBackend();
    const a = createProgressStore({ backend, courseIds: COURSES });
    expect(a.getJoinedCourses()).toEqual([]);
    a.joinCourse("year-8");
    a.joinCourse("year-11-advanced");
    a.joinCourse("year-8"); // idempotent
    expect(a.getJoinedCourses()).toEqual(["year-8", "year-11-advanced"]);
    expect(a.isJoined("year-8")).toBe(true);
    expect(backend.getItem("lp:joined-courses")).toBe(JSON.stringify(["year-8", "year-11-advanced"]));

    // Restore path: a fresh store reads the same list.
    const b = createProgressStore({ backend, courseIds: COURSES });
    expect(b.getJoinedCourses()).toEqual(["year-8", "year-11-advanced"]);
    b.leaveCourse("year-11-advanced");
    expect(b.getJoinedCourses()).toEqual(["year-8"]);
    expect(b.isJoined("year-11-advanced")).toBe(false);
  });

  it("stale-guards joined ids against the course registry (retained in storage)", () => {
    const backend = createMemoryBackend();
    backend.setItem("lp:joined-courses", JSON.stringify(["ghost-course", "year-8"]));
    const store = createProgressStore({ backend, courseIds: COURSES });
    expect(store.getJoinedCourses()).toEqual(["year-8"]); // ghost excluded from reads
    expect(store.isJoined("ghost-course")).toBe(false);
    // …but retained in storage (never destroyed).
    expect(backend.getItem("lp:joined-courses")).toContain("ghost-course");
    store.joinCourse("nope"); // unknown id is never persisted
    expect(backend.getItem("lp:joined-courses")).not.toContain("nope");
  });

  it("the current course must be joined: select auto-joins; leaving clears it", () => {
    const backend = createMemoryBackend();
    const store = createProgressStore({ backend, courseIds: COURSES });
    store.setSelectedCourse("year-8");
    expect(store.isJoined("year-8")).toBe(true); // selecting implies enrolment
    expect(store.getSelectedCourse()).toBe("year-8");

    store.leaveCourse("year-8");
    expect(store.getSelectedCourse()).toBeNull(); // invariant restored
    expect(backend.getItem("lp:selected-course")).toBeNull();
  });

  it("a remembered-but-unjoined course reads as null (invariant on read)", () => {
    const backend = createMemoryBackend();
    backend.setItem("lp:selected-course", "year-8"); // legacy: selected without joined
    const store = createProgressStore({ backend, courseIds: COURSES });
    expect(store.getSelectedCourse()).toBeNull();
  });

  it("isFirstVisit = no joined courses AND no remembered course", () => {
    const backend = createMemoryBackend();
    const store = createProgressStore({ backend, courseIds: COURSES });
    expect(store.isFirstVisit()).toBe(true);
    store.joinCourse("year-8");
    expect(store.isFirstVisit()).toBe(false);
    store.leaveCourse("year-8");
    expect(store.isFirstVisit()).toBe(true);
  });
});

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
