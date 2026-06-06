/**
 * @file Worksheet.tsx — an exercise rendered as a numbered question list.
 *
 * Each row shows: the question number, the prompt (MathText), an optional
 * figure, an optional difficulty badge, an answered-state indicator (restored
 * from the progress store), and an answer-icon button on the right.
 *   - Multiple-choice questions are answered INLINE (tap an option); the answer
 *     icon opens an explanation-only modal (correct option highlighted).
 *   - Non-MC questions are answered via the modal's self-mark actions.
 *
 * The Worksheet holds no persistence: it reports outcomes through `onOutcome`
 * and reflects the `outcomes` it is given (the AreaPage owns the store wiring).
 */
import { useRef, useState } from "react";
import { MathText } from "@/shared/MathText";
import { FigureSlot } from "@/render/figures/FigureSlot";
import type { Question } from "@/ingest/types";
import type { Outcome } from "./types";
import { MultipleChoice } from "./MultipleChoice";
import { SolutionModal } from "./SolutionModal";

export interface WorksheetProps {
  questions: Question[];
  /** Recorded outcomes by question index (drives the per-row indicator). */
  outcomes: Record<number, Outcome>;
  onOutcome: (questionIndex: number, outcome: Outcome) => void;
}

export function Worksheet({ questions, outcomes, onOutcome }: WorksheetProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <ol className="ws-list">
        {questions.map((q, i) => {
          const isMc = q.type === "multiple-choice";
          const figure = "figure" in q ? q.figure : undefined;
          const outcome = outcomes[i];
          return (
            <li key={i} className="ws-row">
              <span className="ws-row__num" aria-hidden="true">
                {i + 1}
              </span>
              <div className="ws-row__main">
                <div className="ws-row__head">
                  <div className="ws-row__prompt">
                    <MathText>{q.prompt}</MathText>
                  </div>
                  <div className="ws-row__tools">
                    {q.difficulty ? (
                      <span className="qr-difficulty">{q.difficulty}</span>
                    ) : null}
                    <OutcomeBadge outcome={outcome} />
                    <button
                      type="button"
                      className="ws-row__solve"
                      aria-label={`Show ${isMc ? "explanation" : "solution"} for question ${i + 1}`}
                      onClick={(e) => {
                        openerRef.current = e.currentTarget;
                        setOpenIndex(i);
                      }}
                    >
                      <span aria-hidden="true">💡</span>
                      <span className="ws-row__solve-label">{isMc ? "Explain" : "Solution"}</span>
                    </button>
                  </div>
                </div>

                {figure ? <FigureSlot figure={figure} /> : null}

                {isMc ? (
                  <MultipleChoice
                    key={`mc-${i}`}
                    question={q}
                    onOutcome={(o) => onOutcome(i, o)}
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {openIndex !== null ? (
        <SolutionModal
          questionNumber={openIndex + 1}
          question={questions[openIndex]!}
          onMark={
            questions[openIndex]!.type === "multiple-choice"
              ? undefined
              : (o) => {
                  onOutcome(openIndex, o);
                  setOpenIndex(null);
                }
          }
          onClose={() => setOpenIndex(null)}
          returnFocusTo={openerRef.current}
        />
      ) : null}
    </>
  );
}

function OutcomeBadge({ outcome }: { outcome: Outcome | undefined }) {
  if (!outcome) return null;
  if (outcome === "correct") {
    return (
      <span className="ws-row__status ws-row__status--correct" aria-label="Answered correctly">
        ✓
      </span>
    );
  }
  return (
    <span className="ws-row__status ws-row__status--incorrect" aria-label="Marked for review">
      ●
    </span>
  );
}
