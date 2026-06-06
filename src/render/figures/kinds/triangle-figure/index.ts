import type { FigureKind } from "../../types";
import { validateTriangleData } from "./schema";
import { TriangleFigure } from "./render";

export const triangleFigureKind: FigureKind = {
  kind: "triangle-figure",
  specVersion: 1,
  schema: validateTriangleData,
  Render: TriangleFigure,
};

export { validateTriangleData } from "./schema";
export { TriangleFigure } from "./render";
