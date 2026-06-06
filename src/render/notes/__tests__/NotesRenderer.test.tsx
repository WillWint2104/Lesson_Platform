// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { NotesRenderer } from "@/render/notes/NotesRenderer";
import type { NoteBlock } from "@/ingest/types";

afterEach(cleanup);

describe("NotesRenderer", () => {
  it("renders heading, paragraph, and list content", () => {
    const blocks: NoteBlock[] = [
      { type: "heading", text: "My Heading" },
      { type: "paragraph", text: "A paragraph." },
      { type: "list", items: ["one", "two"] },
    ];
    const { container } = render(<NotesRenderer blocks={blocks} />);
    expect(container.querySelector(".note-heading")?.textContent).toContain("My Heading");
    expect(container.querySelector(".note-paragraph")?.textContent).toContain("A paragraph.");
    const items = container.querySelectorAll(".note-list__item");
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("one");
  });

  it("maps callout styles to the right tint classes", () => {
    const blocks: NoteBlock[] = [
      { type: "callout", style: "key", text: "k" },
      { type: "callout", style: "warning", text: "w" },
      { type: "callout", style: "info", text: "i" },
    ];
    const { container } = render(<NotesRenderer blocks={blocks} />);
    expect(container.querySelector(".note-callout--key")).not.toBeNull();
    expect(container.querySelector(".note-callout--warning")).not.toBeNull();
    expect(container.querySelector(".note-callout--info")).not.toBeNull();
  });

  it("renders example working lines in order, with tag and answer", () => {
    const blocks: NoteBlock[] = [
      { type: "example", prompt: "P", working: ["step A", "step B", "step C"], answer: "ANS" },
    ];
    const { container } = render(<NotesRenderer blocks={blocks} />);
    const lines = container.querySelectorAll(".note-example__working-line");
    expect(lines).toHaveLength(3);
    expect(lines[0]?.textContent).toContain("step A");
    expect(lines[2]?.textContent).toContain("step C");
    expect(container.querySelector(".note-example__tag")?.textContent).toContain("WORKED EXAMPLE");
    expect(container.querySelector(".note-example__answer")?.textContent).toContain("ANS");
  });

  it("shows an error chip for an unknown block type (never silently skips)", () => {
    const blocks = [{ type: "diagram", src: "x" }] as unknown as NoteBlock[];
    const { container } = render(<NotesRenderer blocks={blocks} />);
    const err = container.querySelector(".note-error");
    expect(err).not.toBeNull();
    expect(err?.textContent).toContain("diagram");
  });

  it("routes note text through MathText (renders a .katex node)", () => {
    const blocks: NoteBlock[] = [{ type: "paragraph", text: "value $x^2$ here" }];
    const { container } = render(<NotesRenderer blocks={blocks} />);
    expect(container.querySelector(".katex")).not.toBeNull();
  });
});
