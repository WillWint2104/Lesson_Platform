/**
 * @file NotesEnlarged.tsx — the notes expanded view (design-language-v2 §13
 * readability addendum, dashboard-register-v1 PR-D4b).
 *
 * Opens from the ⤢ affordance on a notes section header (THE RULE / REMEMBER /
 * WORKED EXAMPLES) into the SAME EnlargedDialog as the question focus view
 * (scrim, mint strip, Close/Esc, focus trap). Body ≥ 18px / lh 1.7; the rule
 * formula renders \displaystyle ≥ 28px centered; worked examples keep their
 * tabs + WHY? toggles + explicit ANSWER at ≥ 20px math (the shared StepPlayer,
 * scaled by the enlarged CSS scope). The footer Prev/Next CYCLES the available
 * sections Rule → Remember → Examples.
 */
import { MathText } from "@/shared/MathText";
import type { NoteBlock } from "@/ingest/types";
import { EnlargedDialog } from "@/shared/v2";
import { StepPlayer, type ExampleData } from "@/render/notes/StepPlayer";

export type NotesSectionId = "rule" | "remember" | "examples";

export interface NotesSection {
  id: NotesSectionId;
  title: string;
  /** prose blocks (rule), callout blocks (remember) — unused for examples. */
  blocks: NoteBlock[];
  /** worked examples — only for the examples section. */
  examples?: ExampleData[];
}

export interface NotesEnlargedProps {
  sections: NotesSection[];
  /** Index into `sections` of the open section. */
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}

const DISPLAY_FORMULA = /^\s*\$\$[\s\S]*\$\$\s*$/;

export function NotesEnlarged({ sections, index, onIndex, onClose, returnFocusTo }: NotesEnlargedProps) {
  const section = sections[index];
  if (!section) return null;
  const total = sections.length;
  // Prev/Next CYCLE the available sections (Rule → Remember → Examples → Rule…).
  const cycle = (delta: number) => onIndex((index + delta + total) % total);

  return (
    <EnlargedDialog
      label={section.title}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
      onPrev={total > 1 ? () => cycle(-1) : undefined}
      onNext={total > 1 ? () => cycle(1) : undefined}
      prevLabel={total > 1 ? sections[(index - 1 + total) % total]!.title : "Previous"}
      nextLabel={total > 1 ? sections[(index + 1) % total]!.title : "Next"}
    >
      <div className="notes-enlarged">
        {section.id === "examples" && section.examples ? (
          <div className="notes-enlarged__examples">
            <StepPlayer examples={section.examples} />
          </div>
        ) : (
          section.blocks.map((block, i) => <EnlargedBlock key={i} block={block} />)
        )}
      </div>
    </EnlargedDialog>
  );
}

function EnlargedBlock({ block }: { block: NoteBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h3 className="notes-enlarged__heading">
          <MathText displayStyle>{block.text}</MathText>
        </h3>
      );
    case "paragraph":
      if (DISPLAY_FORMULA.test(block.text)) {
        // The rule formula: \displaystyle, large, centered.
        return (
          <div className="notes-enlarged__formula">
            <MathText>{block.text}</MathText>
          </div>
        );
      }
      return (
        <p className="notes-enlarged__para">
          <MathText displayStyle>{block.text}</MathText>
        </p>
      );
    case "list":
      return (
        <ul className="notes-enlarged__list">
          {block.items.map((item, i) => (
            <li key={i}>
              <MathText displayStyle>{item}</MathText>
            </li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <div className="v2-remember notes-enlarged__remember">
          <MathText displayStyle>{block.text}</MathText>
        </div>
      );
    default:
      return null;
  }
}
