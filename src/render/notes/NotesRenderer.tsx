/**
 * @file NotesRenderer.tsx — renders a validated NoteBlock[] in order.
 *
 * Every text/prompt/working/answer string flows through MathText (via the leaf
 * components). An unknown block type at runtime — which should never pass the
 * validator — renders a visible error chip rather than being silently skipped
 * (CLAUDE.md §c rule 6 spirit).
 */

import type { NoteBlock } from "@/ingest/types";
import { NoteHeading } from "./NoteHeading";
import { NoteParagraph } from "./NoteParagraph";
import { NoteList } from "./NoteList";
import { NoteCallout } from "./NoteCallout";
import { NoteExample } from "./NoteExample";

function NoteBlockView({ block }: { block: NoteBlock }) {
  switch (block.type) {
    case "heading":
      return <NoteHeading text={block.text} />;
    case "paragraph":
      return <NoteParagraph text={block.text} />;
    case "list":
      return <NoteList items={block.items} />;
    case "callout":
      return <NoteCallout style={block.style} text={block.text} />;
    case "example":
      return (
        <NoteExample
          prompt={block.prompt}
          answer={block.answer}
          steps={block.steps}
          working={block.working}
        />
      );
    default: {
      // Defence in depth: validator should have caught this already.
      const unknownType = (block as { type?: unknown }).type;
      return (
        <div className="note-error" role="alert">
          Unknown note block type: <code>{String(unknownType ?? "(missing)")}</code>
        </div>
      );
    }
  }
}

export function NotesRenderer({ blocks }: { blocks: NoteBlock[] }) {
  return (
    <div className="notes-renderer">
      {blocks.map((block, index) => (
        <NoteBlockView key={index} block={block} />
      ))}
    </div>
  );
}
