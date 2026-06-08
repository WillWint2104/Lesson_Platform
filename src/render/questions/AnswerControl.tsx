/**
 * @file AnswerControl.tsx — answer entry + check + gated solution (v2 §7b/§8).
 *
 * The learner types their final answer and hits Check; we mark by algebraic
 * equivalence (answerCheck) and report the result through `onRecord`. Once a
 * question has a recorded result the field is replaced by the result bar (§7d)
 * and the Solution button activates — the Solution is LOCKED (grey, lock icon,
 * hint) until then, per question (§8). There is no self-mark and no retake.
 *
 * Presentation-agnostic: `onOpenSolution(opener)` lets the worksheet open a
 * modal and the focus view reveal the solution in place.
 */
import { useState } from "react";
import { Lightbulb, Lock } from "lucide-react";
import type { Question } from "@/ingest/types";
import type { AnswerRecord } from "@/state/progress";
import { ResultBar } from "@/shared/v2";
import { MultipleChoice } from "./MultipleChoice";
import { checkEquivalence } from "./answerCheck";

export interface AnswerControlProps {
  question: Question;
  recorded: AnswerRecord | undefined;
  onRecord: (result: AnswerRecord) => void;
  onOpenSolution: (opener: HTMLElement) => void;
  /** Larger type for the focus view. */
  large?: boolean;
}

function SolutionButton({
  answered,
  isMc,
  onOpenSolution,
}: {
  answered: boolean;
  isMc: boolean;
  onOpenSolution: (opener: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      className="v2-btn v2-btn--ghost ans__solution"
      disabled={!answered}
      onClick={(e) => onOpenSolution(e.currentTarget)}
    >
      {answered ? <Lightbulb size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
      {isMc ? "Explanation" : answered ? "Solution" : "Solution locked"}
    </button>
  );
}

export function AnswerControl({ question, recorded, onRecord, onOpenSolution, large }: AnswerControlProps) {
  const isMc = question.type === "multiple-choice";
  const canonical = "answer" in question ? question.answer : undefined;
  const [draft, setDraft] = useState("");
  const trimmed = draft.trim();

  const cls = `ans${large ? " ans--large" : ""}`;

  // Multiple-choice (no authored content uses it; supported for future) — select
  // an option to record; correctness comes from the option.
  if (isMc) {
    return (
      <div className={cls}>
        {recorded ? (
          <ResultBar state={recorded.correct ? "correct" : "incorrect"} answer={recorded.answer} />
        ) : (
          <MultipleChoice
            question={question}
            onOutcome={(o) => onRecord({ answer: o, correct: o === "correct" })}
          />
        )}
        <SolutionButton answered={!!recorded} isMc onOpenSolution={onOpenSolution} />
      </div>
    );
  }

  // Answered: the result IS the mark (§8) — show it, no re-check, no retake.
  if (recorded) {
    return (
      <div className={cls}>
        <ResultBar state={recorded.correct ? "correct" : "incorrect"} answer={recorded.answer} />
        <SolutionButton answered isMc={false} onOpenSolution={onOpenSolution} />
      </div>
    );
  }

  const submit = () => {
    if (!trimmed || canonical === undefined) return;
    onRecord({ answer: trimmed, correct: checkEquivalence(trimmed, canonical) });
  };

  return (
    <div className={cls}>
      <div className="ans__row">
        <input
          className="ans__field"
          type="text"
          autoComplete="off"
          placeholder="Your answer…"
          aria-label="Your answer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button
          type="button"
          className="v2-btn v2-btn--primary ans__check"
          disabled={!trimmed}
          onClick={submit}
        >
          Check
        </button>
      </div>
      <SolutionButton answered={false} isMc={false} onOpenSolution={onOpenSolution} />
      <p className="ans__hint">Enter your answer to unlock the solution.</p>
    </div>
  );
}
