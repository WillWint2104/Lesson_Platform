import { MathText } from "@/shared/MathText";

/** A body paragraph. All math flows through MathText. */
export function NoteParagraph({ text }: { text: string }) {
  return (
    <p className="note-paragraph">
      <MathText>{text}</MathText>
    </p>
  );
}
