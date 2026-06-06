import { MathText } from "@/shared/MathText";

/**
 * A worked example: white card with a gold tag, a prompt, one line per working
 * step (in muted ink), and the answer in a green chip.
 */
export function NoteExample({
  prompt,
  working,
  answer,
}: {
  prompt: string;
  working: string[];
  answer: string;
}) {
  return (
    <div className="note-example">
      <span className="note-example__tag">WORKED EXAMPLE</span>
      <p className="note-example__prompt">
        <MathText>{prompt}</MathText>
      </p>
      <div className="note-example__working">
        {working.map((line, index) => (
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
