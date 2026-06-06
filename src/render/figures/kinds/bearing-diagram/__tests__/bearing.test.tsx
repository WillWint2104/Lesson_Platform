import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { validateBearingData } from "../schema";
import { BearingDiagram, threeFigureBearing } from "../render";
import { validBearingData, invalidBearingData } from "../fixtures";

describe("bearing-diagram schema", () => {
  it("accepts the valid fixture", () => {
    expect(validateBearingData(validBearingData, "f")).toEqual([]);
  });

  it("rejects the invalid fixture with path-precise issues", () => {
    const issues = validateBearingData(invalidBearingData, "f");
    expect(issues.some((i) => i.path === "f.points[0]")).toBe(true);
    expect(issues.some((i) => i.path.startsWith("f.bearings[0]"))).toBe(true);
  });
});

describe("three-figure bearing labels", () => {
  it("zero-pads to three digits with a degree sign", () => {
    expect(threeFigureBearing(45)).toBe("045°");
    expect(threeFigureBearing(7)).toBe("007°");
    expect(threeFigureBearing(360)).toBe("000°");
  });
});

describe("bearing-diagram golden snapshot (corruption tripwire)", () => {
  it("renders stable SVG markup for the golden fixture", () => {
    expect(renderToStaticMarkup(<BearingDiagram data={validBearingData} />)).toMatchSnapshot();
  });
});
