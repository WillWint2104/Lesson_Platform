/**
 * @file StageStepper.tsx — shared stage strip (stage + exercise pages).
 *
 * Every stage as a StatusCircle (done / current / upcoming) + title, connected
 * by lines (green once done). ALL steps are clickable, both directions — nothing
 * locks (free navigation, design-language §8 / Mayer segmenting).
 */
import { Link } from "react-router-dom";
import { StatusCircle } from "@/shared/StatusCircle";
import type { StageStatus } from "@/app/unlock";

export interface StageStepperStep {
  title: string;
  status: StageStatus;
}

export interface StageStepperProps {
  steps: StageStepperStep[];
  activeIndex: number;
  hrefFor: (stageIndex: number) => string;
}

export function StageStepper({ steps, activeIndex, hrefFor }: StageStepperProps) {
  return (
    <nav className="stepper" aria-label="Stages">
      <ol className="stepper__list">
        {steps.map((s, i) => {
          const variant = s.status === "done" ? "check" : s.status === "current" ? "play-ring" : "number";
          const classes = [
            "stepper__item",
            s.status === "done" ? "stepper__item--done" : "",
            i === activeIndex ? "stepper__item--active" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={i} className={classes}>
              <Link
                className="stepper__link"
                to={hrefFor(i)}
                aria-current={i === activeIndex ? "step" : undefined}
              >
                <StatusCircle variant={variant} size="sm" value={i + 1} label={`Stage ${i + 1}`} />
                <span className="stepper__title">{s.title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
