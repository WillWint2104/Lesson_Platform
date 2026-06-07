/**
 * @file ExercisePage.tsx — /:subject/:topic/:topicArea/stage/:n/exercise
 *
 * Worksheet main column + recap rail. Core set rows are fully tappable → the
 * question focus view; each row also has an inline Solution button and an
 * enlarge icon. Completion (all core answered) reveals a green completion row +
 * "Continue to Stage N+1". A collapsed "More practice" expander holds the extra
 * pool (solutions locked until core is complete; extra never affects completion).
 */
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Lightbulb, Lock, Maximize2, ArrowRight, RotateCcw } from "lucide-react";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { ProgressStore } from "@/state/progress";
import type { Question } from "@/ingest/types";
import type { Outcome } from "@/render/questions/types";
import { titleCase } from "@/app/format";
import { computeStageStatus } from "@/app/unlock";
import { allCoreAnswered, areaBasePath, stagePath, stageInputs } from "@/app/stageProgress";
import { StageStepper } from "@/app/StageStepper";
import { MathText } from "@/shared/MathText";
import { FigureSlot } from "@/render/figures/FigureSlot";
import { StatusCircle } from "@/shared/StatusCircle";
import { MultipleChoice } from "@/render/questions/MultipleChoice";
import { SolutionModal } from "@/render/questions/SolutionModal";
import { FocusView } from "@/render/questions/FocusView";
import { NotFound } from "@/app/screens/NotFound";

function useStoreTick(store: ProgressStore): void {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
}

type Pool = "core" | "extra";
interface FocusTarget {
  pool: Pool;
  index: number;
}
interface SolutionTarget {
  pool: Pool;
  index: number;
}
const DISPLAY_FORMULA = /^\s*\$\$[\s\S]*\$\$\s*$/;

