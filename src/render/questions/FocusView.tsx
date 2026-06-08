/**
 * @file FocusView.tsx — enlarge a question IN PLACE.
 *
 * A centered enlarged question card over a dimmed + blurred backdrop (not a
 * full-surface page/route). role=dialog + aria-modal, labelled "Question N of M".
 * rem-scaled type (browser zoom compounds), scaled figure, difficulty badge,
 * self-mark (✓ Got it / ✕ Not yet) that records directly, an optional
 * Show-solution, and prev/next. Keyboard: ← → navigate, G = got it, N = not yet,
 * S = solution, Esc = close. Focus moves in on open and returns to the opener on
 * close. Works for core AND extra (extra solutions are NOT locked).
 */
import { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, ArrowRight, Lightbulb, Check } from "lucide-react";
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
  outcomes: Record<number, Outcome>;
  onOutcome: (questionIndex: number, outcome: Outcome) => void;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

export function FocusView({
  questions,
  index,
  onIndex,
  outcomes,
  onOutcome,
  onClose,
  returnFocusTo,
}: FocusViewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const solveBtnRef = useRef<HTMLButtonElement>(null);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const q = questions[index];
  const total = questions.length;
  const isMc = q?.type === "multiple-choice";

  useEffect(() => {
    const restore = returnFocusTo ?? (document.activeElement as HTMLElement | null);
    cardRef.current?.focus();
    return () => {
      if (restore && typeof restore.focus === "function") restore.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setSolutionOpen(false), [index]);

  if (!q) return null;

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (solutionOpen) return; // the SolutionModal handles its own keys
    switch (e.key) {
      case "Escape":
        onClose();
        break;
      case "ArrowRight":
        if (index < total - 1) onIndex(index + 1);
        break;
      case "ArrowLeft":
        if (index > 0) onIndex(index - 1);
        break;
      case "s":
      case "S":
        setSolutionOpen(true);
        break;
      case "g":
      case "G":
        onOutcome(index, "correct");
        break;
      case "n":
      case "N":
        onOutcome(index, "incorrect");
        break;
      default:
        break;
    }
  }

  const figure = "figure" in q ? q.figure : undefined;
  const outcome = outcomes[index];

  return (
    <div
      className="focus-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="focus-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Question ${index + 1} of ${total}`}
        tabIndex={-1}
        ref={cardRef}
        onKeyDown={onKeyDown}
      >
        <div className="focus-card__bar">
          <span className="focus-card__count">
            Question {index + 1} of {total}
          </span>
          <button type="button" className="focus-card__close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" /> Close
          </button>
        </div>

        <div className="focus-card__body">
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
            <MultipleChoice key={`focus-mc-${index}`} question={q} onOutcome={(o) => onOutcome(index, o)} />
          ) : (
            <SelfMark outcome={outcome} onOutcome={(o) => onOutcome(index, o)} />
          )}

          <button
            type="button"
            className="focus-q__solve btn btn--quiet"
            ref={solveBtnRef}
            onClick={() => setSolutionOpen(true)}
          >
            <Lightbulb size={18} aria-hidden="true" /> {isMc ? "Show explanation" : "Show solution"}
          </button>
        </div>

        <div className="focus-card__nav">
          <button
            type="button"
            className="btn btn--quiet"
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
          >
            <ArrowLeft size={18} aria-hidden="true" /> Previous
          </button>
          <button
            type="button"
            className="btn btn--quiet"
            disabled={index === total - 1}
            onClick={() => onIndex(index + 1)}
          >
            Next <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
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

/** Self-mark controls — record an outcome directly (no solution required). */
export function SelfMark({
  outcome,
  onOutcome,
}: {
  outcome: Outcome | undefined;
  onOutcome: (outcome: Outcome) => void;
}) {
  return (
    <div className="selfmark" role="group" aria-label="Self-mark">
      <button
        type="button"
        className={`selfmark__btn selfmark__btn--got${outcome === "correct" ? " selfmark__btn--on" : ""}`}
        aria-pressed={outcome === "correct"}
        onClick={() => onOutcome("correct")}
      >
        <Check size={16} aria-hidden="true" /> Got it
      </button>
      <button
        type="button"
        className={`selfmark__btn selfmark__btn--not${outcome === "incorrect" ? " selfmark__btn--on" : ""}`}
        aria-pressed={outcome === "incorrect"}
        onClick={() => onOutcome("incorrect")}
      >
        <X size={16} aria-hidden="true" /> Not yet
      </button>
    </div>
  );
}
