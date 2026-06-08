# Design Language & Authoring Spec — v2 (Studio-matched Khan-light)

Status: locked direction. Supersedes the v1 light design-language doc. This is the single source of truth for the re-theme; every screen executes against it. Mockups that realise this spec: `khan-lesson-page-v5.html` (lesson), `exercise-redesign-v6.html` (exercise), `expanded-card-and-solution.html` (focus/solution).

---

## 1. Direction & principles
- **Structure = Khan Academy**: subject → topic → area(unit) → stage(lesson) → video + exercise + mastery. Content-first, clutter stripped.
- **Skin = our studio**: a light, cool, grid-textured canvas with white panels carrying a lime header strip; mint used as an accent only. The recorded (dark) videos sit in this world and belong.
- **Cohesion is enforced by tokens, not taste**: one token system, reused everywhere. If a value isn't a token below, it doesn't go in.
- **Restraint is the aesthetic**: one green scale, one red, one rounded shape language, real icons (never emoji).

---

## 2. Design tokens (exact)
```
--page:      #eef1f4   /* canvas base */
--grid:      rgba(33,40,55,.045)  /* grid lines on canvas */
--surface:   #ffffff   /* panels, cards, sidebar, chrome */
--line:      #e3e6eb   /* primary borders */
--line-2:    #eef0f3   /* hairline dividers, inner borders */
--ink:       #1c2026   /* primary text, math */
--body:      #3a414b   /* body copy */
--muted:     #5b6470   /* secondary text, labels */
--faint:     #8b94a0   /* tertiary text, placeholders */

/* ONE green scale (single hue, used by lightness) */
--mint-strip:#b9f5d6   /* the lime header strip on every panel/video */
--mint:      #cdeede   /* fills: number badges, primary buttons */
--mint-tint: #edfbf4   /* faint backgrounds: correct result, tints */
--mint-line: #a8e0c4   /* mint borders */
--qline:     #cfeadd   /* question-box outline (mint, lighter) */
--mint-ink:  #1c6b43   /* text/icon on mint, accents */

/* ONE red (incorrect only) */
--red:       #c4625b
--red-tint:  #fbeceb
--red-line:  #eec4c1
```

### Colour rules (hard)
- **Green = accent only, never dominant.** No green-filled hero blocks, no green body/nav text.
- **No green-on-green text** and **no grey-on-grey text.** Body text lives on white; result answers render in `--ink`.
- **Grey is reserved for disabled states** (e.g. a locked Solution button). Don't use grey fills for question boxes or inputs — those are white.
- **Red is for an incorrect result only.**

---

## 3. Typography
- **Plus Jakarta Sans** (600/700/800): headings, titles, UI labels, buttons, number badges.
- **Manrope** (400–700): body copy, instructions, list text.
- **JetBrains Mono** (500/700): micro-labels and meta (e.g. `12 QUESTIONS`, `THE RULE`, `EASY → HARD`), letter-spacing ~1–1.5px, colour `--muted`.
- **Math**: KaTeX. Variables render serif-italic (KaTeX default). In mocks this is approximated with Georgia italic; **production must use KaTeX for all math**.

---

## 4. Surfaces & layout primitives
- **Chrome / sidebar**: `--surface` white, `--line` divider. The contents sidebar (288px) is the primary nav: unit title + progress bar, then per-stage groups (`1 · SINGLE BRACKETS`) each listing Video + Exercise items with a status circle and a meta (`6 min` / `4 Q`). Active item = `--mint-tint` bg + `inset 3px 0 0 --mint-line` + bold.
- **Canvas**: `--page` with the grid motif — `linear-gradient(--grid 1px,transparent 1px)` both axes, `background-size:30px 30px`. All working content sits on this.
- **Panel**: white, `--line` border, radius 14–16px, soft shadow `0 6px 20px rgba(33,40,55,.06)`, with an **8px `--mint-strip` header strip** at the very top (the signature). Panels hold content; nothing floats on the bare canvas.
- **Card** (inside a panel): white, `--line` border, radius 12px. Cards live *in* a panel, never scattered on the canvas.
- **Status circle** (sidebar): 18px, `--line` border; done = `--mint-line` fill + check; current = `--mint-line` border + `--mint-ink`.

