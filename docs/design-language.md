# Design Language — Cohesion Rules (v1)

Destination: /docs/design-language.md. These rules are absolute; exceptions require a recorded decision. CodeRabbit instructions should reference this file.

## 1. Depth = pressable (the affordance rule)
The chunky construction (2px border + 4–5px bottom edge) is reserved for INTERACTIVE elements: buttons, pills, tappable cards/rows, MC options, answer icons, status circles that navigate.
Informational surfaces (stat cards, notes blocks, locked cards, banners, worked-solution modals) use a flat 1.5px border (--border), no bottom edge.
Test: if clicking it does nothing, it must not look pressed-able.

## 2. Type system (six styles, frozen)
Jakarta = voice (headings, labels, buttons); Manrope = prose. Tokens, never raw values:
- display: Jakarta 800, 26px / 1.2 — page greeting/title only, one per page
- title: Jakarta 800, 17px / 1.3 — hero titles, modal titles, area/section page titles
- card-title: Jakarta 700, 14.5px / 1.35 — card and row headers
- label: Jakarta 700, 11px / 1.2, letter-spacing 1px, uppercase, --faint — kickers and section labels
- body: Manrope 500, 13.5px / 1.55 — prose, notes, question prompts (math inherits)
- meta: Manrope 600, 11.5px / 1.4, --muted — counts, statuses, timestamps
No other sizes/weights. A new need = a recorded extension of this list, not an inline value.

## 3. Rhythm chain (spacing is mathematical)
4px base. The chain: body 13.5 → line-height ~21 → gap within a group 12 → gap between cards 16 → gap between sections 32 → gap between zones/page bands 48.
All components draw from this chain. Internal card padding: 16px always. Grid gutters: 16px.

## 4. Card anatomy (one recipe)
Every card: radius 16; padding 16; optional header row = [icon tile 36×36, radius 11] [card-title + meta stacked] [right-aligned accent figure]; body below; at most ONE accent colour per card. Variants differ by content, never by anatomy.

## 5. Colour roles (one job each)
- Green: actions and progress. The only CTA colour. Never decorative.
- Gold: rewards, difficulty, checkpoints. Never actions.
- Cyan: informational/hints. Never actions.
- Coral: errors/incorrect only.
- Brand ink (#1a4d35): headings/wordmark. Studio mint: dark surfaces only (video stage).
One element type per colour-job per screen wherever possible (visual echo: users learn "green = do this").

## 6. Visual echoes (repeat the motifs)
The status circle (check / play-ring / number / lock) is THE state motif — reused identically in topic-card area rows, rail "up next", worksheet answered indicators, and segment headers. Small-caps labels are THE section device — every zone/section opens with one. The icon set is one library (lucide), 16–18px, --muted unless carrying semantic colour per §5.

## 7. Page bands (structure)
Every page: sticky app bar (full-width white surface, container-aligned content) → content zones on the container grid (main 2fr / rail 1fr where a rail exists; rail collapses below 920px) → footer pinned to viewport bottom (min-height 100svh flex column). Backgrounds fill the viewport; only content is width-constrained.

## 8. Functional consistency
Same action, same result, same look everywhere: dismissals look alike, locked states look alike, "open/continue" affordances look alike. A pattern introduced once is the pattern forever (or gets a recorded redesign).
