import { MathText } from "@/shared/MathText";

/** A notes section heading. Math allowed (e.g. a heading naming a formula). */
export function NoteHeading({ text }: { text: string }) {
  return (
    <h2 className="note-heading">
      <MathText>{text}</MathText>
    </h2>
  );
}
