/**
 * @file QuestionRunner.tsx — the question-set shell.
 *
 * One question at a time: a header with progress dots + the difficulty badge, a
 * type-specific body (via QuestionView), a Continue button, and an end-of-set
 * summary whose "Done" action fires onComplete. All state is local to the
 * runner; results are emitted via callbacks (no persistence here).
 */

import { useState } from "react";
import type { Question } from "@/ingest/types";
import { QuestionView } from "./QuestionView";
import type { Outcome, QuestionResult } from "./types";

export interface QuestionRunnerProps {
  questions: Question[];
  onComplete: (results: QuestionResult[]) => void;
  onResult: (index: number, outcome: Outcome) => void;
}

export function QuestionRunner({ questions, onComplete, onResult }: QuestionRunnerProps) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<(Outcome | null)[]>(() => questions.map(() => null));
  const [showSummary, setShowSummary] = useState(false);

  if (questions.length === 0) {
    return <div className="qr">No questions in this set.</div>;
  }

  const handleOutcome = (outcome: Outcome) => {
    setResults((prev) => {
      if (prev[index] !== null) return prev; // first mark wins
      const next = [...prev];
      next[index] = outcome;
      return next;
    });
    if (results[index] === null) onResult(index, outcome);
  };

  const answered = results[index] !== null;
  const isLast = index === questions.length - 1;

  const advance = () => {
    if (isLast) setShowSummary(true);
    else setIndex((i) => i + 1);
  };

  const finish = () => {
    onComplete(
      results.flatMap((outcome, i) => (outcome ? [{ index: i, outcome }] : [])),
    );
  };

  if (showSummary) {
    const correct = results.filter((o) => o === "correct").length;
    const toReview = results.length - correct;
    return (
      <section className="qr" aria-label="Practice summary">
        <ProgressDots results={results} current={-1} />
        <div className="qr-summary">
          <h3 className="qr-summary__title">Set complete</h3>
          <p className="qr-summary__counts">
            <span className="qr-summary__correct">{correct} correct</span>
            {" / "}
            <span className="qr-summary__review">{toReview} to review</span>
          </p>
          <button type="button" className="qr-button qr-button--primary" onClick={finish}>
            Done
          </button>
        </div>
      </section>
    );
  }

  const current = questions[index]!;

  return (
    <section className="qr" aria-label="Practice">
      <header className="qr-header">
        <ProgressDots results={results} current={index} />
        <span className="qr-progress-label">
          Question {index + 1} of {questions.length}
        </span>
        {current.difficulty ? (
          <span className="qr-difficulty">{current.difficulty}</span>
        ) : null}
      </header>

      {/* key by index so each question mounts fresh (no leaked selection state). */}
      <QuestionView key={index} question={current} onOutcome={handleOutcome} />

      <div className="qr-footer">
        <button
          type="button"
          className="qr-button qr-button--primary"
          disabled={!answered}
          onClick={advance}
        >
          {isLast ? "Finish" : "Continue"}
        </button>
      </div>
    </section>
  );
}

function ProgressDots({ results, current }: { results: (Outcome | null)[]; current: number }) {
  return (
    <div className="qr-dots" aria-hidden="true">
      {results.map((outcome, i) => {
        let cls = "qr-dot";
        if (outcome === "correct") cls += " qr-dot--correct";
        else if (outcome === "incorrect") cls += " qr-dot--wrong";
        else if (i === current) cls += " qr-dot--current";
        else cls += " qr-dot--ahead";
        return <span key={i} className={cls} />;
      })}
    </div>
  );
}
