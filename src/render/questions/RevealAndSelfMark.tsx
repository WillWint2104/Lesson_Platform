import { useState } from "react";
import { MathText } from "@/shared/MathText";
import type { OutcomeHandler } from "./types";

/**
 * Shared reveal + self-mark flow used by text / table / figure questions
 * (CLAUDE.md §c rule 4 — one flow, not per-type copies).
 *
 * - With an `answer`: a "Show answer" button reveals the answer chip (and any
 *   working lines, NoteExample-style), then the self-mark buttons appear.
 * - Without an `answer`: the self-mark buttons show immediately (the validator
 *   warning's fallback).
 *
 * The chosen mark is emitted once through `onOutcome` and then locks.
 */
export function RevealAndSelfMark({
  answer,
  working,
  onOutcome,
}: {
  answer?: string;
  working?: string[];
  onOutcome: OutcomeHandler;
}) {
  const hasAnswer = typeof answer === "string" && answer.trim().length > 0;
  const [revealed, setRevealed] = useState(false);
  const [marked, setMarked] = useState<"correct" | "incorrect" | null>(null);

  const mark = (outcome: "correct" | "incorrect") => {
    if (marked !== null) return;
    setMarked(outcome);
    onOutcome(outcome);
  };

  const showSelfMark = !hasAnswer || revealed;

  return (
    <div className="qr-selfmark">
      {hasAnswer && !revealed ? (
        <button
          type="button"
          className="qr-button qr-button--ghost"
          onClick={() => setRevealed(true)}
        >
          Show answer
        </button>
      ) : null}

      {hasAnswer && revealed ? (
        <div className="qr-reveal">
          <span className="qr-reveal__answer">
            <MathText>{answer as string}</MathText>
          </span>
          {working && working.length > 0 ? (
            <div className="qr-reveal__working">
              {working.map((line, index) => (
                <div key={index} className="qr-reveal__working-line">
                  <MathText>{line}</MathText>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {showSelfMark ? (
        <div className="qr-selfmark__buttons">
          <button
            type="button"
            className="qr-button qr-button--correct"
            disabled={marked !== null}
            onClick={() => mark("correct")}
          >
            I got it
          </button>
          <button
            type="button"
            className="qr-button qr-button--review"
            disabled={marked !== null}
            onClick={() => mark("incorrect")}
          >
            Not yet
          </button>
        </div>
      ) : null}

      {marked ? (
        <p className="qr-feedback">
          {marked === "correct" ? "Marked as correct." : "Marked for review."}
        </p>
      ) : null}
    </div>
  );
}
