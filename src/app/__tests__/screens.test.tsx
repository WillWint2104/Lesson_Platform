// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { buildLessonRegistry, type LessonRegistry } from "@/ingest/load";
import { createProgressStore, type ProgressStore } from "@/state/progress";
import { createMemoryBackend } from "@/state/storage";
import { RegistryProvider } from "@/app/RegistryContext";
import { ProgressProvider } from "@/state/ProgressContext";
import { AppRoutes } from "@/app/AppRoutes";

afterEach(cleanup);

type LessonOpts = { order?: number; title?: string };

function mkLesson(area: string, id: string, opts: LessonOpts = {}): Record<string, unknown> {
  return {
    [`/content/math/algebra/${area}/${id}/lesson.json`]: {
      lesson: {
        id,
        title: opts.title ?? id,
        ...(opts.order != null ? { order: opts.order } : {}),
        video: { src: null, duration: null },
        notes: [],
        questions: [{ type: "text", prompt: "Q" }],
      },
    },
  };
}

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
    expect(screen.getByRole("tab", { name: "Math" })).toBeTruthy();
    expect(screen.getByText("more soon")).toBeTruthy();
  });

  it("hides the continue hero when there is no last-visited lesson", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1 }));
    renderAt("/", registry, buildStore(registry));
    expect(screen.queryByText("Jump back in")).toBeNull();
  });

  it("shows the continue hero when a lesson was last visited", () => {
    const registry = buildRegistry(mkLesson("brackets", "one", { order: 1, title: "Brackets One" }));
    const store = buildStore(registry);
    store.setLastVisited("one");
    renderAt("/", registry, store);
    expect(screen.getByText("Jump back in")).toBeTruthy();
    expect(screen.getByText("Brackets One")).toBeTruthy();
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
