/**
 * @file StepPlayer.tsx — worked-example tabs + step player (stage notes).
 *
 * "Example 1 / Example 2…" chunky tabs switch examples. Within the active
 * example, stepped working is revealed one step at a time via "Next step →"
 * (progress dots): revealed steps get a green-soft border, the current step adds
 * a faint bg, future steps are ghosted placeholders; each revealed step has a
 * "why?" toggle (cyan chip) when why text exists; the answer chip appears after
 * the final step. Legacy `working` examples render fully revealed in the same
 * anatomy. All math (incl. \emA/\emB emphasis) flows through MathText.
 */
import { useState } from "react";
import { MathText } from "@/shared/MathText";
import type { ExampleStep } from "@/ingest/types";

export interface ExampleData {
  prompt: string;
  answer: string;
  steps?: ExampleStep[];
  working?: string[];
}

export function StepPlayer({ examples }: { examples: ExampleData[] }) {
  const [active, setActive] = useState(0);
  if (examples.length === 0) return null;
  const current = Math.min(active, examples.length - 1);
  return (
    <div className="step-player">
      {examples.length > 1 ? (
        <div className="step-tabs" role="tablist" aria-label="Worked examples">
          {examples.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === current}
              className={`step-tab${i === current ? " step-tab--active" : ""}`}
              onClick={() => setActive(i)}
            >
              Example {i + 1}
            </button>
          ))}
        </div>
      ) : null}
      {/* key remounts the example → resets the reveal state when switching tabs */}
      <Example key={current} data={examples[current]!} />
    </div>
  );
}

function Example({ data }: { data: ExampleData }) {
  const steps = data.steps ?? null;
  const total = steps?.length ?? 0;
  const [revealed, setRevealed] = useState(1);

  return (
    <div className="example">
      <p className="example__prompt">
        <MathText>{data.prompt}</MathText>
      </p>

      {steps ? (
        <>
          <div className="example__dots" aria-hidden="true">
            {steps.map((_, i) => (
              <span key={i} className={`example__dot${i < revealed ? " example__dot--on" : ""}`} />
            ))}
          </div>
          <div className="example__steps">
            {steps.map((step, i) =>
              i < revealed ? (
                <Step key={i} step={step} current={i === revealed - 1} />
              ) : (
                <div key={i} className="example__step example__step--ghost" aria-hidden="true" />
              ),
            )}
          </div>
          {revealed >= total ? (
            <span className="example__answer">
              <MathText>{data.answer}</MathText>
            </span>
          ) : (
            <button
              type="button"
              className="btn btn--primary example__next"
              onClick={() => setRevealed((r) => Math.min(total, r + 1))}
            >
              Next step →
            </button>
          )}
        </>
      ) : (
        <>
          <div className="example__steps">
            {(data.working ?? []).map((line, i) => (
              <div key={i} className="example__step example__step--revealed">
                <div className="example__step-tex">
                  <MathText>{line}</MathText>
                </div>
              </div>
            ))}
          </div>
          <span className="example__answer">
            <MathText>{data.answer}</MathText>
          </span>
        </>
      )}
    </div>
  );
}

function Step({ step, current }: { step: ExampleStep; current: boolean }) {
  const [showWhy, setShowWhy] = useState(false);
  return (
    <div className={`example__step example__step--revealed${current ? " example__step--current" : ""}`}>
      <div className="example__step-tex">
        <MathText>{step.tex}</MathText>
      </div>
      {step.why ? (
        <>
          <button
            type="button"
            className="example__why-toggle"
            aria-expanded={showWhy}
            onClick={() => setShowWhy((s) => !s)}
          >
            why?
          </button>
          {showWhy ? (
            <p className="example__why">
              <MathText>{step.why}</MathText>
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
