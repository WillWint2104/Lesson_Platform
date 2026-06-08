/**
 * @file FocusView.tsx — full-surface single-question takeover.
 *
 * role=dialog/aria-modal labelled "Question N of M". Top bar = count + Close
 * (Esc). Centered enlarged question (rem type so browser zoom compounds), figure
 * scaled up, difficulty badge, a big Show-solution action (opens the existing
 * SolutionModal anatomy inside the view), prev/next at the bottom corners.
 * Keyboard: ← → navigate, S = solution, Esc = close. Works across core AND extra
 * (solution lock applies). Focus moves in on open and returns to the originating
 * row on close. Answer recording uses the same `onOutcome` path as the worksheet.
 */
import { useEffect, useRef, useState } from "react";
import { X, Lock, ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import { MathText } from "@/shared/MathText";
import { FigureSlot } from "@/render/figures/FigureSlot";
import type { Question } from "@/ingest/types";
import type { Outcome } from "./types";
import { MultipleChoice } from "./MultipleChoice";
import { SolutionModal } from "./SolutionModal";

export interface FocusViewProps {
  questions: Question[];
  index: number;
  onIndex: (i: number) => void;
  onOutcome: (questionIndex: number, outcome: Outcome) => void;
  /** Extra-pool solutions are locked until the core set is complete. */
  solutionsLocked?: boolean;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

export function FocusView({
  questions,
  index,
  onIndex,
  onOutcome,
  solutionsLocked = false,
  onClose,
  returnFocusTo,
}: FocusViewProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const solveBtnRef = useRef<HTMLButtonElement>(null);
  const q = questions[index];
  const total = questions.length;
  const isMc = q?.type === "multiple-choice";

  useEffect(() => {
    const restore = returnFocusTo ?? (document.activeElement as HTMLElement | null);
    dialogRef.current?.focus();
    return () => {
      if (restore && typeof restore.focus === "function") restore.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switching question closes any open solution modal.
  useEffect(() => setSolutionOpen(false), [index]);

  if (!q) return null;

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (solutionOpen) return; // the SolutionModal handles its own keys
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowRight") {
      if (index < total - 1) onIndex(index + 1);
    } else if (e.key === "ArrowLeft") {
      if (index > 0) onIndex(index - 1);
    } else if (e.key === "s" || e.key === "S") {
      if (!solutionsLocked) setSolutionOpen(true);
    }
  }

  const figure = "figure" in q ? q.figure : undefined;

  return (
    <div
      className="focus-view"
      role="dialog"
      aria-modal="true"
      aria-label={`Question ${index + 1} of ${total}`}
      tabIndex={-1}
      ref={dialogRef}
      onKeyDown={onKeyDown}
    >
      <div className="focus-view__bar">
        <span className="focus-view__count">
          Question {index + 1} of {total}
        </span>
        <button type="button" className="focus-view__close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" /> Close
        </button>
      </div>

      <div className="focus-view__body">
        <div className="focus-q">
          {q.difficulty ? <span className="qr-difficulty">{q.difficulty}</span> : null}
          <p className="focus-q__prompt">
            <MathText>{q.prompt}</MathText>
          </p>
          {figure ? (
            <div className="focus-q__figure">
              <FigureSlot figure={figure} />
            </div>
          ) : null}
          {isMc ? (
            <MultipleChoice
              key={`focus-mc-${index}`}
              question={q}
              onOutcome={(o) => onOutcome(index, o)}
            />
          ) : null}

          <button
            type="button"
            className="focus-q__solve btn btn--primary"
            ref={solveBtnRef}
            disabled={solutionsLocked}
            onClick={() => setSolutionOpen(true)}
          >
            {solutionsLocked ? (
              <>
                <Lock size={18} aria-hidden="true" /> Solution locked
              </>
            ) : (
              <>
                <Lightbulb size={18} aria-hidden="true" /> {isMc ? "Show explanation" : "Show solution"}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="focus-view__nav">
        <button
          type="button"
          className="focus-view__prev btn btn--quiet"
          disabled={index === 0}
          onClick={() => onIndex(index - 1)}
        >
          <ArrowLeft size={18} aria-hidden="true" /> Previous
        </button>
        <button
          type="button"
          className="focus-view__next btn btn--quiet"
          disabled={index === total - 1}
          onClick={() => onIndex(index + 1)}
        >
          Next <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>

      {solutionOpen ? (
        <SolutionModal
          questionNumber={index + 1}
          question={q}
          onMark={
            isMc
              ? undefined
              : (o) => {
                  onOutcome(index, o);
                  setSolutionOpen(false);
                }
          }
          onClose={() => setSolutionOpen(false)}
          returnFocusTo={solveBtnRef.current}
        />
      ) : null}
    </div>
  );
}
