/**
 * @file QuestionRunner.tsx — the question-set shell.
 *
 * One question at a time: a header with progress dots + the difficulty badge, a
 * type-specific body (via QuestionView), a Continue button, and an end-of-set
 * summary whose "Done" action fires onComplete. All state is local to the
 * runner; results are emitted via callbacks (no persistence here).
 */

import { useRef, useState } from "react";
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
  const [prevQuestions, setPrevQuestions] = useState(questions);
  // Synchronous "this index already emitted" guard — robust against a rapid
  // second outcome before the results state re-renders.
  const emitted = useRef<Set<number>>(new Set());

  // Reset when the question set changes (React-recommended reset-during-render —
  // no effect, no flash). Compute the values used THIS render so the swap pass
  // never dereferences a stale, out-of-bounds index.
  let curIndex = index;
  let curResults = results;
  let curSummary = showSummary;
  if (questions !== prevQuestions) {
    curIndex = 0;
    curResults = questions.map(() => null);
    curSummary = false;
    setPrevQuestions(questions);
    setIndex(0);
    setResults(curResults);
    setShowSummary(false);
    emitted.current = new Set();
  }

  if (questions.length === 0) {
    return <div className="qr">No questions in this set.</div>;
  }

  const handleOutcome = (outcome: Outcome) => {
    if (emitted.current.has(curIndex)) return; // first mark wins, exactly once
    emitted.current.add(curIndex);
    setResults((prev) => {
      const next = [...prev];
      next[curIndex] = outcome;
      return next;
    });
    onResult(curIndex, outcome);
  };

  const advance = () => {
    if (curIndex === questions.length - 1) setShowSummary(true);
    else setIndex((i) => i + 1);
  };

  const finish = () => {
    onComplete(curResults.flatMap((outcome, i) => (outcome ? [{ index: i, outcome }] : [])));
  };

  if (curSummary) {
    const correct = curResults.filter((o) => o === "correct").length;
    const toReview = curResults.length - correct;
    return (
      <section className="qr" aria-label="Practice summary">
        <ProgressDots results={curResults} current={-1} />
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

  const answered = curResults[curIndex] !== null;
  const isLast = curIndex === questions.length - 1;
  const current = questions[curIndex]!;

  return (
    <section className="qr" aria-label="Practice">
      <header className="qr-header">
        <ProgressDots results={curResults} current={curIndex} />
        <span className="qr-progress-label">
          Question {curIndex + 1} of {questions.length}
        </span>
        {current.difficulty ? (
          <span className="qr-difficulty">{current.difficulty}</span>
        ) : null}
      </header>

      {/* key by index so each question mounts fresh (no leaked selection state). */}
      <QuestionView key={curIndex} question={current} onOutcome={handleOutcome} />

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
