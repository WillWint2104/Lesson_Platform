# Authoring guide — Lesson Platform content

The single document a lesson-generation session needs. It indexes the JSON
contracts and every sealed figure kind. All values/conventions here are
authoritative; when in doubt, defer to the per-kind `SPEC.md`.

---

## Content hierarchy

Content lives at `/content/<subject>/<topic>/<topic-area>/<lesson-id>/`, each
lesson directory containing `lesson.json`, `notes.json`, `questions.json`. The
hierarchy (`subject`/`topic`/`topicArea`) is **derived from the path** — it must
NOT appear in the manifest.

## JSON escaping (read this first)

All math uses KaTeX (`$...$` inline, `$$...$$` block). **Backslash commands must
be doubled in JSON:** write `"$\\frac{1}{2}$"`, never `"$\frac{1}{2}$"`. An
un-doubled backslash decays to a control character on parse and is a **load
error** (e.g. `\f`/`\t`/`\n` from `\frac`/`\theta`/`\neq`). Content strings are
single-line by design — structure comes from blocks, not in-string line breaks.

## Lesson manifest (`lesson.json`)

```json
{ "lesson": { "id": "...", "title": "...", "order": 1, "video": { "src": "...", "duration": null }, "notes": "notes.json", "questions": "questions.json" } }
```
`notes`/`questions` are an inline array or a path relative to the lesson dir.
No `subject`/`topic`/`topicArea` (path-derived). Optional `order` (integer)
sorts lessons within a topic area (ties/absences fall back to id-alphabetical).

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
