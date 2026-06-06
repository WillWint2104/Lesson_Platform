import { useState } from "react";
import { MathText } from "@/shared/MathText";
import type { MultipleChoiceQuestion } from "@/ingest/types";
import type { OutcomeHandler } from "./types";

/**
 * Multiple-choice: option cards. On first selection the set locks and marks
 * immediately — a correct pick gets the green-tint treatment + a positive line;
 * a wrong pick gets coral AND the correct option is highlighted green.
 */
export function MultipleChoice({
  question,
  onOutcome,
}: {
  question: MultipleChoiceQuestion;
  onOutcome: OutcomeHandler;
}) {
  const [chosen, setChosen] = useState<number | null>(null);
  const locked = chosen !== null;

  const select = (index: number) => {
    if (locked) return;
    setChosen(index);
    onOutcome(question.options[index]?.isCorrect ? "correct" : "incorrect");
  };

  const chosenCorrect = chosen !== null && question.options[chosen]?.isCorrect === true;

  return (
    <div className="qr-mc">
      <ul className="qr-mc__list">
        {question.options.map((option, index) => {
          let cls = "qr-mc__option";
          if (locked) {
            if (option.isCorrect) cls += " qr-mc__option--correct";
            else if (index === chosen) cls += " qr-mc__option--wrong";
          }
          return (
            <li key={index}>
              <button
                type="button"
                className={cls}
                disabled={locked}
                aria-pressed={index === chosen}
                onClick={() => select(index)}
              >
                <MathText>{option.text}</MathText>
              </button>
            </li>
          );
        })}
      </ul>

      {locked ? (
        <p className="qr-feedback">
          {chosenCorrect
            ? "Correct — nice work."
            : "Not quite — the correct answer is highlighted."}
        </p>
      ) : null}
    </div>
  );
}
