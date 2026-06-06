import { MathText } from "@/shared/MathText";

type CalloutStyle = "key" | "warning" | "info";

const STYLE_CLASS: Record<CalloutStyle, string> = {
  key: "note-callout--key", // green tint + green accent
  warning: "note-callout--warning", // gold tint + gold accent
  info: "note-callout--info", // cyan tint + cyan accent
};

/** A tinted, left-accented callout. Style maps to a tint class. */
export function NoteCallout({ style, text }: { style: CalloutStyle; text: string }) {
  const styleClass = STYLE_CLASS[style] ?? "";
  return (
    <aside className={`note-callout ${styleClass}`.trim()}>
      <MathText>{text}</MathText>
    </aside>
  );
}
