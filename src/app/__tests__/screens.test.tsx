// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { buildLessonRegistry, type LessonRegistry } from "@/ingest/load";
import { createProgressStore, type ProgressStore } from "@/state/progress";
import { createMemoryBackend } from "@/state/storage";
import { RegistryProvider } from "@/app/RegistryContext";
import { ProgressProvider } from "@/state/ProgressContext";
import { AppRoutes } from "@/app/AppRoutes";

afterEach(cleanup);

type LessonOpts = { order?: number; title?: string; questions?: unknown[] };

function mkLesson(area: string, id: string, opts: LessonOpts = {}): Record<string, unknown> {
  return {
    [`/content/math/algebra/${area}/${id}/lesson.json`]: {
      lesson: {
        id,
        title: opts.title ?? id,
        ...(opts.order != null ? { order: opts.order } : {}),
        video: { src: null, duration: null },
        notes: [],
        questions: opts.questions ?? [{ type: "text", prompt: "Q" }],
      },
    },
  };
}

const mcQuestion = {
  type: "multiple-choice",
  prompt: "Pick",
  options: [
    { text: "Right", isCorrect: true },
    { text: "Wrong", isCorrect: false },
  ],
};

function buildRegistry(...lessons: Record<string, unknown>[]): LessonRegistry {
  return buildLessonRegistry(Object.assign({}, ...lessons));
}

function buildStore(registry: LessonRegistry): ProgressStore {
  return createProgressStore({
    backend: createMemoryBackend(),
    lessons: registry.lessons.map((l) => ({
      id: l.id,
      subject: l.subject,
      topic: l.topic,
      topicArea: l.topicArea,
      questions: l.questions.map((q) => ({ skill: q.skill, difficulty: q.difficulty })),
    })),
  });
}

function renderAt(path: string, registry: LessonRegistry, store: ProgressStore) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RegistryProvider registry={registry}>
        <ProgressProvider store={store}>
          <AppRoutes />
        </ProgressProvider>
      </RegistryProvider>
    </MemoryRouter>,
  );
}

describe("Library", () => {
  it("renders subject pills from the registry (not hardcoded) + a 'more soon' pill", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1 }));
    renderAt("/", registry, buildStore(registry));
    expect(screen.getByRole("button", { name: "Math" })).toBeTruthy();
    expect(screen.getByText("more soon")).toBeTruthy();
  });

  it("shows the local-progress notice once and persists dismissal via the store", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1 }));
    const store = buildStore(registry);
    renderAt("/", registry, store);
    expect(screen.getByText(/saved in this browser/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/saved in this browser/i)).toBeNull();
    expect(store.isNoticeDismissed("local-progress")).toBe(true);
  });

  it("hero is in 'start here' mode (always present) with no last-visited lesson", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1, title: "Brackets One" }));
    renderAt("/", registry, buildStore(registry));
    expect(screen.getByText("Start here")).toBeTruthy();
    // Points at the first lesson of the first topic/area.
    expect(screen.getByText("Start here").closest("a")?.getAttribute("href")).toBe(
      "/math/algebra/brackets/one",
    );
  });

  it("hero is in 'continue' mode when a lesson was last visited (deep link)", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1, title: "Brackets One" }));
    const store = buildStore(registry);
    store.setLastVisited("one");
    renderAt("/", registry, store);
    expect(screen.getByText("Continue where you left off")).toBeTruthy();
    expect(screen.getByText("Continue where you left off").closest("a")?.getAttribute("href")).toBe(
      "/math/algebra/brackets/one",
    );
  });

  it("renders topic-area rows inside the topic card, each linking to its lesson list", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1 }));
    const { container } = renderAt("/", registry, buildStore(registry));
    const row = screen.getByText("Brackets").closest("a");
    expect(row?.getAttribute("href")).toBe("/math/algebra/brackets");
    expect(row?.className).toContain("topic-area-row");
    // Responsive grid container + the empty-room placeholder tile are present.
    expect(container.querySelector(".topic-grid")).not.toBeNull();
    expect(screen.getByText(/Future topics drop in/)).toBeTruthy();
  });
});

