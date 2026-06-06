/**
 * @file QuestionRunner.tsx — the question-set shell.
 *
 * One question at a time: a header with progress dots + the difficulty badge, a
 * type-specific body (via QuestionView), a Continue button, and an end-of-set
 * summary. `initialOutcomes` seeds the dots and resumes at the first unanswered
 * question (strictly forward). `onComplete` fires when the summary is reached;
 * `summaryActions` lets the parent render flow CTAs in the summary.
 */

import { useRef, useState, type ReactNode } from "react";
import type { Question } from "@/ingest/types";
import { QuestionView } from "./QuestionView";
import type { Outcome, QuestionResult } from "./types";

export interface QuestionRunnerProps {
  questions: Question[];
  onComplete: (results: QuestionResult[]) => void;
  onResult: (index: number, outcome: Outcome) => void;
  /** Previously recorded outcomes by index — seeds dots + resume point. */
  initialOutcomes?: Record<number, Outcome>;
  /** Rendered inside the end-of-set summary (flow CTAs). */
  summaryActions?: ReactNode;
}

function seedResults(questions: Question[], initial?: Record<number, Outcome>): (Outcome | null)[] {
  return questions.map((_, i) => initial?.[i] ?? null);
}

/** First unanswered index (resume point); 0 if every question is answered. */
function firstUnanswered(results: (Outcome | null)[]): number {
  const i = results.findIndex((r) => r === null);
  return i === -1 ? 0 : i;
}

export function QuestionRunner({
  questions,
  onComplete,
  onResult,
  initialOutcomes,
  summaryActions,
}: QuestionRunnerProps) {
  const [results, setResults] = useState<(Outcome | null)[]>(() =>
    seedResults(questions, initialOutcomes),
  );
  const [index, setIndex] = useState(() => firstUnanswered(seedResults(questions, initialOutcomes)));
  const [showSummary, setShowSummary] = useState(false);
  const [prevQuestions, setPrevQuestions] = useState(questions);
  const emitted = useRef<Set<number>>(new Set());

  // Reset when the question set changes (reset-during-render; compute the values
  // used THIS render so a swap never dereferences a stale, out-of-bounds index).
  let curIndex = index;
  let curResults = results;
  let curSummary = showSummary;
  if (questions !== prevQuestions) {
    curResults = seedResults(questions, initialOutcomes);
    curIndex = firstUnanswered(curResults);
    curSummary = false;
    setPrevQuestions(questions);
    setIndex(curIndex);
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
    if (curIndex === questions.length - 1) {
      setShowSummary(true);
      onComplete(curResults.flatMap((outcome, i) => (outcome ? [{ index: i, outcome }] : [])));
    } else {
      setIndex((i) => i + 1);
    }
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
          {summaryActions ? <div className="qr-summary__actions">{summaryActions}</div> : null}
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
        {current.difficulty ? <span className="qr-difficulty">{current.difficulty}</span> : null}
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
