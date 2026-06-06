import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { validateTriangleData } from "../schema";
import { TriangleFigure } from "../render";
import { validTriangleData, invalidTriangleData } from "../fixtures";

describe("triangle-figure schema", () => {
  it("accepts the valid fixture", () => {
    expect(validateTriangleData(validTriangleData, "f")).toEqual([]);
  });

  it("rejects the invalid fixture with path-precise issues", () => {
    const issues = validateTriangleData(invalidTriangleData, "f");
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.path === "f.vertices")).toBe(true);
    expect(issues.some((i) => i.path === "f.labels")).toBe(true);
  });
});

describe("triangle-figure golden snapshot (corruption tripwire)", () => {
  // Changing how the golden fixture renders MUST fail until the snapshot is
  // deliberately updated with justification in the PR (CLAUDE.md §g).
  it("renders stable SVG markup for the golden fixture", () => {
    expect(renderToStaticMarkup(<TriangleFigure data={validTriangleData} />)).toMatchSnapshot();
  });
});
