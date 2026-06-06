// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import type { MultipleChoiceQuestion } from "@/ingest/types";
import { QuestionRunner } from "@/render/questions/QuestionRunner";
import { createProgressStore, type LessonIndexEntry } from "@/state/progress";
import { createMemoryBackend } from "@/state/storage";
import { ProgressProvider, useLessonProgress } from "@/state/ProgressContext";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const lessons: LessonIndexEntry[] = [
  { id: "L", subject: "math", topic: "algebra", topicArea: "brackets" },
];

const mc = (correctIndex: number): MultipleChoiceQuestion => ({
  type: "multiple-choice",
  prompt: "Pick",
  options: [
    { text: "Option A", isCorrect: correctIndex === 0 },
    { text: "Option B", isCorrect: correctIndex === 1 },
  ],
});

describe("QuestionRunner → progress store wiring", () => {
  it("persists outcomes and a completed attempt for an all-correct run", () => {
    const store = createProgressStore({
      backend: createMemoryBackend(),
      lessons,
      now: () => "T",
    });

    render(
      <QuestionRunner
        questions={[mc(1)]}
        onResult={(i, o) => store.recordOutcome("L", i, o)}
        onComplete={(results) =>
          store.recordAttempt("L", results.length > 0 && results.every((r) => r.outcome === "correct"))
        }
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Option B" })); // correct
    fireEvent.click(screen.getByRole("button", { name: "Finish" })); // enters summary + onComplete

    const record = store.getLessonProgress("L");
    expect(record?.questionOutcomes[0]).toBe("correct");
    expect(record?.attempts).toBe(1);
    expect(record?.completedAt).toBe("T"); // all correct → completed
  });

  it("records an incorrect outcome and an uncompleted attempt", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), lessons, now: () => "T" });
    render(
      <QuestionRunner
        questions={[mc(1)]}
        onResult={(i, o) => store.recordOutcome("L", i, o)}
        onComplete={(results) =>
          store.recordAttempt("L", results.every((r) => r.outcome === "correct"))
        }
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Option A" })); // wrong
    fireEvent.click(screen.getByRole("button", { name: "Finish" })); // enters summary + onComplete

    const record = store.getLessonProgress("L");
    expect(record?.questionOutcomes[0]).toBe("incorrect");
    expect(record?.attempts).toBe(1);
    expect(record?.completedAt).toBeNull();
  });
});

describe("ProgressProvider hooks re-render on change", () => {
  function Attempts({ id }: { id: string }) {
    const { record } = useLessonProgress(id);
    return <span data-testid="attempts">{record?.attempts ?? 0}</span>;
  }

  it("useLessonProgress reflects store updates", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), lessons });
    render(
      <ProgressProvider store={store}>
        <Attempts id="L" />
      </ProgressProvider>,
    );
    expect(screen.getByTestId("attempts").textContent).toBe("0");
    act(() => {
      store.recordAttempt("L", false);
    });
    expect(screen.getByTestId("attempts").textContent).toBe("1");
  });
});
