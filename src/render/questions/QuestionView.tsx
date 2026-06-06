import { MathText } from "@/shared/MathText";
import type { Question } from "@/ingest/types";
import { resolveFigure } from "@/ingest/figure";
import { FigureSlot } from "@/render/figures/FigureSlot";
import type { OutcomeHandler } from "./types";
import { MultipleChoice } from "./MultipleChoice";
import { QuestionTable } from "./QuestionTable";
import { RevealAndSelfMark } from "./RevealAndSelfMark";

/** Renders one question: the prompt (always) + the type-specific body. */
export function QuestionView({
  question,
  onOutcome,
}: {
  question: Question;
  onOutcome: OutcomeHandler;
}) {
  return (
    <div className="qr-question">
      <p className="qr-prompt">
        <MathText>{question.prompt}</MathText>
      </p>
      <QuestionBody question={question} onOutcome={onOutcome} />
    </div>
  );
}

function QuestionBody({
  question,
  onOutcome,
}: {
  question: Question;
  onOutcome: OutcomeHandler;
}) {
  if (question.type === "multiple-choice") {
    return <MultipleChoice question={question} onOutcome={onOutcome} />;
  }

  if (
    question.type === "text" ||
    question.type === "table" ||
    question.type === "graph" ||
    question.type === "geometry"
  ) {
    // Figures render wherever present, on ANY non-MC type (agreed ruling).
    const figure = resolveFigure(question as unknown as Record<string, unknown>).figure;
    return (
      <>
        {figure ? <FigureSlot figure={figure} /> : null}
        {question.type === "table" ? <QuestionTable rows={question.rows} /> : null}
        <RevealAndSelfMark
          answer={question.answer}
          working={question.working}
          onOutcome={onOutcome}
        />
      </>
    );
  }

  // Defence in depth (validator should have caught this).
  return (
    <div className="qr-error" role="alert">
      Unknown question type: <code>{String((question as { type?: unknown }).type)}</code>
    </div>
  );
}
