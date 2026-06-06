import { describe, it, expect } from "vitest";
import { computeUnlockStates } from "@/app/unlock";

const statuses = (completed: boolean[]) => computeUnlockStates(completed).map((s) => s.status);

describe("computeUnlockStates", () => {
  it("makes the first lesson current when nothing is done", () => {
    expect(statuses([false, false, false])).toEqual(["current", "locked", "locked"]);
  });

  it("marks completed lessons done and the next incomplete one current", () => {
    expect(statuses([true, false, false])).toEqual(["done", "current", "locked"]);
  });

  it("treats an all-complete set as all done (no current)", () => {
    expect(statuses([true, true])).toEqual(["done", "done"]);
  });

  it("assigns exactly one current even with a gap", () => {
    // i0 incomplete → current; i1 done; i2 incomplete but current already taken.
    expect(statuses([false, true, false])).toEqual(["current", "done", "locked"]);
  });

  it("reports unlocked (openable) for done and current, not locked", () => {
    expect(computeUnlockStates([true, false, false]).map((s) => s.unlocked)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("handles an empty set", () => {
    expect(computeUnlockStates([])).toEqual([]);
  });
});