export function ExercisePage() {
  const { subject, topic, topicArea, n } = useParams();
  const registry = useRegistry();
  const store = useProgressStore();
  const areaId = `${subject}/${topic}/${topicArea}`;
  const area = registry.getAreaById(areaId);
  const stageNum = Number(n);
  const stageIndex = stageNum - 1;
  const ok =
    !!area && area.valid && Number.isInteger(stageNum) && stageNum >= 1 && stageNum <= area.stages.length;

  useStoreTick(store);

  const [expanded, setExpanded] = useState(false);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [solution, setSolution] = useState<SolutionTarget | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ok && area) store.setLastVisited(area.id, stageIndex, "exercise");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, area, store, stageIndex]);

  if (!ok || !area) {
    return <NotFound message="That stage doesn’t exist." />;
  }

  const stage = area.stages[stageIndex]!;
  const core = stage.exercise.questions;
  const extra = stage.exercise.extra;
  const rec = store.getStageProgress(areaId, stageIndex);
  const coreOutcomes = rec?.core ?? {};
  const extraOutcomes = rec?.extra ?? {};
  const coreComplete = allCoreAnswered(coreOutcomes, core.length);
  const correctCount = core.filter((_q, i) => coreOutcomes[i] === "correct").length;
  const anyIncorrect = core.some((_q, i) => coreOutcomes[i] === "incorrect");

  const statuses = computeStageStatus(stageInputs(area, store));
  const steps = area.stages.map((s, i) => ({ title: s.title, status: statuses[i]! }));
  const isLastStage = stageIndex === area.stages.length - 1;
  const ruleFormula = stage.notes.find(
    (b) => b.type === "paragraph" && DISPLAY_FORMULA.test(b.text),
  );

  function recordCore(qIndex: number, outcome: Outcome) {
    const before = allCoreAnswered(store.getStageProgress(areaId, stageIndex)?.core, core.length);
    store.recordOutcome(areaId, stageIndex, "core", qIndex, outcome);
    const after = allCoreAnswered(store.getStageProgress(areaId, stageIndex)?.core, core.length);
    if (after && !before) store.recordAttempt(areaId, stageIndex, true);
  }
  function recordExtra(qIndex: number, outcome: Outcome) {
    store.recordOutcome(areaId, stageIndex, "extra", qIndex, outcome);
  }

  const openFocus = (pool: Pool, index: number, opener?: HTMLElement | null) => {
    openerRef.current = opener ?? null;
    setFocus({ pool, index });
  };
  const openSolution = (pool: Pool, index: number, opener?: HTMLElement | null) => {
    openerRef.current = opener ?? null;
    setSolution({ pool, index });
  };

  const focusQuestions = focus?.pool === "extra" ? extra : core;
  const focusLocked = focus?.pool === "extra" && !coreComplete;
  const solutionQuestion =
    solution !== null ? (solution.pool === "extra" ? extra : core)[solution.index] : undefined;

  return (
    <main className="app-page app-page--area exercise-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link className="breadcrumb__link" to="/">
          {titleCase(area.subject)}
        </Link>{" "}
        / {titleCase(area.topic)} /{" "}
        <Link className="breadcrumb__link" to={stagePath(area, stageNum)}>
          {titleCase(area.topicArea)}
        </Link>
      </nav>
      <header className="area-head">
        <h1 className="sel-title">{area.title}</h1>
      </header>

      <StageStepper steps={steps} activeIndex={stageIndex} hrefFor={(i) => stagePath(area, i + 1)} />

      <div className="ex-grid">
        <div className="ex-grid__main">
          <section className="area-section" aria-label={`Exercise ${stageNum} core set`}>
            <p className="section-label">
              Exercise {stageNum} · Core set
            </p>
            <p className="area-meta">
              {core.length} question{core.length === 1 ? "" : "s"} · work on paper, then check each
            </p>
            <ol className="ws-list">
              {core.map((q, i) => (
                <QuestionRow
                  key={i}
                  q={q}
                  num={`${i + 1}`}
                  outcome={coreOutcomes[i]}
                  onOutcome={(o) => recordCore(i, o)}
                  onSolution={(opener) => openSolution("core", i, opener)}
                  onEnlarge={(opener) => openFocus("core", i, opener)}
                />
              ))}
            </ol>

            {coreComplete ? (
              <div className="ex-complete">
                <p className="ex-complete__text">
                  <StatusCircle variant="check" size="sm" label="Complete" /> {correctCount} of{" "}
                  {core.length} checked — Exercise {stageNum} complete
                </p>
                {isLastStage ? (
                  <Link className="btn btn--ghost" to={areaBasePath(area)}>
                    Back to {titleCase(area.topicArea)}
                  </Link>
                ) : (
                  <Link className="btn btn--primary" to={stagePath(area, stageNum + 1)}>
                    Continue to Stage {stageNum + 1} <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                )}
                {anyIncorrect ? (
                  <p className="ex-nudge">
                    Worth opening the solutions on the ones marked red before moving on.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          {extra.length > 0 ? (
            <section className="area-section" aria-label="More practice">
              <button
                type="button"
                className="ex-expander"
                aria-expanded={expanded}
                onClick={() => setExpanded((e) => !e)}
              >
                More practice · {extra.length} question{extra.length === 1 ? "" : "s"} · optional ·
                same skill, fresh numbers
              </button>
              {expanded ? (
                <ol className="ws-list ws-list--extra">
                  {extra.map((q, i) => (
                    <QuestionRow
                      key={i}
                      q={q}
                      num={`M${i + 1}`}
                      outcome={extraOutcomes[i]}
                      onOutcome={(o) => recordExtra(i, o)}
                      onSolution={(opener) => openSolution("extra", i, opener)}
                      onEnlarge={(opener) => openFocus("extra", i, opener)}
                      solutionLocked={!coreComplete}
                    />
                  ))}
                </ol>
              ) : null}
            </section>
          ) : null}
        </div>

        <aside className="ex-grid__rail" aria-label="Exercise rail">
          <section className="rail-card">
            <p className="section-label">Recap</p>
            {ruleFormula && ruleFormula.type === "paragraph" ? (
              <div className="rule-formula">
                <MathText>{ruleFormula.text}</MathText>
              </div>
            ) : null}
            <Link className="ex-rewatch" to={stagePath(area, stageNum)}>
              <RotateCcw size={16} aria-hidden="true" /> Rewatch Video {stageNum}
            </Link>
          </section>
          <section className="rail-card">
            <p className="section-label">This exercise</p>
            <p className="rail-note">
              {core.length} core question{core.length === 1 ? "" : "s"}. Work on paper, then check
              each solution.
            </p>
          </section>
        </aside>
      </div>

      {focus !== null ? (
        <FocusView
          questions={focusQuestions}
          index={focus.index}
          onIndex={(i) => setFocus({ pool: focus.pool, index: i })}
          onOutcome={(qi, o) => (focus.pool === "extra" ? recordExtra(qi, o) : recordCore(qi, o))}
          solutionsLocked={focusLocked}
          onClose={() => setFocus(null)}
          returnFocusTo={openerRef.current}
        />
      ) : null}

      {solution !== null && solutionQuestion ? (
        <SolutionModal
          questionNumber={solution.index + 1}
          question={solutionQuestion}
          onMark={
            solutionQuestion.type === "multiple-choice"
              ? undefined
              : (o) => {
                  if (solution.pool === "extra") recordExtra(solution.index, o);
                  else recordCore(solution.index, o);
                  setSolution(null);
                }
          }
          onClose={() => setSolution(null)}
          returnFocusTo={openerRef.current}
        />
      ) : null}
    </main>
  );
}

function QuestionRow({
  q,
  num,
  outcome,
  onOutcome,
  onSolution,
  onEnlarge,
  solutionLocked = false,
}: {
  q: Question;
  num: string;
  outcome: Outcome | undefined;
  onOutcome: (outcome: Outcome) => void;
  onSolution: (opener: HTMLElement | null) => void;
  onEnlarge: (opener: HTMLElement | null) => void;
  solutionLocked?: boolean;
}) {
  const isMc = q.type === "multiple-choice";
  const figure = "figure" in q ? q.figure : undefined;
  return (
    <li className="ws-row ws-row--tappable" onClick={(e) => onEnlarge(e.currentTarget)}>
      <span className="ws-row__num" aria-hidden="true">
        {num}
      </span>
      <div className="ws-row__main">
        <div className="ws-row__head">
          <div className="ws-row__prompt">
            <MathText>{q.prompt}</MathText>
          </div>
          <div className="ws-row__tools" onClick={(e) => e.stopPropagation()}>
            {q.difficulty ? <span className="qr-difficulty">{q.difficulty}</span> : null}
            <OutcomeBadge outcome={outcome} />
            <button
              type="button"
              className="ws-row__solve"
              disabled={solutionLocked}
              aria-label={`Show ${isMc ? "explanation" : "solution"} for question ${num}`}
              onClick={(e) => onSolution(e.currentTarget)}
            >
              {solutionLocked ? <Lock size={16} aria-hidden="true" /> : <Lightbulb size={16} aria-hidden="true" />}
              <span className="ws-row__solve-label">{isMc ? "Explain" : "Solution"}</span>
            </button>
            <button
              type="button"
              className="ws-row__enlarge"
              aria-label={`Enlarge question ${num}`}
              onClick={(e) => onEnlarge(e.currentTarget)}
            >
              <Maximize2 size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {figure ? <FigureSlot figure={figure} /> : null}

        {isMc ? (
          <div onClick={(e) => e.stopPropagation()}>
            <MultipleChoice question={q} onOutcome={onOutcome} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function OutcomeBadge({ outcome }: { outcome: Outcome | undefined }) {
  if (!outcome) return null;
  if (outcome === "correct") {
    return <StatusCircle variant="check" size="sm" label="Answered correctly" />;
  }
  return <StatusCircle variant="dot" size="sm" label="Marked for review" />;
}
