/**
 * @file ResultBar.tsx — the v2 result indicator (design-language-v2 §7d).
 *
 * A rounded bar (matching the buttons), NOT a circle. Colour lives on the edge
 * + mark only: correct = mint-tint + mint edge + ✓ + "Correct"; incorrect =
 * red-tint + red edge + ✕ + "Incorrect" (exact wording — no "Try again", §8).
 * The student's answer always renders in --ink so it stays readable (§2.5).
 *
 * This primitive only PRESENTS a result; the equivalence check that produces it
 * lands with the exercise page (PR5). The marks go through MathText-free plain
 * text here (the answer string is rendered as-is by the consumer when needed).
 */
import { CheckIcon, CrossIcon } from "./icons";

export type ResultState = "correct" | "incorrect";

export interface ResultBarProps {
  state: ResultState;
  /** The student's submitted answer, shown for reference (rendered in --ink). */
  answer?: string;
  className?: string;
}

const LABEL: Record<ResultState, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
};

export function ResultBar({ state, answer, className }: ResultBarProps) {
  const cls = ["v2-result", `v2-result--${state}`, className].filter(Boolean).join(" ");
  return (
    <div className={cls} role="status">
      <span className="v2-result__mark">
        {state === "correct" ? <CheckIcon size={16} /> : <CrossIcon size={16} />}
      </span>
      <span className="v2-result__label">{LABEL[state]}</span>
      {answer ? <span className="v2-result__answer">{answer}</span> : null}
    </div>
  );
}
