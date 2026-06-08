/**
 * @file FocusView.tsx — enlarge a question IN PLACE (design-language-v2 §7c).
 *
 * A centred card over a dimmed + blurred scrim (role=dialog, aria-modal), with
 * prev/next at the foot. Three states per question:
 *   1. Unanswered — question box + answer field + Check + LOCKED solution.
 *   2. Answered   — result bar + active Solution button.
 *   3. Solution   — working first, answer last (shown in place).
 * Solution gating is PER QUESTION (a property of that question's stored result),
 * so it stays locked when you arrive via prev/next on an unanswered question —
 * never auto-opening. Keyboard: ← → navigate, S = solution (only once answered);
 * Esc = close (always, even while typing). The ← → / S shortcuts are SUPPRESSED
 * while typing in the answer field so the field stays usable. Focus is trapped
 * within the dialog (Tab cycles) and returns to the opener on close.
 */
import { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, ArrowRight } from "lucide-react";
import { MathText } from "@/shared/MathText";
import { FigureSlot } from "@/render/figures/FigureSlot";
import type { Question } from "@/ingest/types";
import type { AnswerRecord } from "@/state/progress";
import { AnswerControl } from "./AnswerControl";
import { WorkedSolution } from "./WorkedSolution";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export interface FocusViewProps {
  questions: Question[];
  index: number;
  onIndex: (i: number) => void;
  results: Record<number, AnswerRecord>;
  onRecord: (questionIndex: number, result: AnswerRecord) => void;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

export function FocusView({
  questions,
  index,
  onIndex,
  results,
  onRecord,
  onClose,
  returnFocusTo,
}: FocusViewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const q = questions[index];
  const total = questions.length;

  useEffect(() => {
    const restore = returnFocusTo ?? (document.activeElement as HTMLElement | null);
    cardRef.current?.focus();
    return () => {
      if (restore && typeof restore.focus === "function") restore.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changing question resets the in-place solution reveal (per-question gating).
  useEffect(() => setSolutionOpen(false), [index]);

  if (!q) return null;

  const recorded = results[index];
  const answered = !!recorded;
  const isMc = q.type === "multiple-choice";

  function trapTab(e: React.KeyboardEvent<HTMLDivElement>) {
    const focusables = Array.from(cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (el) => !el.hasAttribute("disabled"),
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === cardRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "Tab") {
      trapTab(e); // contain focus within the dialog
      return;
    }
    // Don't hijack arrows / S while typing in the answer field — let the input
    // move its caret and accept characters normally.
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }
    switch (e.key) {
      case "ArrowRight":
        if (index < total - 1) onIndex(index + 1);
        break;
      case "ArrowLeft":
        if (index > 0) onIndex(index - 1);
        break;
      case "s":
      case "S":
        if (answered) setSolutionOpen(true); // gated: never opens while unanswered
        break;
      default:
        break;
    }
  }

  const figure = "figure" in q ? q.figure : undefined;

  return (
    <div
      className="focus-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="focus-card v2-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Question ${index + 1} of ${total}`}
        tabIndex={-1}
        ref={cardRef}
        onKeyDown={onKeyDown}
      >
        <div className="v2-panel__strip" aria-hidden="true" />
        <div className="focus-card__bar">
          <span className="focus-card__count v2-mono">
            Question {index + 1} of {total}
          </span>
          <button type="button" className="focus-card__close" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" /> Close
          </button>
        </div>

        <div className="focus-card__body">
          <div className="qcard__box focus-q__box">
            <p className="focus-q__prompt">
              <MathText>{q.prompt}</MathText>
            </p>
            {figure ? (
              <div className="focus-q__figure">
                <FigureSlot figure={figure} />
              </div>
            ) : null}
          </div>

          <AnswerControl
            question={q}
            recorded={recorded}
            onRecord={(r) => onRecord(index, r)}
            onOpenSolution={() => setSolutionOpen(true)}
            large
          />

          {solutionOpen && answered ? (
            <div className="focus-q__solution">
              <p className="v2-mono focus-q__solution-label">
                {isMc ? "Explanation" : "Worked solution"}
              </p>
              <WorkedSolution
                answer={"answer" in q ? q.answer : undefined}
                working={"working" in q ? q.working : undefined}
              />
            </div>
          ) : null}
        </div>

        <div className="focus-card__nav">
          <button
            type="button"
            className="v2-btn v2-btn--ghost"
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
          >
            <ArrowLeft size={18} aria-hidden="true" /> Previous
          </button>
          <button
            type="button"
            className="v2-btn v2-btn--ghost"
            disabled={index === total - 1}
            onClick={() => onIndex(index + 1)}
          >
            Next <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
