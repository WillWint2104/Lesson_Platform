import { describe, it, expect } from "vitest";
import { validateQuestionsFile } from "@/ingest/validate";
import { resolveFigure } from "@/ingest/figure";
import { figureSchemas } from "@/render/figures/registry";

const qfile = (questions: unknown[]) => ({ questions });

describe("resolveFigure", () => {
  it("returns the canonical figure with an explicit specVersion", () => {
    const r = resolveFigure({ figure: { kind: "triangle-figure", data: {} } });
    expect(r.source).toBe("figure");
    expect(r.figure).toEqual({ kind: "triangle-figure", specVersion: 1, data: {} });
  });

  it("maps legacy graphData → function-graph", () => {
    const r = resolveFigure({ graphData: { foo: 1 } });
    expect(r.source).toBe("graphData");
    expect(r.figure?.kind).toBe("function-graph");
  });

  it("maps legacy geometryData triangle → triangle-figure", () => {
    const r = resolveFigure({ geometryData: { shape: "triangle", base: 6, height: 4 } });
    expect(r.source).toBe("geometryData");
    expect(r.figure?.kind).toBe("triangle-figure");
  });

  it("returns none when there is no figure", () => {
    expect(resolveFigure({ type: "text" }).source).toBe("none");
  });
});

describe("figure envelope validation", () => {
  it("errors on a figure missing kind", () => {
    const res = validateQuestionsFile(qfile([{ type: "geometry", prompt: "p", figure: { data: {} } }]));
    expect(res.valid).toBe(false);
    expect(
      res.errors.some((e) => e.path === "questions[0].figure" && e.message.includes("'kind'")),
    ).toBe(true);
  });

  it("errors on non-object data", () => {
    const res = validateQuestionsFile(
      qfile([{ type: "geometry", prompt: "p", figure: { kind: "triangle-figure", data: 5 } }]),
    );
    expect(res.errors.some((e) => e.message.includes("'data' must be an object"))).toBe(true);
  });

  it("errors on a non-integer specVersion", () => {
    const res = validateQuestionsFile(
      qfile([{ type: "geometry", prompt: "p", figure: { kind: "triangle-figure", specVersion: 1.5, data: {} } }]),
    );
    expect(res.errors.some((e) => e.message.includes("specVersion"))).toBe(true);
  });
});

describe("per-kind schema validation (with the registry)", () => {
  it("surfaces path-precise triangle data errors", () => {
    const res = validateQuestionsFile(
      qfile([{ type: "geometry", prompt: "p", figure: { kind: "triangle-figure", specVersion: 1, data: { vertices: [{ x: 0, y: 0 }] } } }]),
      { figureSchemas },
    );
    expect(res.valid).toBe(false);
    expect(
      res.errors.some(
        (e) => e.path === "questions[0].figure.data.vertices" && e.message.includes("exactly 3"),
      ),
    ).toBe(true);
  });

  it("accepts valid triangle data", () => {
    const res = validateQuestionsFile(
      qfile([
        {
          type: "geometry",
          prompt: "p",
          figure: {
            kind: "triangle-figure",
            specVersion: 1,
            data: { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] },
          },
        },
      ]),
      { figureSchemas },
    );
    expect(res.valid).toBe(true);
  });

  it("warns (not errors) when a kind has no registered schema", () => {
    const res = validateQuestionsFile(
      qfile([{ type: "geometry", prompt: "p", figure: { kind: "function-graph", specVersion: 1, data: {} } }]),
      { figureSchemas },
    );
    expect(res.valid).toBe(true);
    expect(res.warnings.some((w) => w.message.includes("no schema registered"))).toBe(true);
  });
});

describe("deprecation aliases warn but stay valid (back-compat)", () => {
  it("warns on graphData", () => {
    const res = validateQuestionsFile(qfile([{ type: "graph", prompt: "p", graphData: { points: [] } }]));
    expect(res.valid).toBe(true);
    expect(res.warnings.some((w) => w.message.includes("'graphData' is deprecated"))).toBe(true);
  });

  it("warns on geometryData and does NOT re-validate it against the new schema", () => {
    const res = validateQuestionsFile(
      qfile([{ type: "geometry", prompt: "p", geometryData: { shape: "triangle", base: 6, height: 4 } }]),
      { figureSchemas },
    );
    expect(res.valid).toBe(true);
    expect(res.warnings.some((w) => w.message.includes("'geometryData' is deprecated"))).toBe(true);
  });
});
