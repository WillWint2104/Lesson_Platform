import { MathText } from "@/shared/MathText";

/** A simple ordered list of points; each item may contain math. */
export function NoteList({ items }: { items: string[] }) {
  return (
    <ul className="note-list">
      {items.map((item, index) => (
        <li key={index} className="note-list__item">
          <MathText>{item}</MathText>
        </li>
      ))}
    </ul>
  );
}
