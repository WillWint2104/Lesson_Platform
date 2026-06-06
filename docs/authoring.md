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

## Area manifest (`area.json`)

```json
{
  "area": {
    "title": "Expanding brackets",
    "notes": "notes.json",
    "sequence": [
      { "type": "video", "title": "Single brackets", "src": null },
      { "type": "exercise", "title": "Practice: single brackets", "questions": "exercise-1.json" },
      { "type": "video", "title": "Double brackets", "src": "https://youtu.be/abc123def45" },
      { "type": "exercise", "title": "Practice: double brackets", "questions": "exercise-2.json" }
    ]
  }
}
```

An area is **notes + an ordered `sequence` of pulses**. The teaching rhythm is
video → exercise → video → exercise, but **any mix and order is legal** (e.g. two
videos in a row, or an exercise with no preceding video).

- **`title`** — string, required.
- **`notes`** — a `NoteBlock[]` inline array, or a path (relative to the area
  dir) to a `notes.json`. An area with no notes is allowed but **warns**.
- **`sequence`** — ordered array of segments; **must be non-empty** (empty is an
  error). Each segment is one of:
  - **`video`** — `{ "type": "video", "title", "src": string | null }`. `src` is
    a YouTube source (a `watch`/`youtu.be`/`embed` URL or a bare 11-char id) or
    `null`. `null` is a first-class "authored before the video was recorded"
    state (generation may run ahead of studio recording); an **unparseable** src
    is an error. All parsing goes through `parseYouTubeId`.
  - **`exercise`** — `{ "type": "exercise", "title", "questions": Question[] | string }`.
    `questions` is an inline array or a path (relative to the area dir) to a
    `questions.json`. An exercise **must have ≥1 question** (zero is an error).

No `subject`/`topic`/`topicArea` (path-derived; their presence is an error).
Within an area, **exercise segments unlock sequentially** (an exercise opens once
every earlier exercise is complete); video segments never block.

## Notes blocks (`notes.json` → `{ "notes": [ ... ] }`)

- `heading` — `{ text }`
- `paragraph` — `{ text }`
- `example` — `{ prompt, working: string[], answer }`
- `callout` — `{ style: "key" | "warning" | "info", text }`
- `list` — `{ items: string[] }`

## Questions (`questions.json` → `{ "questions": [ ... ] }`)

Required: `type`, `prompt`. `type` ∈ `text | table | graph | geometry | multiple-choice`.
Optional: `skill`, `difficulty` (`easy|medium|hard`). **No `topic` field.**

- `multiple-choice` — `options: [{ text, isCorrect }]`, **exactly one** correct.
- `table` — `rows: string[][]` (blank cells = `""`).
- Non-MC types may carry optional reveal `answer: string` and `working: string[]`.
- **Figures** — optional `figure: { kind, specVersion?, data }` (specVersion
  defaults to 1). The deprecated `graphData`/`geometryData` aliases still work
  (with a warning) but new content uses `figure`.

## Figure kinds (sealed; dispatched by kind + specVersion)

Each kind's `data` schema and conventions live in its `SPEC.md`:

| kind | specVersion | SPEC |
|------|-------------|------|
| `triangle-figure` | 1 | [triangle-figure/SPEC.md](../src/render/figures/kinds/triangle-figure/SPEC.md) |
| `bearing-diagram` | 1 | [bearing-diagram/SPEC.md](../src/render/figures/kinds/bearing-diagram/SPEC.md) |

Kinds are **append-only**: a semantics change ships a new `specVersion`, never an
edit to a shipped one (see CLAUDE.md §g).
