/**
 * @file StagePage.tsx — /:course/:topic/:topicArea/stage/:n  (design-language-v2 §7a)
 *
 * On the grid canvas: a plain title row (`Title · Lesson n of N`), then the
 * VIDEO BAND full-width on its own row (panel + mint strip + dark 16:9 + caption
 * — gap-proof, never beside variable-height notes), then ONE notes panel with
 * two internal columns (left: THE RULE + REMEMBER; right: WORKED EXAMPLES),
 * collapsing to one column < 920px, and an "Up next · Exercise N" footer with a
 * single primary action. Stage navigation lives in the contents sidebar (§4),
 * so there is no in-page stepper here.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { ProgressStore } from "@/state/progress";
import type { NoteBlock } from "@/ingest/types";
import { titleCase } from "@/app/format";
import { exercisePath } from "@/app/stageProgress";
import { Panel, ExpandIcon } from "@/shared/v2";
import { VideoEmbed } from "@/render/VideoEmbed";
import { MathText } from "@/shared/MathText";
import { StepPlayer, type ExampleData } from "@/render/notes/StepPlayer";
import { NotesEnlarged, type NotesSection, type NotesSectionId } from "@/render/notes/NotesEnlarged";
import { NotFound } from "@/app/screens/NotFound";

function useStoreTick(store: ProgressStore): void {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
}

const DISPLAY_FORMULA = /^\s*\$\$[\s\S]*\$\$\s*$/;

export function StagePage() {
  const { course, topic, topicArea, n } = useParams();
  const registry = useRegistry();
  const store = useProgressStore();
  const areaId = `${course}/${topic}/${topicArea}`;
  const area = registry.getAreaById(areaId);
  const stageNum = Number(n);
  const stageIndex = stageNum - 1;
  const ok =
    !!area && area.valid && Number.isInteger(stageNum) && stageNum >= 1 && stageNum <= area.stages.length;

  useStoreTick(store);

  // Notes expanded view state (hooks before the early return).
  const [enlargedIndex, setEnlargedIndex] = useState<number | null>(null);
  const enlargeOpenerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (ok && area) store.setLastVisited(area.id, stageIndex, "stage");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, area, store, stageIndex]);

  if (!ok || !area) {
    return <NotFound message="That stage doesn’t exist." />;
  }

  const stage = area.stages[stageIndex]!;
  const prose = stage.notes.filter(
    (b) => b.type === "heading" || b.type === "paragraph" || b.type === "list",
  );
  const callouts = stage.notes.filter((b): b is Extract<NoteBlock, { type: "callout" }> => b.type === "callout");
  const examples: ExampleData[] = stage.notes
    .filter((b): b is Extract<NoteBlock, { type: "example" }> => b.type === "example")
    .map((b) => ({ prompt: b.prompt, answer: b.answer, steps: b.steps, working: b.working }));

  const dur = stage.video && typeof stage.video.duration === "number" ? `${stage.video.duration} min · ` : "";
  const coreCount = stage.exercise.questions.length;

  // Notes expanded view (§13 readability addendum): the available sections, in
  // the cycle order Rule → Remember → Examples.
  const sections: NotesSection[] = [];
  if (prose.length > 0) sections.push({ id: "rule", title: "The rule", blocks: prose });
  if (callouts.length > 0) sections.push({ id: "remember", title: "Remember", blocks: callouts });
  if (examples.length > 0)
    sections.push({ id: "examples", title: "Worked examples", blocks: [], examples });
  const openSection = (id: NotesSectionId, opener: HTMLElement) => {
    enlargeOpenerRef.current = opener;
    setEnlargedIndex(sections.findIndex((s) => s.id === id));
  };

  return (
    <main className="app-page stage-v2">
      <p className="stage-v2__titlerow">
        <span className="stage-v2__title">{titleCase(stage.title)}</span>
        <span className="stage-v2__lesson v2-mono">
          Lesson {stageNum} of {area.stages.length}
        </span>
      </p>

      {/* Video band — full width, alone on its row (gap-proof). */}
      <Panel bodyless className="stage-v2__video">
        <VideoEmbed src={stage.video?.src ?? null} title={stage.title} />
        <div className="stage-v2__caption">
          <span className="stage-v2__caption-title">{titleCase(stage.title)}</span>
          <span className="stage-v2__caption-meta v2-mono">{dur}watch first</span>
        </div>
      </Panel>

      {/* Notes — one panel, two internal columns. Each section header carries a
          ⤢ expand affordance into the shared enlarged dialog. */}
      <Panel className="stage-v2__notes">
        <div className="notes-cols">
          <div className="notes-cols__rule">
            {prose.length > 0 ? (
              <section className="notes-block">
                <div className="notes-block__head">
                  <p className="v2-mono notes-block__label">The rule</p>
                  <button
                    type="button"
                    className="notes-block__expand"
                    aria-label="Enlarge the rule"
                    onClick={(e) => openSection("rule", e.currentTarget)}
                  >
                    <ExpandIcon size={14} />
                  </button>
                </div>
                {prose.map((b, i) => (
                  <ProseBlock key={i} block={b} />
                ))}
              </section>
            ) : null}
            {callouts.length > 0 ? (
              <section className="notes-block">
                <div className="notes-block__head">
                  <p className="v2-mono notes-block__label">Remember</p>
                  <button
                    type="button"
                    className="notes-block__expand"
                    aria-label="Enlarge remember"
                    onClick={(e) => openSection("remember", e.currentTarget)}
                  >
                    <ExpandIcon size={14} />
                  </button>
                </div>
                {callouts.map((b, i) => (
                  <div key={i} className="v2-remember">
                    <MathText>{b.text}</MathText>
                  </div>
                ))}
              </section>
            ) : null}
          </div>

          <div className="notes-cols__examples">
            {examples.length > 0 ? (
              <section className="notes-block">
                <div className="notes-block__head">
                  <p className="v2-mono notes-block__label">Worked examples</p>
                  <button
                    type="button"
                    className="notes-block__expand"
                    aria-label="Enlarge worked examples"
                    onClick={(e) => openSection("examples", e.currentTarget)}
                  >
                    <ExpandIcon size={14} />
                  </button>
                </div>
                <StepPlayer examples={examples} />
              </section>
            ) : (
              <p className="notes-empty">No worked examples for this stage yet.</p>
            )}
          </div>
        </div>
      </Panel>

      {enlargedIndex !== null && enlargedIndex >= 0 ? (
        <NotesEnlarged
          sections={sections}
          index={enlargedIndex}
          onIndex={setEnlargedIndex}
          onClose={() => setEnlargedIndex(null)}
          returnFocusTo={enlargeOpenerRef.current}
        />
      ) : null}

      {/* Up next footer — a single primary action. */}
      <Panel className="stage-v2__upnext">
        <div className="stage-v2__upnext-text">
          <span className="v2-mono">Up next</span>
          <span className="stage-v2__upnext-title">
            Exercise {stageNum} · {coreCount} question{coreCount === 1 ? "" : "s"}
          </span>
        </div>
        <Link className="v2-btn v2-btn--primary" to={exercisePath(area, stageNum)}>
          Start Exercise {stageNum} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </Panel>
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
        <div className="v2-formula">
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
