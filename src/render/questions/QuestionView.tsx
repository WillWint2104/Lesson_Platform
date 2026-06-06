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
  switch (question.type) {
    case "multiple-choice":
      return <MultipleChoice question={question} onOutcome={onOutcome} />;
    case "text":
      return (
        <RevealAndSelfMark
          answer={question.answer}
          working={question.working}
          onOutcome={onOutcome}
        />
      );
    case "table":
      return (
        <>
          <QuestionTable rows={question.rows} />
          <RevealAndSelfMark
            answer={question.answer}
            working={question.working}
            onOutcome={onOutcome}
          />
        </>
      );
    case "graph":
    case "geometry": {
      const figure = resolveFigure(question as unknown as Record<string, unknown>).figure;
      return (
        <>
          <FigureSlot figure={figure} />
          <RevealAndSelfMark
            answer={question.answer}
            working={question.working}
            onOutcome={onOutcome}
          />
        </>
      );
    }
    default:
      // Defence in depth (validator should have caught this).
      return (
        <div className="qr-error" role="alert">
          Unknown question type: <code>{String((question as { type?: unknown }).type)}</code>
        </div>
      );
  }
}
