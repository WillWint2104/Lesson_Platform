# Authoring guide — Lesson Platform content

The single document a lesson-generation session needs. It indexes the JSON
contracts and every sealed figure kind. All values/conventions here are
authoritative; when in doubt, defer to the per-kind `SPEC.md`.

---

## Content hierarchy

The unit of content is the **topic area**. Content lives at
`/content/<subject>/<topic>/<topic-area>/`, and the topic-area directory contains
one `area.json` manifest plus the notes/exercise files it references (e.g.
`notes.json`, `exercise-1.json`). The hierarchy (`subject`/`topic`/`topicArea`)
is **derived from the path** — it must NOT appear in the manifest.

> The earlier per-lesson model (`lesson.json` + one lesson directory per lesson)
> is **superseded**. A `lesson.json` manifest is now a load error pointing here.

## JSON escaping (read this first)

All math uses KaTeX (`$...$` inline, `$$...$$` block). **Backslash commands must
be doubled in JSON:** write `"$\\frac{1}{2}$"`, never `"$\frac{1}{2}$"`. An
un-doubled backslash decays to a control character on parse and is a **load
error** (e.g. `\f`/`\t`/`\n` from `\frac`/`\theta`/`\neq`). Content strings are
single-line by design — structure comes from blocks, not in-string line breaks.

## Area manifest (`area.json`) — v3 stages

```json
{
  "area": {
    "title": "Expanding brackets",
    "stages": [
      {
        "title": "Single brackets",
        "notes": "notes.json",
        "video": { "src": null, "duration": null },
        "exercise": { "questions": "exercise-1.json", "extra": "exercise-1-extra.json" }
      }
    ]
  }
}
```

An area is an ordered list of **stages**. A stage = **one skill**, taught as
video → exercise and navigated as a page (Mayer segmenting principle). Notes
belong to the stage.

- **`title`** — string, required (the area and each stage).
- **`stages`** — non-empty array (empty is an error). Each stage:
  - **`notes`** (optional) — `NoteBlock[]` inline, or a path to a `notes.json`.
  - **`video`** (optional) — `{ "src": string|null, "duration": number|null }`.
    `src` is a YouTube source (`watch`/`youtu.be`/`embed` URL or bare 11-char id)
    or `null` (first-class "not recorded yet"); unparseable `src` is an error.
    `duration` is seconds or null.
  - **`exercise`** (required) — `{ "questions": …, "extra"?: … }`. `questions`
    (the **core** set) must have ≥1 question; `extra` (optional extra-practice
    pool) must have ≥1 question when present. Either may be inline or a path.

No `subject`/`topic`/`topicArea` (path-derived; their presence is an error).
**Nothing locks** — stepper navigation is free in both directions.

> The v2 `sequence` manifest and the v1 `lesson.json` are both superseded; each
> is now a load error pointing here.

## Completion & progress

- A stage **completes when every CORE question has an outcome (any outcome)** —
  completion is **never gated on correctness**.
- `extra` practice is optional and **never** changes completion.
- Stage status is display-only: **done / current / upcoming** (current = the
  first stage with an unanswered core exercise, else the last stage).

## Notes blocks (`notes.json` → `{ "notes": [ ... ] }`)

- `heading` — `{ text }`
- `paragraph` — `{ text }`
- `callout` — `{ style: "key" | "warning" | "info", text }`
- `list` — `{ items: string[] }`
- `example` — `{ prompt, answer, steps }` (preferred) **or** `{ prompt, answer, working }` (legacy)
  - `steps`: `[{ tex: string, why?: string }]` — each step is a TeX line + an
    optional one-sentence "why". `tex` must be non-empty.
  - An example must have **exactly one** of `steps` / `working`; having both is an
    error ("use steps; working is the legacy form"), and having neither is an error.

**Note-block types are APPEND-ONLY (like figure kinds).** Unknown types are
visible errors, never skipped. Future interactive/animation content arrives as
NEW registered block types with their own specVersion — never as a change to the
meaning of an existing type.

## Math emphasis — `\emA` / `\emB` (the ONLY emphasis mechanism)

Inside math, emphasise terms with two macros mapped to theme tokens:

- `\\emA{...}` — the **outside** term being distributed (green-deep).
- `\\emB{...}` — the **in-use** term it multiplies (cyan-ink).

Raw `\\textcolor` in content is a validator **warning** — always use the macros so
colour stays mapped to tokens. Example: `"\\emA{3}\\cdot \\emB{x} + \\emA{3}\\cdot \\emB{4}"`.

## Questions (`questions.json` → `{ "questions": [ ... ] }`)

Required: `type`, `prompt`. `type` ∈ `text | table | graph | geometry | multiple-choice`.
Optional: `skill`, `difficulty` (`easy|medium|hard`). **No `topic` field.**

- `multiple-choice` — `options: [{ text, isCorrect }]`, **exactly one** correct.
- `table` — `rows: string[][]` (blank cells = `""`).
- Non-MC types may carry optional reveal `answer: string` and `working: string[]`.
- **Figures** — optional `figure: { kind, specVersion?, data }` (specVersion
  defaults to 1). Deprecated `graphData`/`geometryData` aliases still work (warn).

## Instructional QA rules (hard content requirements)

1. **Remember callouts:** 1–2 per stage, **guidance only** (no worked
   arithmetic), each guarding that stage's known common mistake, phrased
   positively. **Incorrect mathematics is NEVER typeset** anywhere in notes/tips.
2. **Tips read standalone** and stay true for everything the student meets later
   in the course (no expiring heuristics).
3. **Worked examples are stepped** (`steps[{tex,why?}]`): 2 examples as standard —
   a rule demo and the stage's stumbling-block case. Each `why` explains the step
   in one sentence. Emphasis only via `\\emA` / `\\emB`.
4. **Extra pools mirror the core ramp:** same skills, fresh numbers, same
   difficulty progression (M-numbering implied by position).
5. **Every numeric example is verified** (e.g. by substitution) before shipping.

## Figure kinds (sealed; dispatched by kind + specVersion)

Each kind's `data` schema and conventions live in its `SPEC.md`:

| kind | specVersion | SPEC |
|------|-------------|------|
| `triangle-figure` | 1 | [triangle-figure/SPEC.md](../src/render/figures/kinds/triangle-figure/SPEC.md) |
| `bearing-diagram` | 1 | [bearing-diagram/SPEC.md](../src/render/figures/kinds/bearing-diagram/SPEC.md) |

Kinds are **append-only**: a semantics change ships a new `specVersion`, never an
edit to a shipped one (see CLAUDE.md §g).
