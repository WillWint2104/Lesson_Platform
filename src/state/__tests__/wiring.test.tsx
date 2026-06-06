// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { MultipleChoiceQuestion } from "@/ingest/types";
import { QuestionRunner } from "@/render/questions/QuestionRunner";
import { createProgressStore } from "@/state/progress";
import { createMemoryBackend } from "@/state/storage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const AREA = "math/algebra/brackets";
const SEG = 1;

const mc = (correctIndex: number): MultipleChoiceQuestion => ({
  type: "multiple-choice",
  prompt: "Pick",
  options: [
    { text: "Option A", isCorrect: correctIndex === 0 },
    { text: "Option B", isCorrect: correctIndex === 1 },
  ],
});

function wire(store: ReturnType<typeof createProgressStore>) {
  return render(
    <QuestionRunner
      questions={[mc(1)]}
      onResult={(i, o) => store.recordOutcome(AREA, SEG, i, o)}
      onComplete={(results) =>
        store.recordAttempt(
          AREA,
          SEG,
          results.length > 0 && results.every((r) => r.outcome === "correct"),
        )
      }
    />,
  );
}

describe("QuestionRunner → v2 progress store wiring (area + segment)", () => {
  it("persists outcomes + a completed attempt for an all-correct run", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), now: () => "T" });
    wire(store);
    fireEvent.click(screen.getByRole("button", { name: "Option B" })); // correct
    fireEvent.click(screen.getByRole("button", { name: "Finish" })); // summary + onComplete

    const seg = store.getExerciseProgress(AREA, SEG);
    expect(seg?.questionOutcomes[0]).toBe("correct");
    expect(seg?.attempts).toBe(1);
    expect(seg?.completedAt).toBe("T");
  });

  it("records an incorrect outcome + an uncompleted attempt", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), now: () => "T" });
    wire(store);
    fireEvent.click(screen.getByRole("button", { name: "Option A" })); // wrong
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    const seg = store.getExerciseProgress(AREA, SEG);
    expect(seg?.questionOutcomes[0]).toBe("incorrect");
    expect(seg?.attempts).toBe(1);
    expect(seg?.completedAt).toBeNull();
  });
});
