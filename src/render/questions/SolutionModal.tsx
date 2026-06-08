/**
 * @file SolutionModal.tsx — accessible worked-solution / explanation modal.
 *
 * Opened from a worksheet card's Solution button (only AFTER the question has
 * been answered — gating lives at the call site, design-language-v2 §8). A
 * display-only dialog: the worked solution (working → answer, via the shared
 * WorkedSolution) for non-MC, or the highlighted options for MC. There is NO
 * self-mark — the equivalence check is the mark.
 *
 * A11y: role="dialog" + aria-modal, labelled by the question heading. Focus
 * moves into the dialog on open and returns to the opener on close; Escape and a
 * backdrop click close; Tab is trapped within the dialog.
 */
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { MathText } from "@/shared/MathText";
import type { Question } from "@/ingest/types";
import { WorkedSolution } from "./WorkedSolution";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface SolutionModalProps {
  /** 1-based question number within its exercise (for the heading). */
  questionNumber: number;
  question: Question;
  onClose: () => void;
  /** Element to return focus to on close (the opener button). */
  returnFocusTo?: HTMLElement | null;
}

export function SolutionModal({
  questionNumber,
  question,
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
            <WorkedSolution
              answer={"answer" in question ? question.answer : undefined}
              working={"working" in question ? question.working : undefined}
            />
          )}
        </div>
      </div>
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
