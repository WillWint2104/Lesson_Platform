/**
 * @file MathText.tsx — THE shared math renderer (CLAUDE.md §c rule 4).
 *
 * Splits a content string into plain-text and math segments and renders each:
 *   $$...$$ → display (block) math
 *   $...$   → inline math
 *   everything else → plain React text nodes (NO HTML-injection path)
 *
 * All math in the app flows through here — components must never call katex
 * directly. KaTeX renders with throwOnError: false, so a malformed expression
 * shows KaTeX's red fallback instead of crashing the tree. Only KaTeX output is
 * injected via dangerouslySetInnerHTML; authored text is never injected.
 */

import { Fragment } from "react";
import katex from "katex";

/**
 * The ONLY emphasis mechanism for math content (authoring.md): two macros mapped
 * to theme tokens via CSS classes (raw \textcolor is a validator warning).
 *   \emA{...} — outside-term emphasis (green-deep, .ktx-em-a)
 *   \emB{...} — in-use-term emphasis (cyan-ink, .ktx-em-b)
 * They expand to \htmlClass so the colour stays mapped to tokens, not hardcoded.
 */
const KATEX_MACROS = {
  "\\emA": "\\htmlClass{ktx-em-a}{#1}",
  "\\emB": "\\htmlClass{ktx-em-b}{#1}",
} as const;

// Allow ONLY \htmlClass (used by our emphasis macros); nothing else is trusted.
function trustHtmlClass(context: { command: string }): boolean {
  return context.command === "\\htmlClass";
}

export type MathSegment =
  | { type: "text"; value: string }
  | { type: "inline"; value: string }
  | { type: "display"; value: string };

/**
 * Pure segmenter — no DOM, unit-testable. Walks the string, peeling off
 * `$$...$$` (display) and `$...$` (inline) spans. An unclosed delimiter and
 * everything after it is treated as literal text (never throws).
 */
export function segmentMath(input: string): MathSegment[] {
  const segments: MathSegment[] = [];
  let i = 0;
  let textStart = 0;

  while (i < input.length) {
    if (input[i] === "$") {
      const isDisplay = input[i + 1] === "$";
      const delim = isDisplay ? "$$" : "$";
      const contentStart = i + delim.length;
      const closeIdx = input.indexOf(delim, contentStart);

      if (closeIdx === -1) {
        // Unclosed: the rest of the string (from textStart) is literal text.
        break;
      }

      if (i > textStart) {
        segments.push({ type: "text", value: input.slice(textStart, i) });
      }
      segments.push({
        type: isDisplay ? "display" : "inline",
        value: input.slice(contentStart, closeIdx),
      });
      i = closeIdx + delim.length;
      textStart = i;
    } else {
      i += 1;
    }
  }

  if (textStart < input.length) {
    segments.push({ type: "text", value: input.slice(textStart) });
  }
  return segments;
}

export interface MathTextProps {
  children: string;
}

/** Render a content string with inline/display math through KaTeX. */
export function MathText({ children }: MathTextProps) {
  const segments = segmentMath(children);

  return (
    <>
      {segments.map((seg, index) => {
        if (seg.type === "text") {
          // Plain authored text: a React text node, never injected HTML.
          return <Fragment key={index}>{seg.value}</Fragment>;
        }
        const html = katex.renderToString(seg.value, {
          throwOnError: false,
          displayMode: seg.type === "display",
          macros: { ...KATEX_MACROS },
          trust: trustHtmlClass,
          strict: false,
        });
        // Both wrappers are spans (display is block-level via CSS) so that
        // display math nested inside a <p> stays valid HTML — a <div> inside a
        // paragraph would be hoisted out by the browser, splitting the text.
        const className = seg.type === "display" ? "mathtext-display" : "mathtext-inline";
        return (
          <span key={index} className={className} dangerouslySetInnerHTML={{ __html: html }} />
        );
      })}
    </>
  );
}
