/**
 * @file StagePage.tsx — /:subject/:topic/:topicArea/stage/:n
 *
 * Two-column (≥980px): framed video left (7fr), stage notes right (4fr); stacks
 * video-first below 980. Under the video: a meta line + the primary
 * "Start Exercise N →". Notes anatomy: STAGE NOTES label → THE RULE → REMEMBER →
 * WORKED EXAMPLES (the step player). Free navigation via the shared stepper.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { ProgressStore } from "@/state/progress";
import type { NoteBlock } from "@/ingest/types";
import { titleCase } from "@/app/format";
import { computeStageStatus } from "@/app/unlock";
import { areaBasePath, exercisePath, stagePath, stageInputs } from "@/app/stageProgress";
import { StageStepper } from "@/app/StageStepper";
import { VideoEmbed } from "@/render/VideoEmbed";
import { MathText } from "@/shared/MathText";
import { NoteCallout } from "@/render/notes/NoteCallout";
import { StepPlayer, type ExampleData } from "@/render/notes/StepPlayer";
import { NotFound } from "@/app/screens/NotFound";

function useStoreTick(store: ProgressStore): void {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
}

const DISPLAY_FORMULA = /^\s*\$\$[\s\S]*\$\$\s*$/;

export function StagePage() {
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

  useEffect(() => {
    if (ok && area) store.setLastVisited(area.id, stageIndex, "stage");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, area, store, stageIndex]);

  if (!ok || !area) {
    return <NotFound message="That stage doesn’t exist." />;
  }

  const stage = area.stages[stageIndex]!;
  const statuses = computeStageStatus(stageInputs(area, store));
  const steps = area.stages.map((s, i) => ({ title: s.title, status: statuses[i]! }));

  const prose = stage.notes.filter(
    (b) => b.type === "heading" || b.type === "paragraph" || b.type === "list",
  );
  const callouts = stage.notes.filter((b) => b.type === "callout");
  const examples: ExampleData[] = stage.notes
    .filter((b): b is Extract<NoteBlock, { type: "example" }> => b.type === "example")
    .map((b) => ({ prompt: b.prompt, answer: b.answer, steps: b.steps, working: b.working }));

  return (
    <main className="app-page stage-page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link className="breadcrumb__link" to="/">
          {titleCase(area.subject)}
        </Link>{" "}
        / {titleCase(area.topic)} / {titleCase(area.topicArea)}
      </nav>
      <header className="area-head">
        <h1 className="sel-title">{area.title}</h1>
      </header>

      <StageStepper steps={steps} activeIndex={stageIndex} hrefFor={(i) => stagePath(area, i + 1)} />

      {/* Main: video + worked examples (the player needs the wide column);
          rail: the rule, remember, and the Start-Exercise CTA at its foot.
          Stacks under 980 as video → examples → rule → remember → CTA. */}
      <div className="stage-grid">
        <div className="stage-grid__main">
          <VideoEmbed src={stage.video?.src ?? null} title={stage.title} />
          {examples.length > 0 ? (
            <section className="notes-panel">
              <p className="section-label">Worked examples</p>
              <StepPlayer examples={examples} />
            </section>
          ) : null}
        </div>

        <aside className="stage-grid__rail">
          <p className="section-label">Stage notes · {stage.title}</p>

          {prose.length > 0 ? (
            <section className="notes-panel">
              <p className="section-label">The rule</p>
              {prose.map((b, i) => (
                <ProseBlock key={i} block={b} />
              ))}
            </section>
          ) : null}

          {callouts.length > 0 ? (
            <section className="notes-panel">
              <p className="section-label">Remember</p>
              {callouts.map((b, i) =>
                b.type === "callout" ? <NoteCallout key={i} style={b.style} text={b.text} /> : null,
              )}
            </section>
          ) : null}

          <div className="stage-cta">
            <p className="area-meta">
              Stage {stageNum} of {area.stages.length} · {stage.exercise.questions.length} core
              question{stage.exercise.questions.length === 1 ? "" : "s"}
            </p>
            <Link className="btn btn--primary" to={exercisePath(area, stageNum)}>
              Start Exercise {stageNum} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </aside>
      </div>

      <Link className="stage-back" to={areaBasePath(area)}>
        Back to {titleCase(area.topicArea)}
      </Link>
    </main>
  );
}

function ProseBlock({ block }: { block: NoteBlock }) {
  if (block.type === "heading") {
    return (
      <h3 className="note-heading">
        <MathText>{block.text}</MathText>
      </h3>
    );
  }
  if (block.type === "list") {
    return (
      <ul className="note-list">
        {block.items.map((item, i) => (
          <li key={i} className="note-list__item">
            <MathText>{item}</MathText>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "paragraph") {
    if (DISPLAY_FORMULA.test(block.text)) {
      return (
        <div className="rule-formula">
          <MathText>{block.text}</MathText>
        </div>
      );
    }
    return (
      <p className="note-paragraph">
        <MathText>{block.text}</MathText>
      </p>
    );
  }
  return null;
}
