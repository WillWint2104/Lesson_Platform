/** Fixtures for bearing-diagram (specVersion 1). */
export const validBearingData = {
  points: [
    { id: "A", x: 0, y: 0, label: "Harbour" },
    { id: "B", x: 3, y: 4, label: "Buoy" },
  ],
  bearings: [{ from: "A", to: "B", degrees: 37 }],
};

/** Violations: a point missing `y`, and a bearing referencing an unknown id
 * with an out-of-range angle. */
export const invalidBearingData = {
  points: [{ id: "A", x: 0 }],
  bearings: [{ from: "A", to: "Z", degrees: 400 }],
};
