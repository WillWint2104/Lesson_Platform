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
const STAGE = 1;

const mc = (correctIndex: number): MultipleChoiceQuestion => ({
  type: "multiple-choice",
  prompt: "Pick",
  options: [
    { text: "Option A", isCorrect: correctIndex === 0 },
    { text: "Option B", isCorrect: correctIndex === 1 },
  ],
});

// Wire the dormant QuestionRunner to the v4 store: each outcome becomes an
// AnswerRecord { answer, correct }; completion is "all answered" (any result),
// not "all correct".
function wire(store: ReturnType<typeof createProgressStore>) {
  return render(
    <QuestionRunner
      questions={[mc(1)]}
      onResult={(i, o) =>
        store.recordResult(AREA, STAGE, "core", i, { answer: o, correct: o === "correct" })
      }
      onComplete={(results) =>
        store.recordAttempt(AREA, STAGE, results.length > 0 && results.every((r) => !!r.outcome))
      }
    />,
  );
}

describe("QuestionRunner → v4 progress store wiring (area + stage, core pool)", () => {
  it("persists a correct result + a completed attempt", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), now: () => "T" });
    wire(store);
    fireEvent.click(screen.getByRole("button", { name: "Option B" })); // correct
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    const st = store.getStageProgress(AREA, STAGE);
    expect(st?.core[0]?.correct).toBe(true);
    expect(st?.attempts).toBe(1);
    expect(st?.completedAt).toBe("T");
  });

  it("completes the stage even on an incorrect answer (completion = answered)", () => {
    const store = createProgressStore({ backend: createMemoryBackend(), now: () => "T" });
    wire(store);
    fireEvent.click(screen.getByRole("button", { name: "Option A" })); // wrong
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    const st = store.getStageProgress(AREA, STAGE);
    expect(st?.core[0]?.correct).toBe(false);
    expect(st?.attempts).toBe(1);
    expect(st?.completedAt).toBe("T"); // answered → complete, regardless of correctness
  });
});
