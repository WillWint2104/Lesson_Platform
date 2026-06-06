// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type {
  MultipleChoiceQuestion,
  Question,
  TextQuestion,
} from "@/ingest/types";
import { MultipleChoice } from "@/render/questions/MultipleChoice";
import { RevealAndSelfMark } from "@/render/questions/RevealAndSelfMark";
import { QuestionRunner } from "@/render/questions/QuestionRunner";

afterEach(cleanup);

const mc = (correctIndex: number): MultipleChoiceQuestion => ({
  type: "multiple-choice",
  prompt: "Pick the right one",
  options: [
    { text: "Option A", isCorrect: correctIndex === 0 },
    { text: "Option B", isCorrect: correctIndex === 1 },
    { text: "Option C", isCorrect: correctIndex === 2 },
  ],
});

describe("MultipleChoice", () => {
  it("marks correct, locks options, and highlights the chosen option green", () => {
    const onOutcome = vi.fn();
    render(<MultipleChoice question={mc(1)} onOutcome={onOutcome} />);

    fireEvent.click(screen.getByRole("button", { name: "Option B" }));

    expect(onOutcome).toHaveBeenCalledTimes(1);
    expect(onOutcome).toHaveBeenCalledWith("correct");
    expect(screen.getByRole("button", { name: "Option B" }).className).toContain(
      "qr-mc__option--correct",
    );
    // Locked: every option button is disabled.
    for (const name of ["Option A", "Option B", "Option C"]) {
      expect(screen.getByRole("button", { name }).hasAttribute("disabled")).toBe(true);
    }
  });

  it("marks wrong, highlights the wrong pick coral AND the correct option green", () => {
    const onOutcome = vi.fn();
    render(<MultipleChoice question={mc(1)} onOutcome={onOutcome} />);

    fireEvent.click(screen.getByRole("button", { name: "Option A" }));

    expect(onOutcome).toHaveBeenCalledWith("incorrect");
    expect(screen.getByRole("button", { name: "Option A" }).className).toContain(
      "qr-mc__option--wrong",
    );
    expect(screen.getByRole("button", { name: "Option B" }).className).toContain(
      "qr-mc__option--correct",
    );
  });

  it("ignores a second selection (first mark wins)", () => {
    const onOutcome = vi.fn();
    render(<MultipleChoice question={mc(1)} onOutcome={onOutcome} />);
    fireEvent.click(screen.getByRole("button", { name: "Option A" }));
    fireEvent.click(screen.getByRole("button", { name: "Option B" }));
    expect(onOutcome).toHaveBeenCalledTimes(1);
  });
});

describe("RevealAndSelfMark", () => {
  it("reveals answer + working, then self-marks correct", () => {
    const onOutcome = vi.fn();
    render(
      <RevealAndSelfMark answer="the answer" working={["step one"]} onOutcome={onOutcome} />,
    );

    // Self-mark hidden until revealed.
    expect(screen.queryByRole("button", { name: "I got it" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));

    expect(screen.getByText("the answer")).toBeTruthy();
    expect(screen.getByText("step one")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "I got it" }));
    expect(onOutcome).toHaveBeenCalledWith("correct");
  });

  it("self-marks 'Not yet' as incorrect", () => {
    const onOutcome = vi.fn();
    render(<RevealAndSelfMark answer="a" onOutcome={onOutcome} />);
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));
    expect(onOutcome).toHaveBeenCalledWith("incorrect");
  });

  it("with no answer, shows self-mark immediately (fallback) and no Show answer", () => {
    const onOutcome = vi.fn();
    render(<RevealAndSelfMark onOutcome={onOutcome} />);
    expect(screen.queryByRole("button", { name: "Show answer" })).toBeNull();
    expect(screen.getByRole("button", { name: "I got it" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "I got it" }));
    expect(onOutcome).toHaveBeenCalledWith("correct");
  });
});

describe("QuestionRunner", () => {
  it("sequences questions, tracks dots, and reports the onComplete payload", () => {
    const onResult = vi.fn();
    const onComplete = vi.fn();
    const textQ: TextQuestion = { type: "text", prompt: "Explain it", answer: "because" };
    const questions: Question[] = [mc(1), textQ];

    const { container } = render(
      <QuestionRunner questions={questions} onResult={onResult} onComplete={onComplete} />,
    );

    // Q1: Continue disabled until answered.
    expect(screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Option B" }));
    expect(onResult).toHaveBeenCalledWith(0, "correct");
    expect(container.querySelectorAll(".qr-dot--correct")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Q2 (text): reveal then mark wrong; the last question's button reads Finish.
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));
    expect(onResult).toHaveBeenCalledWith(1, "incorrect");

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    // Summary: 1 correct / 1 to review.
    expect(screen.getByText("1 correct")).toBeTruthy();
    expect(screen.getByText("1 to review")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onComplete).toHaveBeenCalledWith([
      { index: 0, outcome: "correct" },
      { index: 1, outcome: "incorrect" },
    ]);
  });

  it("shows the difficulty badge when present", () => {
    const q: Question = { type: "text", prompt: "Q", answer: "a", difficulty: "medium" };
    render(<QuestionRunner questions={[q]} onResult={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByText("medium")).toBeTruthy();
  });

  it("shows an alert chip for an unknown question type", () => {
    const bogus = [{ type: "mystery", prompt: "p" }] as unknown as Question[];
    render(<QuestionRunner questions={bogus} onResult={vi.fn()} onComplete={vi.fn()} />);
    expect(screen.getByRole("alert").textContent).toContain("mystery");
  });
});
