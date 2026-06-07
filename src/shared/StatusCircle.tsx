/**
 * @file StatusCircle.tsx — THE shared state-motif (design-language §6).
 *
 * One circular indicator, reused identically everywhere a state is shown:
 * topic-card area rows, worksheet answered indicators, and area segment headers.
 * Variants: `check` (done) / `play-ring` (current) / `number` (upcoming) /
 * `lock` (locked) / `dot` (attempted-incorrect). Sizes `sm` (28) / `md` (36).
 *
 * Depth follows §1: the circle is FLAT by default (an informational indicator);
 * pass `pressable` only when the circle itself is the interactive affordance, so
 * it gets the chunky 2px + bottom-edge construction.
 */
import type { ReactNode } from "react";
import { Check, Circle, Lock, Play } from "lucide-react";

export type StatusVariant = "check" | "play-ring" | "number" | "lock" | "dot";
export type StatusSize = "sm" | "md";

export interface StatusCircleProps {
  variant: StatusVariant;
  /** Accessible label (the icon itself is decorative). */
  label: string;
  size?: StatusSize;
  /** For the `number` variant. */
  value?: number;
  /** §1: render with chunky depth only when the circle is itself interactive. */
  pressable?: boolean;
}

const ICON_PX: Record<StatusSize, number> = { sm: 16, md: 18 };

export function StatusCircle({
  variant,
  label,
  size = "md",
  value,
  pressable = false,
}: StatusCircleProps) {
  const px = ICON_PX[size];
  const className = [
    "status-circle",
    `status-circle--${size}`,
    `status-circle--${variant}`,
    pressable ? "status-circle--pressable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  let inner: ReactNode;
  switch (variant) {
    case "check":
      inner = <Check size={px} strokeWidth={3} aria-hidden="true" />;
      break;
    case "play-ring":
      inner = <Play size={px} fill="currentColor" aria-hidden="true" />;
      break;
    case "lock":
      inner = <Lock size={px} aria-hidden="true" />;
      break;
    case "dot":
      inner = <Circle size={px} fill="currentColor" aria-hidden="true" />;
      break;
    case "number":
      inner = <span aria-hidden="true">{value ?? ""}</span>;
      break;
  }

  return (
    <span className={className} role="img" aria-label={label}>
      {inner}
    </span>
  );
}
