/**
 * @file FocusView.tsx — enlarge a question IN PLACE (design-language-v2 §7c +
 * §13 readability addendum).
 *
 * Content for the shared EnlargedDialog (scrim, mint strip, header, centered
 * column, footer Prev/Next, focus trap — owned there). Three states per
 * question:
 *   1. Unanswered — question box + answer field + Check + LOCKED solution.
 *   2. Answered   — result bar + active Solution button.
 *   3. Solution   — working first, answer last (shown in place).
 * Solution gating is PER QUESTION (a property of that question's stored result),
 * so it stays locked when you arrive via Prev/Next on an unanswered question —
 * never auto-opening. Keyboard: ← → navigate, S = solution (only once answered);
 * Esc = close. Readability: the expression renders ~2x worksheet size
 * (\displaystyle + rem-scaled type so browser zoom compounds).
 */
import { useEffect, useState } from "react";
import { MathText } from "@/shared/MathText";
import { FigureSlot } from "@/render/figures/FigureSlot";
import type { Question } from "@/ingest/types";
import type { AnswerRecord } from "@/state/progress";
import { EnlargedDialog } from "@/shared/v2";
import { AnswerControl } from "./AnswerControl";
import { WorkedSolution } from "./WorkedSolution";

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
  const [solutionOpen, setSolutionOpen] = useState(false);
  const q = questions[index];
  const total = questions.length;

  // Changing question resets the in-place solution reveal (per-question gating).
  useEffect(() => setSolutionOpen(false), [index]);

  if (!q) return null;

  const recorded = results[index];
  const answered = !!recorded;
  const isMc = q.type === "multiple-choice";
  const figure = "figure" in q ? q.figure : undefined;

  return (
    <EnlargedDialog
      label={`Question ${index + 1} of ${total}`}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      onPrev={index > 0 ? () => onIndex(index - 1) : undefined}
      onNext={index < total - 1 ? () => onIndex(index + 1) : undefined}
      onShortcut={(key) => {
        // Gated: the solution shortcut never opens while unanswered (§8).
        if (key === "s" && answered) setSolutionOpen(true);
      }}
    >
      <div className="qcard__box focus-q__box">
        <p className="focus-q__prompt">
          <MathText displayStyle>{q.prompt}</MathText>
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
            enlarged
          />
        </div>
      ) : null}
    </EnlargedDialog>
  );
}
