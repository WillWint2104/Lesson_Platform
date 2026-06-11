/**
 * @file index.ts — barrel for the v2 shared primitives (design-language-v2).
 *
 * The locked v2 building blocks: grid canvas, mint-strip panel, card, the
 * rounded button language, the result bar, and the canonical SVG icon set.
 * Screens migrate onto these PR-by-PR; this PR only ships the primitives.
 */
export { GridCanvas } from "./GridCanvas";
export type { GridCanvasProps } from "./GridCanvas";
export { Panel } from "./Panel";
export type { PanelProps } from "./Panel";
export { Card } from "./Card";
export type { CardProps } from "./Card";
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant } from "./Button";
export { ResultBar } from "./ResultBar";
export type { ResultBarProps, ResultState } from "./ResultBar";
export { EnlargedDialog } from "./EnlargedDialog";
export type { EnlargedDialogProps } from "./EnlargedDialog";
export * from "./icons";
