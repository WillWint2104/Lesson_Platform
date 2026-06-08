/**
 * @file Card.tsx — a card inside a panel (design-language-v2 §4).
 *
 * White, line border, 12px radius. Cards live IN a panel, never scattered on
 * the canvas. Content-agnostic: variants differ by content, never anatomy.
 */
import type { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return <div className={["v2-card", className].filter(Boolean).join(" ")}>{children}</div>;
}
