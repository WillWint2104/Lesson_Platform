import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateManifest,
  validateNotesFile,
  validateQuestionsFile,
  type Issue,
} from "../validate";

const qfile = (questions: unknown[]) => ({ questions });
const nfile = (notes: unknown[]) => ({ notes });

/** True if some issue has the exact path and a message containing `fragment`. */
function has(issues: Issue[], path: string, fragment: string): boolean {
  return issues.some((i) => i.path === path && i.message.includes(fragment));
}

// ---------------------------------------------------------------------------
// Questions — error classes
// ---------------------------------------------------------------------------

describe("validateQuestionsFile — errors", () => {
  it("flags a missing prompt with a path-precise message", () => {
    const res = validateQuestionsFile(qfile([{ type: "text" }]));
    expect(res.valid).toBe(false);
    expect(res.errors).toContainEqual({
      path: "questions[0]",
      message: "missing required field 'prompt'",
    });
  });

  it("flags a missing type", () => {
    const res = validateQuestionsFile(qfile([{ prompt: "x" }]));
    expect(has(res.errors, "questions[0]", "missing required field 'type'")).toBe(true);
  });

  it("flags an unknown question type", () => {
    const res = validateQuestionsFile(qfile([{ type: "essay", prompt: "x" }]));
    expect(has(res.errors, "questions[0]", "unknown question type")).toBe(true);
  });

  it("flags table rows that are not string[][]", () => {
    const res = validateQuestionsFile(
      qfile([{ type: "table", prompt: "x", rows: [[1, 2]] }]),
    );
    expect(has(res.errors, "questions[0] (table)", "rows must be an array of string arrays")).toBe(
      true,
    );
  });

  it("flags a missing rows field on a table", () => {
    const res = validateQuestionsFile(qfile([{ type: "table", prompt: "x" }]));
    expect(has(res.errors, "questions[0] (table)", "missing required field 'rows'")).toBe(true);
  });

  it("flags graph/geometry questions missing their data field", () => {
    const g = validateQuestionsFile(qfile([{ type: "graph", prompt: "x" }]));
    expect(has(g.errors, "questions[0] (graph)", "missing required field 'graphData'")).toBe(true);
    const geo = validateQuestionsFile(qfile([{ type: "geometry", prompt: "x" }]));
    expect(
      has(geo.errors, "questions[0] (geometry)", "missing required field 'geometryData'"),
    ).toBe(true);
  });

  it("flags a multiple-choice question with zero options", () => {
    const res = validateQuestionsFile(
      qfile([{ type: "multiple-choice", prompt: "x", options: [] }]),
    );
    expect(
      has(res.errors, "questions[0] (multiple-choice)", "options must contain at least one option"),
    ).toBe(true);
  });

  it("flags a multiple-choice question with no correct option", () => {
    const res = validateQuestionsFile(
      qfile([
        {
          type: "multiple-choice",
          prompt: "x",
          options: [
            { text: "a", isCorrect: false },
            { text: "b", isCorrect: false },
          ],
        },
      ]),
    );
    expect(
      has(
        res.errors,
        "questions[0] (multiple-choice)",
        "options must contain at least one isCorrect: true",
      ),
    ).toBe(true);
  });

  it("flags a malformed multiple-choice option", () => {
    const res = validateQuestionsFile(
      qfile([{ type: "multiple-choice", prompt: "x", options: [{ text: "a" }] }]),
    );
    expect(
      has(
        res.errors,
        "questions[0] (multiple-choice).options[0]",
        "field 'isCorrect' must be a boolean",
      ),
    ).toBe(true);
  });

  it("accepts a well-formed questions file", () => {
    const res = validateQuestionsFile(
      qfile([
        { type: "text", prompt: "Expand $4(x+3)$." },
        {
          type: "multiple-choice",
          prompt: "Pick one",
          options: [
            { text: "a", isCorrect: true },
            { text: "b", isCorrect: false },
          ],
        },
        { type: "table", prompt: "Fill in", rows: [["a", "b"], ["c", "d"]] },
      ]),
    );
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Notes — error classes
// ---------------------------------------------------------------------------

describe("validateNotesFile — errors", () => {
  it("flags an unknown block type", () => {
    const res = validateNotesFile(nfile([{ type: "quote", text: "x" }]));
    expect(has(res.errors, "notes[0]", "unknown block type")).toBe(true);
  });

  it("flags a callout with an invalid style", () => {
    const res = validateNotesFile(nfile([{ type: "callout", style: "danger", text: "x" }]));
    expect(
      has(res.errors, "notes[0] (callout)", "style must be one of key | warning | info"),
    ).toBe(true);
  });

  it("flags an example whose working is not a string[]", () => {
    const res = validateNotesFile(
      nfile([{ type: "example", prompt: "p", working: "nope", answer: "a" }]),
    );
    expect(
      has(res.errors, "notes[0] (example)", "working must be an array of strings"),
    ).toBe(true);
  });

  it("flags a heading missing its text", () => {
    const res = validateNotesFile(nfile([{ type: "heading" }]));
    expect(has(res.errors, "notes[0]", "missing required field 'text'")).toBe(true);
  });

  it("accepts a well-formed notes file", () => {
    const res = validateNotesFile(
      nfile([
        { type: "heading", text: "Title" },
        { type: "paragraph", text: "Body" },
        { type: "callout", style: "key", text: "Important" },
        { type: "example", prompt: "p", working: ["step 1"], answer: "a" },
        { type: "list", items: ["one", "two"] },
      ]),
    );
    expect(res.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LaTeX control-character tripwire
// ---------------------------------------------------------------------------

describe("control-character LaTeX tripwire", () => {
  it("catches a single-escaped \\frac (form-feed) in a question prompt", () => {
    // Authored as "\frac" in JSON -> JSON.parse yields form-feed + "rac".
    const file = JSON.parse('{"questions":[{"type":"text","prompt":"\\frac{1}{2}"}]}');
    const res = validateQuestionsFile(file);
    expect(res.valid).toBe(false);
    expect(res.errors[0]?.message).toContain("control character");
    expect(res.errors[0]?.message).toContain("un-doubled LaTeX backslash");
  });

  it("catches a single-escaped \\times (tab) inside example working[]", () => {
    // "\times" -> JSON.parse yields tab + "imes".
    const file = JSON.parse(
      '{"notes":[{"type":"example","prompt":"p","working":["\\times x"],"answer":"a"}]}',
    );
    const res = validateNotesFile(file);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes("control character"))).toBe(true);
  });

  it("accepts a correctly double-escaped \\\\frac", () => {
    // Authored as "\\frac" in JSON -> JSON.parse yields a literal backslash + "frac".
    const file = JSON.parse('{"questions":[{"type":"text","prompt":"\\\\frac{1}{2}"}]}');
    const res = validateQuestionsFile(file);
    expect(res.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Warnings (non-fatal, forward-compatible)
// ---------------------------------------------------------------------------

describe("warnings", () => {
  it("warns (not errors) on unknown extra fields", () => {
    const res = validateQuestionsFile(qfile([{ type: "text", prompt: "x", extra: 1 }]));
    expect(res.valid).toBe(true);
    expect(has(res.warnings, "questions[0]", "unknown field 'extra'")).toBe(true);
  });

  it("warns on a difficulty outside the enum", () => {
    const res = validateQuestionsFile(
      qfile([{ type: "text", prompt: "x", difficulty: "trivial" }]),
    );
    expect(res.valid).toBe(true);
    expect(has(res.warnings, "questions[0]", "is not one of easy | medium | hard")).toBe(true);
  });

  it("warns on a numeric difficulty", () => {
    const res = validateQuestionsFile(qfile([{ type: "text", prompt: "x", difficulty: 2 }]));
    expect(res.valid).toBe(true);
    expect(res.warnings.some((w) => w.message.includes("is not one of"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

describe("validateManifest", () => {
  const goodManifest = {
    lesson: {
      id: "x-1",
      title: "Lesson",
      subject: "math",
      video: { src: "v.mp4", duration: null },
      notes: "notes.json",
      questions: "questions.json",
    },
  };

  it("accepts a well-formed manifest with file-path references", () => {
    expect(validateManifest(goodManifest).valid).toBe(true);
  });

  it("flags a manifest missing the lesson wrapper", () => {
    const res = validateManifest({ id: "x" });
    expect(has(res.errors, "lesson", "missing required field 'lesson'")).toBe(true);
  });

  it("flags a video missing its duration field", () => {
    const res = validateManifest({
      lesson: { ...goodManifest.lesson, video: { src: "v.mp4" } },
    });
    expect(has(res.errors, "lesson.video", "missing required field 'duration'")).toBe(true);
  });

  it("validates inline notes/questions arrays", () => {
    const res = validateManifest({
      lesson: {
        ...goodManifest.lesson,
        notes: [{ type: "heading" }],
        questions: [{ type: "text" }],
      },
    });
    expect(has(res.errors, "lesson.notes[0]", "missing required field 'text'")).toBe(true);
    expect(has(res.errors, "lesson.questions[0]", "missing required field 'prompt'")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Living fixture: every /content JSON must validate cleanly
// ---------------------------------------------------------------------------

describe("/content is a living fixture", () => {
  const contentDir = fileURLToPath(new URL("../../../content/", import.meta.url));
  const jsonFiles = readdirSync(contentDir, { recursive: true, encoding: "utf8" }).filter(
    (f): f is string => typeof f === "string" && f.endsWith(".json"),
  );

  it("discovers content JSON files to check", () => {
    expect(jsonFiles.length).toBeGreaterThan(0);
  });

  it.each(jsonFiles)("validates cleanly: %s", (rel) => {
    const raw = JSON.parse(readFileSync(join(contentDir, rel), "utf8"));
    const base = rel.split(/[\\/]/).pop();
    const res =
      base === "lesson.json"
        ? validateManifest(raw)
        : base === "questions.json"
          ? validateQuestionsFile(raw)
          : base === "notes.json"
            ? validateNotesFile(raw)
            : { valid: true, errors: [], warnings: [] };
    if (!res.valid) {
      throw new Error(
        `${rel} failed validation:\n` +
          res.errors.map((e) => `  - ${e.path}: ${e.message}`).join("\n"),
      );
    }
    expect(res.valid).toBe(true);
  });
});