describe("LessonPage", () => {
  it("defaults to the Notes tab and shows the coming-soon stage for a null video", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1 }));
    renderAt("/math/algebra/brackets/one", registry, buildStore(registry));
    expect(screen.getByRole("button", { name: "Notes" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Video coming soon.")).toBeTruthy();
  });

  it("renders not-found for an invalid lessonId", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1 }));
    renderAt("/math/algebra/brackets/ghost", registry, buildStore(registry));
    expect(screen.getByRole("heading", { name: "Not found" })).toBeTruthy();
  });

  it("offers a Next-lesson CTA after completing a lesson when the next unlocks", () => {
    const registry = buildRegistry(
      mkLesson("brackets", "one", { order: 1, questions: [mcQuestion] }),
      mkLesson("brackets", "two", { order: 2 }),
    );
    renderAt("/math/algebra/brackets/one", registry, buildStore(registry));
    fireEvent.click(screen.getByRole("button", { name: /Practice/ }));
    fireEvent.click(screen.getByRole("button", { name: "Right" })); // correct
    fireEvent.click(screen.getByRole("button", { name: "Finish" })); // completes → unlocks two
    expect(screen.getByRole("link", { name: "Next lesson →" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to/ })).toBeTruthy();
  });

  it("opens a completed lesson in review mode (banner) and keeps it complete on a fresh run", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1, questions: [mcQuestion] }));
    const store = buildStore(registry);
    store.recordAttempt("one", true); // pre-complete
    const before = store.getLessonProgress("one")?.completedAt;
    renderAt("/math/algebra/brackets/one", registry, store);
    expect(screen.getByText(/review mode/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Practice/ }));
    fireEvent.click(screen.getByRole("button", { name: "Wrong" })); // fresh, incorrect
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    const rec = store.getLessonProgress("one");
    expect(rec?.completedAt).toBe(before); // never cleared
    expect(rec?.questionOutcomes[0]).toBe("incorrect"); // fresh outcome
    expect(rec?.attempts).toBe(2); // pre-complete + this run
  });

  it("re-evaluates entry mode when navigating to another lesson (no stale review)", () => {
    const registry = buildRegistry(
      mkLesson("brackets", "one", { order: 1, questions: [mcQuestion] }),
      mkLesson("brackets", "two", { order: 2, title: "Two", questions: [mcQuestion] }),
    );
    const store = buildStore(registry);
    store.recordAttempt("one", true); // lesson one complete
    renderAt("/math/algebra/brackets/one", registry, store);
    expect(screen.getByText(/review mode/)).toBeTruthy();

    // Jump from the completed lesson to the next (incomplete) one — same
    // component instance, only the :lessonId param changes.
    fireEvent.click(screen.getByRole("button", { name: /Practice/ }));
    fireEvent.click(screen.getByRole("button", { name: "Wrong" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    fireEvent.click(screen.getByRole("link", { name: "Next lesson →" }));

    expect(screen.getByRole("heading", { name: "Two" })).toBeTruthy();
    expect(screen.queryByText(/review mode/)).toBeNull(); // not carried over
  });
});

describe("LessonSelection routing + cards", () => {
  it("renders not-found for invalid hierarchy params", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1 }));
    renderAt("/nope/nope/nope", registry, buildStore(registry));
    expect(screen.getByRole("heading", { name: "Not found" })).toBeTruthy();
  });

  it("maps the first lesson to Continue and a later one to a locked unlock note", () => {
    const registry = buildRegistry(
      mkLesson("brackets", "one", { order: 1 }),
      mkLesson("brackets", "two", { order: 2 }),
    );
    renderAt("/math/algebra/brackets", registry, buildStore(registry));
    expect(screen.getByRole("link", { name: "Continue" })).toBeTruthy();
    expect(screen.getByText("Complete lesson 1 to unlock")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Review" })).toBeNull();
  });

  it("maps a completed lesson to Review and unlocks the next as Continue", () => {
    const registry = buildRegistry(
      mkLesson("brackets", "one", { order: 1 }),
      mkLesson("brackets", "two", { order: 2 }),
    );
    const store = buildStore(registry);
    store.recordAttempt("one", true); // complete lesson one
    renderAt("/math/algebra/brackets", registry, store);
    expect(screen.getByRole("link", { name: "Review" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue" })).toBeTruthy();
    // No lesson-card is locked now (the checkpoint's "unlocks after" is separate).
    expect(screen.queryByText(/Complete lesson/)).toBeNull();
  });

  it("shows the locked checkpoint card", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1 }));
    renderAt("/math/algebra/brackets", registry, buildStore(registry));
    expect(screen.getByText(/unlocks after lesson 1/)).toBeTruthy();
  });
});
