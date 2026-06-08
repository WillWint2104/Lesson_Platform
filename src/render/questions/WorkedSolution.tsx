/**
 * @file WorkedSolution.tsx — a question's worked solution (working → answer).
 *
 * design-language-v2 §7c: working FIRST, the explicit ANSWER LAST (so the reveal
 * never spoils the reasoning). Shared by the worksheet's SolutionModal and the
 * focus view's in-place solution state. Renders the honest "no worked solution"
 * state when neither working nor answer is authored. All math via MathText.
 */
import { MathText } from "@/shared/MathText";

export function WorkedSolution({ answer, working }: { answer?: string; working?: string[] }) {
  if (!answer && (!working || working.length === 0)) {
    return <p className="modal__empty">No worked solution provided.</p>;
  }
  return (
    <div className="qr-reveal">
      {working && working.length > 0 ? (
        <ol className="qr-reveal__working">
          {working.map((line, idx) => (
            <li key={idx} className="qr-reveal__working-line">
              <MathText>{line}</MathText>
            </li>
          ))}
        </ol>
      ) : null}
      {answer ? (
        <div className="qr-reveal__answer-row">
          <span className="qr-reveal__answer-label v2-mono">Answer</span>
          <span className="qr-reveal__answer">
            <MathText>{answer}</MathText>
          </span>
        </div>
      ) : null}
    </div>
  );
}
