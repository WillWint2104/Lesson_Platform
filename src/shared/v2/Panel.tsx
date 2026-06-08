/**
 * @file Panel.tsx — the v2 signature surface (design-language-v2 §4).
 *
 * A white panel with the 8px mint header strip at the very top. Panels hold
 * content; nothing floats on the bare canvas. The strip is decorative chrome.
 * Pass `bodyless` to manage inner padding yourself (e.g. a worksheet header that
 * spans full width); otherwise children sit in a padded body.
 */
import type { ReactNode } from "react";

export interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Render children directly under the strip (no padded body wrapper). */
  bodyless?: boolean;
}

export function Panel({ children, className, bodyless = false }: PanelProps) {
  return (
    <div className={["v2-panel", className].filter(Boolean).join(" ")}>
      <div className="v2-panel__strip" aria-hidden="true" />
      {bodyless ? children : <div className="v2-panel__body">{children}</div>}
    </div>
  );
}
