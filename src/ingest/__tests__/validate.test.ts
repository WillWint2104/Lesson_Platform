import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateAreaManifest,
  validateNotesFile,
  validateQuestionsFile,
  type Issue,
} from "@/ingest/validate";
import { buildAreaRegistry } from "@/ingest/load";
import { figureSchemas } from "@/render/figures/registry";

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

  it("allows graph/geometry questions with no figure (figure is optional now)", () => {
    expect(validateQuestionsFile(qfile([{ type: "graph", prompt: "x" }])).valid).toBe(true);
    expect(validateQuestionsFile(qfile([{ type: "geometry", prompt: "x" }])).valid).toBe(true);
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

  it("flags a multiple-choice question with more than one correct option", () => {
    const res = validateQuestionsFile(
      qfile([
        {
          type: "multiple-choice",
          prompt: "x",
          options: [
            { text: "a", isCorrect: true },
            { text: "b", isCorrect: true },
            { text: "c", isCorrect: false },
          ],
        },
      ]),
    );
    expect(res.valid).toBe(false);
    expect(
      has(
        res.errors,
        "questions[0] (multiple-choice)",
        "exactly one option may have isCorrect: true (found 2)",
      ),
    ).toBe(true);
  });

  it("accepts a multiple-choice question with exactly one correct option", () => {
    const res = validateQuestionsFile(
      qfile([
        {
          type: "multiple-choice",
          prompt: "x",
          options: [
            { text: "a", isCorrect: true },
            { text: "b", isCorrect: false },
          ],
        },
      ]),
    );
    expect(res.valid).toBe(true);
  });

  it("treats a 'topic' field on a question as a hard error (not a warning)", () => {
    const res = validateQuestionsFile(
      qfile([{ type: "text", prompt: "x", topic: "algebra" }]),
    );
    expect(res.valid).toBe(false);
    expect(has(res.errors, "questions[0]", "field 'topic' is not allowed")).toBe(true);
    // And it is not ALSO double-reported as an unknown-field warning.
    expect(res.warnings.some((w) => w.message.includes("'topic'"))).toBe(false);
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
// Optional answer / working (non-MC reveal fields)
// ---------------------------------------------------------------------------

describe("optional answer/working", () => {
  it("accepts a text question with answer + working", () => {
    const res = validateQuestionsFile(
      qfile([
        { type: "text", prompt: "Expand $4(x+3)$.", answer: "$4x+12$", working: ["a", "b"] },
      ]),
    );
    expect(res.valid).toBe(true);
  });

  it("errors when answer is not a string", () => {
    const res = validateQuestionsFile(qfile([{ type: "text", prompt: "x", answer: 42 }]));
    expect(has(res.errors, "questions[0]", "field 'answer' must be a string")).toBe(true);
  });

  it("errors when working is not a string[]", () => {
    const res = validateQuestionsFile(
      qfile([{ type: "table", prompt: "x", rows: [["a"]], working: "nope" }]),
    );
    expect(has(res.errors, "questions[0]", "working must be an array of strings")).toBe(true);
  });

  it("warns (not errors) when a text question has no answer", () => {
    const res = validateQuestionsFile(qfile([{ type: "text", prompt: "Discuss." }]));
    expect(res.valid).toBe(true);
    expect(
      has(res.warnings, "questions[0] (text)", "no answer provided — the runtime will fall back"),
    ).toBe(true);
  });

  it("does not warn about a missing answer for non-text types", () => {
    const res = validateQuestionsFile(qfile([{ type: "table", prompt: "x", rows: [["a"]] }]));
    expect(res.warnings.some((w) => w.message.includes("no answer provided"))).toBe(false);
  });

  it("allows answer/working on geometry questions", () => {
    const res = validateQuestionsFile(
      qfile([
        {
          type: "geometry",
          prompt: "Area?",
          geometryData: { shape: "triangle" },
          answer: "$12$",
          working: ["A = ..."],
        },
      ]),
    );
    expect(res.valid).toBe(true);
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

  it("accepts a stepped example (steps with tex + optional why)", () => {
    const res = validateNotesFile(
      nfile([
        {
          type: "example",
          prompt: "p",
          answer: "a",
          steps: [{ tex: "x=1", why: "because" }, { tex: "x=2" }],
        },
      ]),
    );
    expect(res.valid).toBe(true);
  });

  it("errors when an example has BOTH steps and working", () => {
    const res = validateNotesFile(
      nfile([{ type: "example", prompt: "p", answer: "a", steps: [{ tex: "x" }], working: ["x"] }]),
    );
    expect(has(res.errors, "notes[0] (example)", "use steps; working is the legacy form")).toBe(true);
  });

  it("errors when an example has NEITHER steps nor working", () => {
    const res = validateNotesFile(nfile([{ type: "example", prompt: "p", answer: "a" }]));
    expect(has(res.errors, "notes[0] (example)", "must have steps")).toBe(true);
  });

  it("errors on a step missing its tex", () => {
    const res = validateNotesFile(
      nfile([{ type: "example", prompt: "p", answer: "a", steps: [{ why: "no tex" }] }]),
    );
    expect(has(res.errors, "notes[0] (example).steps[0]", "missing or empty required field 'tex'")).toBe(true);
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

  it("warns on raw \\textcolor in math content (use \\emA / \\emB)", () => {
    const file = JSON.parse(
      '{"questions":[{"type":"text","prompt":"$\\\\textcolor{red}{x}$","answer":"a"}]}',
    );
    const res = validateQuestionsFile(file);
    expect(res.valid).toBe(true);
    expect(res.warnings.some((w) => w.message.includes("\\textcolor"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Area manifest
// ---------------------------------------------------------------------------

describe("validateAreaManifest (v3 stages)", () => {
  const goodArea = {
    area: {
      title: "Expanding Brackets",
      stages: [
        {
          title: "Single brackets",
          notes: "notes.json",
          video: { src: null, duration: null },
          exercise: { questions: "exercise-1.json" },
        },
      ],
    },
  };

  it("accepts a well-formed area manifest", () => {
    expect(validateAreaManifest(goodArea).valid).toBe(true);
  });

  it("rejects the superseded lesson manifest with a migration pointer", () => {
    const res = validateAreaManifest({ lesson: { id: "x", title: "X" } });
    expect(res.valid).toBe(false);
    expect(has(res.errors, "lesson", "superseded by area.json")).toBe(true);
  });

  it("rejects a superseded v2 sequence manifest with a migration pointer", () => {
    const res = validateAreaManifest({ area: { title: "T", sequence: [] } });
    expect(res.valid).toBe(false);
    expect(has(res.errors, "area.sequence", "superseded by v3 stages")).toBe(true);
  });

  it("errors on a missing 'area' wrapper", () => {
    expect(has(validateAreaManifest({}).errors, "area", "missing required field 'area'")).toBe(true);
  });

  it("errors on no stages", () => {
    const res = validateAreaManifest({ area: { title: "T", stages: [] } });
    expect(has(res.errors, "area.stages", "at least one stage")).toBe(true);
  });

  it("errors on a stage missing its exercise", () => {
    const res = validateAreaManifest({ area: { title: "T", stages: [{ title: "S" }] } });
    expect(has(res.errors, "area.stages[0].exercise", "missing required field 'exercise'")).toBe(true);
  });

  it("errors on an exercise with zero core questions", () => {
    const res = validateAreaManifest({
      area: { title: "T", stages: [{ title: "S", exercise: { questions: [] } }] },
    });
    expect(has(res.errors, "area.stages[0].exercise.questions", "at least one question")).toBe(true);
  });

  it("errors (path-precise) on an empty extra pool", () => {
    const res = validateAreaManifest({
      area: {
        title: "T",
        stages: [{ title: "S", exercise: { questions: [{ type: "text", prompt: "Q" }], extra: [] } }],
      },
    });
    expect(
      has(res.errors, "area.stages[0].exercise.extra", "extra, when present, must contain at least one question"),
    ).toBe(true);
  });

  it("validates an inline extra question path-precisely", () => {
    const res = validateAreaManifest({
      area: {
        title: "T",
        stages: [
          { title: "S", exercise: { questions: [{ type: "text", prompt: "Q" }], extra: [{ type: "text" }] } },
        ],
      },
    });
    expect(has(res.errors, "area.stages[0].exercise.extra[0]", "missing required field 'prompt'")).toBe(true);
  });

  it("errors on an unparseable stage video src", () => {
    const res = validateAreaManifest({
      area: {
        title: "T",
        stages: [
          {
            title: "S",
            video: { src: "not a video!!", duration: null },
            exercise: { questions: [{ type: "text", prompt: "Q" }] },
          },
        ],
      },
    });
    expect(has(res.errors, "area.stages[0].video", "could not be parsed as a YouTube video")).toBe(true);
  });

  it("validates inline core questions + figure data per kind", () => {
    const res = validateAreaManifest(
      {
        area: {
          title: "T",
          stages: [
            {
              title: "S",
              exercise: {
                questions: [
                  {
                    type: "geometry",
                    prompt: "p",
                    figure: { kind: "triangle-figure", specVersion: 1, data: { vertices: [{ x: 0, y: 0 }] } },
                  },
                ],
              },
            },
          ],
        },
      },
      { figureSchemas },
    );
    expect(res.valid).toBe(false);
    expect(
      res.errors.some((e) => e.path.includes("figure.data.vertices") && e.message.includes("exactly 3")),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildAreaRegistry
// ---------------------------------------------------------------------------

describe("buildAreaRegistry (v3 stages)", () => {
  const area = (title: string, stages: unknown[]) => ({ area: { title, stages } });
  const at = (topicArea: string) => `/content/math/algebra/${topicArea}/area.json`;
  const stage = (title: string, questions: unknown, extra?: unknown) => ({
    title,
    exercise: { questions, ...(extra !== undefined ? { extra } : {}) },
  });

  it("derives hierarchy + areaId from the path and resolves stages", () => {
    const reg = buildAreaRegistry({
      "/content/science/biology/cells/area.json": area("Cells", [
        { title: "S", video: { src: null, duration: null }, exercise: { questions: [{ type: "text", prompt: "Q" }] } },
      ]),
    });
    const a = reg.getAreaById("science/biology/cells");
    expect(a?.valid).toBe(true);
    expect(a?.subject).toBe("science");
    expect(a?.stages).toHaveLength(1);
    expect(a?.stages[0]?.exercise.questions).toHaveLength(1);
  });

  it("resolves referenced questions/notes/extra files relative to the area dir", () => {
    const reg = buildAreaRegistry({
      [at("brackets")]: area("B", [
        { title: "S", notes: "notes.json", exercise: { questions: "ex.json", extra: "extra.json" } },
      ]),
      "/content/math/algebra/brackets/ex.json": { questions: [{ type: "text", prompt: "Q" }] },
      "/content/math/algebra/brackets/extra.json": { questions: [{ type: "text", prompt: "E" }] },
      "/content/math/algebra/brackets/notes.json": { notes: [{ type: "heading", text: "H" }] },
    });
    const a = reg.getAreaById("math/algebra/brackets");
    expect(a?.valid).toBe(true);
    expect(a?.stages[0]?.exercise.questions).toHaveLength(1);
    expect(a?.stages[0]?.exercise.extra).toHaveLength(1);
    expect(a?.stages[0]?.notes).toHaveLength(1);
  });

  it("errors on a missing referenced questions file without throwing", () => {
    const reg = buildAreaRegistry({
      [at("brackets")]: area("B", [stage("S", "missing.json")]),
    });
    const a = reg.getAreaById("math/algebra/brackets");
    expect(a?.valid).toBe(false);
    expect(a?.errors.some((e) => e.message.includes("referenced questions file not found"))).toBe(true);
  });

  it("surfaces a superseded lesson.json as an invalid area with the migration error", () => {
    const reg = buildAreaRegistry({
      "/content/math/algebra/brackets/single-1/lesson.json": { lesson: { id: "x", title: "X" } },
    });
    const a = reg.areas[0];
    expect(a?.valid).toBe(false);
    expect(a?.errors.some((e) => e.message.includes("superseded by area.json"))).toBe(true);
  });

  it("getAreaById returns undefined for unknown ids (truthiness is not validity)", () => {
    const reg = buildAreaRegistry({
      [at("brackets")]: area("B", [stage("S", [{ type: "text", prompt: "Q" }])]),
    });
    expect(reg.getAreaById("math/algebra/brackets")?.title).toBe("B");
    expect(reg.getAreaById("nope")).toBeUndefined();
    expect(reg.getAreaById("")).toBeUndefined();
  });

  it("exposes hierarchy queries", () => {
    const reg = buildAreaRegistry({
      "/content/math/algebra/brackets/area.json": area("B", [stage("S", [{ type: "text", prompt: "Q" }])]),
      "/content/math/algebra/factoring/area.json": area("F", [stage("S", [{ type: "text", prompt: "Q" }])]),
    });
    expect(reg.getSubjects()).toEqual(["math"]);
    expect(reg.getTopics("math")).toEqual(["algebra"]);
    expect(reg.getTopicAreas("math", "algebra")).toEqual(["brackets", "factoring"]);
    expect(reg.getAreasInTopic("math", "algebra").map((a) => a.topicArea)).toEqual([
      "brackets",
      "factoring",
    ]);
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

  // The shipped Expanding Brackets area deliberately uses NO multiple-choice
  // questions (a content choice — MC remains supported in code for future use).
  // Assert on the parsed content model, not a raw substring, so referenced
  // question files and stray prose can't give a false pass/fail.
  it("the expanding-brackets area contains no multiple-choice questions", () => {
    const files: Record<string, unknown> = {};
    for (const rel of jsonFiles) {
      const key = `/content/${rel.split(/[\\/]/).join("/")}`;
      files[key] = JSON.parse(readFileSync(join(contentDir, rel), "utf8"));
    }
    const reg = buildAreaRegistry(files);
    const area = reg.getAreaById("math/algebra/expanding-brackets");
    expect(area?.valid).toBe(true);
    const allQuestions = (area?.stages ?? []).flatMap((s) => [
      ...s.exercise.questions,
      ...(s.exercise.extra ?? []),
    ]);
    expect(allQuestions.length).toBeGreaterThan(0);
    expect(allQuestions.some((q) => q.type === "multiple-choice")).toBe(false);
  });

  it.each(jsonFiles)("validates cleanly: %s", (rel) => {
    const raw = JSON.parse(readFileSync(join(contentDir, rel), "utf8"));
    const base = rel.split(/[\\/]/).pop();
    let res;
    if (base === "area.json") res = validateAreaManifest(raw, { figureSchemas });
    else if (base === "notes.json") res = validateNotesFile(raw);
    else if (raw && typeof raw === "object" && "questions" in raw)
      res = validateQuestionsFile(raw, { figureSchemas });
    // Never silently pass unrecognized content (CLAUDE.md §c rule 6): a misnamed
    // or malformed file under /content must fail this CI guard, not slip through.
    else
      res = {
        valid: false,
        errors: [
          {
            path: rel,
            message:
              "unrecognized content file — expected area.json, notes.json, or a { questions: [...] } payload",
          },
        ] as Issue[],
        warnings: [] as Issue[],
      };
    if (!res.valid) {
      throw new Error(
        `${rel} failed validation:\n` +
          res.errors.map((e) => `  - ${e.path}: ${e.message}`).join("\n"),
      );
    }
    expect(res.valid).toBe(true);
  });
});