---

## 5. Shape & icon language
- **Radii**: panels 14–16 · cards 12 · boxes/inputs/buttons 9–10 · badges 7–8 · strip height 8. Use these, not arbitrary values.
- **Icons are inline SVG, never emoji.** Canonical set (1.3–1.6 stroke, `currentColor`): expand (diagonal out-arrows), solution (lightbulb), close (×), chevron-left, chevron-right, plus, lock, and the result marks (✓ / ✕ rendered as glyphs or SVG, colour from `--mint-ink` / `--red`).

---

## 6. Math rendering
- All math via **KaTeX**.
- **Fractions are always stacked `\frac{}{}`** — never the unicode ½/⅓ slanted glyphs. A leading coefficient like ½ before a bracket renders as a proper vertical fraction, vertically centred against the bracket.
- Variables italic; multiplication shown as `×` in worked steps.
- Emphasis macros retained: `\emA` (green) and `\emB` (cyan), only inside worked-example steps, only on correct math.

---

## 7. Component specs

### 7a. Lesson / stage page (`khan-lesson-page-v5.html`)
- Top bar (white): brand · breadcrumb (`Algebra › Expanding Brackets`) · mastery % · avatar. Sidebar as in §4.
- Main on grid canvas, plain text title row `Single brackets · Lesson n of N` (or fold into panel — see exercise).
- **Video band on top, full width**, alone on its row (never beside variable-height notes — this is gap-proof for every stage). White panel + mint strip + dark 16:9 video; play button = `--mint` circle, `--mint-ink` icon; caption row (title · `6 min · watch first`). Optional `max-height` on the video element is the only lever if a full-width video is too tall — never re-cap the card width.
- **Notes: one panel + mint strip, two internal columns.** Left column: `THE RULE` (mono label, heading, prose, **formula box sized to its contents** — `inline-block`, mint-tint bg, `--ink` text) + `REMEMBER` (callout, mint left-border). Right column: `WORKED EXAMPLES` — Example 1 / Example 2 tabs, numbered steps each with a **why?** toggle, then an explicit **ANSWER** row (`--ink` on mint-tint). Collapses to one column < 920px.
- Footer: `Up next · Exercise 1` with a single primary (mint) action.

### 7b. Exercise page (`exercise-redesign-v6.html`)
- Sidebar + grid canvas. **No extra top/bottom bars.**
- **One worksheet panel + mint strip.** Header *inside* the panel: title `Single brackets · Exercise 1 of 3` + `12 QUESTIONS` (mono) + instruction line. The title is never stranded on the canvas.
- Inside the panel, a responsive grid of **question cards** (`minmax(248px,1fr)`), contained by the panel (not floating). Each card:
  - header row: mint **number badge** (left) + **expand** icon (right),
  - **question box**: white with a `--qline` mint outline, expression centred (structured to match the controls below it),
  - **answer field**: white, `--line` border, placeholder `Your answer…`,
  - **Solution button** on every card: full-width, rounded, `--mint`/`--mint-ink`; **disabled (grey) until an answer is entered**.
- **More practice** footer: optional pool, same skill, fresh numbers; never affects completion.
- Many small questions (they expand) — weighted easy/medium (see §9).

### 7c. Expanded / focus view (`expanded-card-and-solution.html`)
Tapping a card's expand icon enlarges that question in place: worksheet **dims + blurs** behind a scrim; a centred card (mint strip) rises with prev/next at the foot. Three states:
1. **Unanswered**: question box + answer field + Check + **locked** Solution (grey, lock icon, hint "Enter your answer to unlock the solution"). Reaching a question via prev/next shows this state — the solution never auto-opens.
2. **Answered**: result bar + active Solution button.
3. **Solution**: working first, answer last — numbered steps with why? toggles, explicit ANSWER. Student's own result stays visible for comparison.

### 7d. Result indicator
A rounded bar matching the buttons (not a circle). Correct = `--mint-tint` bg + `inset 3px 0 0 --mint-line` + a small `--mint-ink` ✓ + label `Correct`. Incorrect = `--red-tint` + red edge + small red ✕ + label **`Incorrect`**. The student's answer always renders in `--ink` (readable). Colour lives on the edge + mark only.

