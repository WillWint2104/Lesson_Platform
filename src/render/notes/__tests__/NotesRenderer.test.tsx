// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NotesRenderer } from "@/render/notes/NotesRenderer";
import type { NoteBlock } from "@/ingest/types";

afterEach(cleanup);

describe("NotesRenderer", () => {
  it("renders heading, paragraph, and list content via accessible queries", () => {
    const blocks: NoteBlock[] = [
      { type: "heading", text: "My Heading" },
      { type: "paragraph", text: "A paragraph." },
      { type: "list", items: ["one", "two"] },
    ];
    render(<NotesRenderer blocks={blocks} />);
    expect(screen.getByRole("heading", { name: "My Heading" })).toBeTruthy();
    expect(screen.getByText("A paragraph.")).toBeTruthy();
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["one", "two"]);
  });

  it("maps callout styles to the right tint classes", () => {
    // This unit's contract IS the style -> tint-class mapping (per the spec),
    // so we find each callout by its user-visible text and assert the class.
    const blocks: NoteBlock[] = [
      { type: "callout", style: "key", text: "key text" },
      { type: "callout", style: "warning", text: "warn text" },
      { type: "callout", style: "info", text: "info text" },
    ];
    render(<NotesRenderer blocks={blocks} />);
    expect(screen.getByText("key text").closest(".note-callout--key")).not.toBeNull();
    expect(screen.getByText("warn text").closest(".note-callout--warning")).not.toBeNull();
    expect(screen.getByText("info text").closest(".note-callout--info")).not.toBeNull();
  });

  it("renders example working lines in order, with tag and answer", () => {
    const blocks: NoteBlock[] = [
      { type: "example", prompt: "P", working: ["step A", "step B", "step C"], answer: "ANS" },
    ];
    render(<NotesRenderer blocks={blocks} />);
    expect(screen.getByText("Worked example")).toBeTruthy(); // CSS upper-cases it
    const steps = screen.getAllByText(/^step /);
    expect(steps.map((s) => s.textContent)).toEqual(["step A", "step B", "step C"]);
    expect(screen.getByText("ANS")).toBeTruthy();
  });

  it("renders a stepped example (steps with tex + why)", () => {
    const blocks: NoteBlock[] = [
      {
        type: "example",
        prompt: "P",
        answer: "ANS",
        steps: [{ tex: "x=1", why: "first reason" }, { tex: "x=2" }],
      },
    ];
    const { container } = render(<NotesRenderer blocks={blocks} />);
    // tex is typeset by KaTeX; the why prose is plain.
    expect(container.querySelectorAll(".note-example__step")).toHaveLength(2);
    expect(container.querySelectorAll(".note-example__working-line .katex").length).toBeGreaterThan(0);
    expect(screen.getByText("first reason")).toBeTruthy();
  });

  it("shows an alert chip for an unknown block type (never silently skips)", () => {
    const blocks = [{ type: "diagram", src: "x" }] as unknown as NoteBlock[];
    render(<NotesRenderer blocks={blocks} />);
    expect(screen.getByRole("alert").textContent).toContain("diagram");
  });

  it("routes note text through MathText (renders a .katex node)", () => {
    const blocks: NoteBlock[] = [{ type: "paragraph", text: "value $x^2$ here" }];
    const { container } = render(<NotesRenderer blocks={blocks} />);
    // Math markup is not exposed via accessible roles/text, so the .katex
    // selector is the appropriate assertion here.
    expect(container.querySelector(".katex")).not.toBeNull();
  });
});
