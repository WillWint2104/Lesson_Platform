import type { FigureKind } from "../../types";
import { validateBearingData } from "./schema";
import { BearingDiagram } from "./render";

export const bearingDiagramKind: FigureKind = {
  kind: "bearing-diagram",
  specVersion: 1,
  schema: validateBearingData,
  Render: BearingDiagram,
};

export { validateBearingData } from "./schema";
export { BearingDiagram } from "./render";
