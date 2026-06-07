import { describe, it, expect } from "vitest";
import {
  computeStageStatus,
  currentStageIndex,
  isAreaComplete,
  type StageInput,
} from "@/app/unlock";

const s = (complete: boolean): StageInput => ({ complete });

describe("computeStageStatus", () => {
  it("done for complete, current for the first incomplete, upcoming after", () => {
    expect(computeStageStatus([s(true), s(false), s(false)])).toEqual([
      "done",
      "current",
      "upcoming",
    ]);
  });

  it("nothing locks — a later complete stage stays 'done' (free navigation)", () => {
    expect(computeStageStatus([s(false), s(true), s(false)])).toEqual([
      "current",
      "done",
      "upcoming",
    ]);
  });

  it("all complete → all done (no current)", () => {
    expect(computeStageStatus([s(true), s(true)])).toEqual(["done", "done"]);
  });
});

describe("currentStageIndex", () => {
  it("is the first incomplete stage", () => {
    expect(currentStageIndex([s(true), s(false), s(false)])).toBe(1);
  });
  it("is the last stage when everything is complete", () => {
    expect(currentStageIndex([s(true), s(true)])).toBe(1);
  });
  it("is 0 for an empty area", () => {
    expect(currentStageIndex([])).toBe(0);
  });
});

describe("isAreaComplete", () => {
  it("is true only when every stage is complete (≥1 stage)", () => {
    expect(isAreaComplete([s(true), s(true)])).toBe(true);
    expect(isAreaComplete([s(true), s(false)])).toBe(false);
    expect(isAreaComplete([])).toBe(false);
  });
});
