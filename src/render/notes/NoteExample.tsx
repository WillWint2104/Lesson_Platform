import { MathText } from "@/shared/MathText";
import type { ExampleStep } from "@/ingest/types";

/**
 * A worked example: white card with a tag, a prompt, the working, and the answer
 * in a green chip. Working is either STEPPED (`steps` — each a TeX line + an
 * optional one-line "why") or the legacy flat `working` lines.
 */
export function NoteExample({
  prompt,
  answer,
  steps,
  working,
}: {
  prompt: string;
  answer: string;
  steps?: ExampleStep[];
  working?: string[];
}) {
  return (
    <div className="note-example">
      <span className="note-example__tag">Worked example</span>
      <p className="note-example__prompt">
        <MathText>{prompt}</MathText>
      </p>
      <div className="note-example__working">
        {steps
          ? steps.map((step, index) => (
              <div key={index} className="note-example__step">
                <div className="note-example__working-line">
                  <MathText>{step.tex}</MathText>
                </div>
                {step.why ? (
                  <p className="note-example__why">
                    <MathText>{step.why}</MathText>
                  </p>
                ) : null}
              </div>
            ))
          : (working ?? []).map((line, index) => (
              <div key={index} className="note-example__working-line">
                <MathText>{line}</MathText>
              </div>
            ))}
      </div>
      <div className="note-example__answer-row">
        <span className="note-example__answer">
          <MathText>{answer}</MathText>
        </span>
      </div>
    </div>
  );
}
