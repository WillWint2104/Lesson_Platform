/**
 * @file ExercisePage.tsx — /:subject/:topic/:topicArea/stage/:n/exercise (v2 §7b/§8)
 *
 * One worksheet panel (mint strip) on the grid canvas — no extra bars (the shell
 * bar + contents sidebar carry the chrome/nav). The panel header holds the title
 * + question count + instruction; below it a grid of question cards (number badge
 * + expand, mint-outlined question box, an answer field that the learner Checks
 * by algebraic equivalence, and a Solution button LOCKED until that question is
 * answered). Completion = every core question answered (correct or not, §8);
 * wrong answers never gate. The "More practice" expander holds the optional extra
 * pool (answerable + solvable, never affecting completion). Difficulty is a hidden
 * authored tag — never rendered here (§8).
 */
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Maximize2 } from "lucide-react";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { ProgressStore, AnswerRecord } from "@/state/progress";
import type { Question } from "@/ingest/types";
import { titleCase } from "@/app/format";
import { allCoreAnswered, areaBasePath, stagePath } from "@/app/stageProgress";
import { Panel } from "@/shared/v2";
import { MathText } from "@/shared/MathText";
import { FigureSlot } from "@/render/figures/FigureSlot";
import { StatusCircle } from "@/shared/StatusCircle";
import { AnswerControl } from "@/render/questions/AnswerControl";
import { SolutionModal } from "@/render/questions/SolutionModal";
import { FocusView } from "@/render/questions/FocusView";
import { NotFound } from "@/app/screens/NotFound";

function useStoreTick(store: ProgressStore): void {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
}

type Pool = "core" | "extra";
interface Target {
  pool: Pool;
  index: number;
}

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
  const [focus, setFocus] = useState<Target | null>(null);
  const [solution, setSolution] = useState<Target | null>(null);
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
  const coreResults = rec?.core ?? {};
  const extraResults = rec?.extra ?? {};
  const coreComplete = allCoreAnswered(coreResults, core.length);
  const correctCount = core.filter((_q, i) => coreResults[i]?.correct).length;
  const anyIncorrect = core.some((_q, i) => coreResults[i] && !coreResults[i]!.correct);
  const isLastStage = stageIndex === area.stages.length - 1;

  function recordCore(qIndex: number, result: AnswerRecord) {
    const before = allCoreAnswered(store.getStageProgress(areaId, stageIndex)?.core, core.length);
    store.recordResult(areaId, stageIndex, "core", qIndex, result);
    const after = allCoreAnswered(store.getStageProgress(areaId, stageIndex)?.core, core.length);
    if (after && !before) store.recordAttempt(areaId, stageIndex, true);
  }
  function recordExtra(qIndex: number, result: AnswerRecord) {
    store.recordResult(areaId, stageIndex, "extra", qIndex, result);
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
  const focusResults = focus?.pool === "extra" ? extraResults : coreResults;
  const solutionQuestion =
    solution !== null ? (solution.pool === "extra" ? extra : core)[solution.index] : undefined;

  return (
    <main className="app-page exercise-v2">
      <Panel bodyless className="ws-panel">
        <div className="ws-head">
          <h1 className="ws-title">
            {titleCase(stage.title)} · Exercise {stageNum} of {area.stages.length}
          </h1>
          <p className="ws-count v2-mono">
            {core.length} question{core.length === 1 ? "" : "s"}
          </p>
          <p className="ws-instr">Work each one on paper, type your final answer, and check it.</p>
        </div>

        <ol className="qgrid">
          {core.map((q, i) => (
            <QuestionCard
              key={i}
              q={q}
              num={i + 1}
              ariaName={`question ${i + 1}`}
              recorded={coreResults[i]}
              onRecord={(r) => recordCore(i, r)}
              onSolution={(opener) => openSolution("core", i, opener)}
              onEnlarge={(opener) => openFocus("core", i, opener)}
            />
          ))}
        </ol>

        {coreComplete ? (
          <div className="ws-complete">
            <p className="ws-complete__text">
              <StatusCircle variant="check" size="sm" label="Complete" /> {correctCount} of{" "}
              {core.length} correct — Exercise {stageNum} complete
            </p>
            {isLastStage ? (
              <Link className="v2-btn v2-btn--primary" to={areaBasePath(area)}>
                Back to {titleCase(area.topicArea)}
              </Link>
            ) : (
              <Link className="v2-btn v2-btn--primary" to={stagePath(area, stageNum + 1)}>
                Next: Video {stageNum + 1} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
            {anyIncorrect ? (
              <p className="ws-nudge">
                Worth opening the solutions on the ones marked Incorrect before moving on.
              </p>
            ) : null}
          </div>
        ) : null}
      </Panel>

      {extra.length > 0 ? (
        <section className="area-section" aria-label="More practice">
          <button
            type="button"
            className="ex-expander"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
          >
            More practice · {extra.length} question{extra.length === 1 ? "" : "s"} · optional · same
            skill, fresh numbers
          </button>
          {expanded ? (
            <ol className="qgrid">
              {extra.map((q, i) => (
                <QuestionCard
                  key={i}
                  q={q}
                  num={i + 1}
                  ariaName={`practice question ${i + 1}`}
                  recorded={extraResults[i]}
                  onRecord={(r) => recordExtra(i, r)}
                  onSolution={(opener) => openSolution("extra", i, opener)}
                  onEnlarge={(opener) => openFocus("extra", i, opener)}
                />
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}

      {focus !== null ? (
        <FocusView
          questions={focusQuestions}
          index={focus.index}
          onIndex={(i) => setFocus({ pool: focus.pool, index: i })}
          results={focusResults}
          onRecord={(qi, r) => (focus.pool === "extra" ? recordExtra(qi, r) : recordCore(qi, r))}
          onClose={() => setFocus(null)}
          returnFocusTo={openerRef.current}
        />
      ) : null}

      {solution !== null && solutionQuestion ? (
        <SolutionModal
          questionNumber={solution.index + 1}
          question={solutionQuestion}
          onClose={() => setSolution(null)}
          returnFocusTo={openerRef.current}
        />
      ) : null}
    </main>
  );
}

function QuestionCard({
  q,
  num,
  ariaName,
  recorded,
  onRecord,
  onSolution,
  onEnlarge,
}: {
  q: Question;
  num: number;
  ariaName: string;
  recorded: AnswerRecord | undefined;
  onRecord: (result: AnswerRecord) => void;
  onSolution: (opener: HTMLElement) => void;
  onEnlarge: (opener: HTMLElement) => void;
}) {
  const figure = "figure" in q ? q.figure : undefined;
  return (
    <li className="qcard">
      <div className="qcard__head">
        <span className="qcard__num v2-badge" aria-hidden="true">
          {num}
        </span>
        <button
          type="button"
          className="qcard__expand"
          aria-label={`Enlarge ${ariaName}`}
          onClick={(e) => onEnlarge(e.currentTarget)}
        >
          <Maximize2 size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="qcard__box">
        <div className="qcard__prompt">
          <MathText>{q.prompt}</MathText>
        </div>
        {figure ? <FigureSlot figure={figure} /> : null}
      </div>
      <AnswerControl question={q} recorded={recorded} onRecord={onRecord} onOpenSolution={onSolution} />
    </li>
  );
}
