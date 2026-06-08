/**
 * @file icons.tsx — the canonical v2 SVG icon set (design-language-v2 §5).
 *
 * Icons are INLINE SVG, never emoji. One library, one style: 24x24 viewBox,
 * `fill="none"`, `stroke="currentColor"`, 1.5 stroke, round caps/joins. Colour
 * comes from `currentColor` (the call site), per §5. The result marks (Check /
 * Cross) are the only ones that also read a semantic colour from the call site
 * (`--mint-ink` / `--red`).
 *
 * Accessibility: an icon is DECORATIVE by default (`aria-hidden`); pass `title`
 * to promote it to a labelled image (`role="img"` + <title>).
 */
import type { ReactNode } from "react";

export interface IconProps {
  /** Pixel size (width = height). Default 18 (§5: 16–18). */
  size?: number;
  className?: string;
  /** When set, the icon becomes a labelled image; otherwise it is decorative. */
  title?: string;
}

function Svg({ size = 18, className, title, children }: IconProps & { children: ReactNode }) {
  const labelled = typeof title === "string" && title.length > 0;
  return (
    <svg
      className={["v2-icon", className].filter(Boolean).join(" ")}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={labelled ? "img" : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : "true"}
      focusable="false"
    >
      {labelled ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Expand — diagonal out-arrows (enlarge a question in place). */
export function ExpandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </Svg>
  );
}

/** Solution — lightbulb. */
export function SolutionIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.2 1 2.5h6c0-1.3.3-1.8 1-2.5A6 6 0 0 0 12 3Z" />
    </Svg>
  );
}

/** Close — × (also used as the dialog dismiss). */
export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Svg>
  );
}

/** Chevron-left — previous. */
export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

/** Chevron-right — next. */
export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

/** Plus — add / more. */
export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

/** Lock — a gated (disabled) solution. */
export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

/** Check — a correct result mark (semantic colour from the call site). */
export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 6L9 17l-5-5" />
    </Svg>
  );
}

/** Cross — an incorrect result mark (semantic colour from the call site). */
export function CrossIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </Svg>
  );
}

/** The canonical set, for iteration in tests / pickers. */
export const V2_ICONS = {
  expand: ExpandIcon,
  solution: SolutionIcon,
  close: CloseIcon,
  "chevron-left": ChevronLeftIcon,
  "chevron-right": ChevronRightIcon,
  plus: PlusIcon,
  lock: LockIcon,
  check: CheckIcon,
  cross: CrossIcon,
} as const;

export type V2IconName = keyof typeof V2_ICONS;