---

## 8. Behaviour rules
- **Answer entry + check**: the student types their *final answer* (working stays on paper). Checking is **algebraic equivalence** (e.g. `math.js` `simplify` + compare) so `4x+12`, `12+4x`, `4(x+3)` all pass. **Client-side, no API, no backend, $0** — works on static hosting.
- **Lock unlocks the solution**, per question. The solution is **never shown until an answer is entered for that question — including when navigating via prev/next** (gating is a property of the question's own state, not of how you arrived).
- **The result is the mark.** No honour-system self-mark (the old Got it / Not yet is removed). Correct/Incorrect comes from the check.
- **Wording is `Incorrect`, not "Try again"** — there is no retake mechanism; don't imply one.
- **Completion**: a stage's core exercise is complete when every core question has an answer entered (correct or not). Wrong answers never gate progression; the solution is always available after answering. Extra/More-practice never affects completion.
- **Difficulty is hidden from students** but authored and stored as a tag (`easy|medium|hard`) so a future teacher mode can break performance down by difficulty. Never render difficulty in the student UI.
- **Teacher analytics across students is out of scope here** — it requires a backend (DB + API + identity) and carries minor-privacy obligations (consent, AU Privacy Act / COPPA-style). The answer-lock records results locally so the data is ready to sync when that project is built.

---

## 9. Authoring rules
- **Easy/medium dominant.** Per skill, easy and medium are the bulk (redundancy for practice); **hard is optional and rare** — some skills may have none. Ramp easy → hard.
- **No skill creep.** Every question must be solvable using only the current stage's skill (plus earlier stages). Nothing that needs a not-yet-taught technique (e.g. a single-brackets exercise must not require collecting like terms or double brackets).
- **Fractions authored as `\frac`.**
- **Remember tips**: 1–2, guidance-only (no worked arithmetic), each guards that stage's common mistake, positive only (never typeset incorrect math), and must generalise beyond the current stage.
- **Worked examples**: two standard per stage (a rule demo + a stumbling-block case), stepped `{tex, why?}`, with an explicit answer; emphasis only via `\emA`/`\emB`.
- **Verify every numeric example by substitution before shipping.**
- **Each question carries a canonical answer** (for the equivalence check) and a hidden `difficulty` tag.

---

## 10. Future variants (spec when reached, not now)
- **Graph questions**: interactive plot + answer capture — own component spec.
- **Table-of-values questions**: grid input — own component spec.
- **Alternative note/example themes**: the lesson notes panel may need variant layouts for richer content types (diagrams, multi-part derivations). The two-column notes panel is the default; variants extend it.
These reuse the tokens, surfaces, and shape/icon language above; only their internal structure differs.

---

## 11. Accessibility
- Contrast: enforce §2 colour rules (no green-on-green, no grey-on-grey; answers in `--ink`).
- Grey only signals disabled.
- Visible focus indicators on all interactive elements (inputs, buttons, expand, prev/next, tabs, why toggles).
- Focus view is a proper dialog (`role=dialog`, `aria-modal`, focus trap + restore, Esc to close), prev/next keyboard-operable.
- KaTeX accessible output where feasible.

---

## 12. Migration from the current app
- **Theme swap**: replace the v1 light surfaces with §2 tokens, the grid canvas, white mint-strip panels, and the green scale.
- **Lesson page**: move to video-band-on-top (full width) + two-column notes panel; both panels carry the strip.
- **Exercise page**: new worksheet panel + question-card structure; difficulty hidden in UI.
- **Behaviour change (functional, not just theme)**: remove honour self-mark; add answer-entry + equivalence check + lock-unlocks-solution; record `{answer, correct}` per question in the progress store (replacing the self-mark outcome); add the `math.js` dependency; `Incorrect` wording; per-question solution gating including prev/next.
- **Contract change**: each question gains a canonical `answer` and a hidden `difficulty`. (MC is already removed.)
- Keep the figure-kind registry; re-snapshot goldens that touch themed surfaces.
