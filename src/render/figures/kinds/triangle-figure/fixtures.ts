/** Fixtures for triangle-figure (specVersion 1). */
export const validTriangleData = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 },
  ],
  labels: ["A", "B", "C"],
  sideLabels: ["", "5 cm", ""],
  rightAngleAt: 0,
};

/** Two distinct shape violations: only 2 vertices, and wrong-length labels. */
export const invalidTriangleData = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ],
  labels: ["A", "B"],
};
