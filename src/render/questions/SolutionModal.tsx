/**
 * @file SolutionModal.tsx — accessible worked-solution / explanation modal.
 *
 * Opened from a worksheet row's answer icon. Two modes (derived from the
 * question type):
 *   - "self-mark"   (non-MC): shows the worked solution (answer chip + working
 *     lines, NoteExample treatment) or an honest "no worked solution" state,
 *     plus "I got it" / "Not yet" actions that record an outcome and close.
 *   - "explanation" (MC): shows the options with the correct one highlighted;
 *     no self-mark actions (MC correctness is recorded inline in the row).
 *
 * A11y: role="dialog" + aria-modal, labelled by the question heading. Focus
 * moves into the dialog on open and returns to the opener (the icon button) on
 * close; Escape and a backdrop click close; Tab is trapped within the dialog.
 */
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { MathText } from "@/shared/MathText";
import type { Question } from "@/ingest/types";
import type { Outcome } from "./types";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface SolutionModalProps {
  /** 1-based question number within its exercise (for the heading). */
  questionNumber: number;
  question: Question;
  /** Present in self-mark mode (non-MC). Records the learner's self-mark. */
  onMark?: (outcome: Outcome) => void;
  onClose: () => void;
  /** Element to return focus to on close (the opener icon button). */
  returnFocusTo?: HTMLElement | null;
}

export function SolutionModal({
  questionNumber,
  question,
  onMark,
  onClose,
  returnFocusTo,
}: SolutionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `solution-modal-title-${questionNumber}`;
  const isMc = question.type === "multiple-choice";

  // Move focus into the dialog on open; restore it to the opener on close.
  useEffect(() => {
    const fallback = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialogRef.current)?.focus();
    return () => {
      const restore = returnFocusTo ?? fallback;
      if (restore && typeof restore.focus === "function") restore.focus();
    };
    // returnFocusTo is captured once at open; intentionally not re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="modal-backdrop"
      // Backdrop click (outside the dialog) closes.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="modal__head">
          <h2 className="modal__title" id={titleId}>
            Question {questionNumber} · {isMc ? "Explanation" : "Worked solution"}
          </h2>
          <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="modal__body">
          {isMc ? (
            <McExplanation question={question} />
          ) : (
            <WorkedSolution answer={question.answer} working={question.working} />
          )}
        </div>

        {!isMc && onMark ? (
          <div className="modal__actions">
            <button
              type="button"
              className="qr-button qr-button--correct"
              onClick={() => onMark("correct")}
            >
              I got it
            </button>
            <button
              type="button"
              className="qr-button qr-button--review"
              onClick={() => onMark("incorrect")}
            >
              Not yet
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Worked solution for a non-MC question: answer chip + working, or honest state. */
function WorkedSolution({ answer, working }: { answer?: string; working?: string[] }) {
  if (!answer && (!working || working.length === 0)) {
    return <p className="modal__empty">No worked solution provided.</p>;
  }
  return (
    <div className="qr-reveal">
      {answer ? (
        <span className="qr-reveal__answer">
          <MathText>{answer}</MathText>
        </span>
      ) : null}
      {working && working.length > 0 ? (
        <div className="qr-reveal__working">
          {working.map((line, idx) => (
            <div key={idx} className="qr-reveal__working-line">
              <MathText>{line}</MathText>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Read-only MC options with the correct one highlighted. */
function McExplanation({ question }: { question: Extract<Question, { type: "multiple-choice" }> }) {
  return (
    <div className="qr-mc">
      <ul className="qr-mc__list">
        {question.options.map((option, index) => (
          <li key={index}>
            <div
              className={`qr-mc__option${option.isCorrect ? " qr-mc__option--correct" : ""}`}
              aria-label={option.isCorrect ? "Correct answer" : undefined}
            >
              <MathText>{option.text}</MathText>
            </div>
          </li>
        ))}
      </ul>
      <p className="qr-feedback">The correct answer is highlighted.</p>
    </div>
  );
}
