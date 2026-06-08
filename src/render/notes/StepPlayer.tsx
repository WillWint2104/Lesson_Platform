/**
 * @file StepPlayer.tsx — worked-example tabs + all-steps display (stage notes).
 *
 * "Example 1 / Example 2…" chunky tabs switch examples. Within the active
 * example ALL steps are shown at once (no step-by-step reveal): each stepped
 * line keeps its optional "why?" toggle (cyan chip), and the answer chip renders
 * LAST. Legacy `working` examples render the same way. All math (incl. \emA/\emB
 * emphasis) flows through MathText. `steps[].tex` is raw KaTeX by contract and is
 * wrapped in `$…$`; legacy `working` lines are authored with delimiters already.
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
      <Example data={examples[current]!} />
    </div>
  );
}

function Example({ data }: { data: ExampleData }) {
  const steps = data.steps ?? null;
  return (
    <div className="example">
      <p className="example__prompt">
        <MathText>{data.prompt}</MathText>
      </p>
      <div className="example__steps">
        {steps
          ? steps.map((step, i) => <Step key={i} step={step} />)
          : (data.working ?? []).map((line, i) => (
              <div key={i} className="example__step example__step--revealed">
                <div className="example__step-tex">
                  <MathText>{line}</MathText>
                </div>
              </div>
            ))}
      </div>
      {/* Answer chip LAST — never above the reasoning. */}
      <span className="example__answer">
        <MathText>{data.answer}</MathText>
      </span>
    </div>
  );
}

function Step({ step }: { step: ExampleStep }) {
  const [showWhy, setShowWhy] = useState(false);
  return (
    <div className="example__step example__step--revealed">
      {/* `tex` is raw KaTeX by contract — wrap so MathText typesets it. */}
      <div className="example__step-tex">
        <MathText>{`$${step.tex}$`}</MathText>
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
