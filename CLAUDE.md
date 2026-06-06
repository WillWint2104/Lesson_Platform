# CLAUDE.md — Lesson Platform

This file is the durable project anchor. It is meant to survive context wipes: if you
are an agent picking this project up cold, read this file in full before doing anything.

---

## a. Project summary

A deployed, online lesson platform.

A **lesson** is a recorded video (produced in the **HGL-Console** studio, dark mint
theme) + **notes** + **interactive questions**. All lesson material is **ingested from
JSON** — the platform renders content; it does not author it inline.

Content is organised as a strict hierarchy:

```
subject → topic → topic area → lesson
```

**Content packs are strictly isolated from each other.** There are no cross-pack
imports. Learner progress is **namespaced by subject/topic** so packs never read or
write each other's state.

---

## b. Workflow rules

These rules are permanent. They govern how every change is made to this repo.

- **Branch per PR off `main`.** One branch, one PR.
- **Open the PR with `gh pr create --fill`,** then poll CI until green/red and report
  status.
- **NEVER merge.** Merging into `main` is always done manually by the user. Do not
  enable auto-merge.
- **CodeRabbit findings are addressed as follow-up commits on the SAME branch,** never
  as new PRs. False positives may be skipped only with stated evidence.
- **Scope discipline:** touch only what the current prompt covers. Flag surprises;
  don't silently fix them.
- **Diagnose-first cycle for non-trivial work:** investigation-only prompt → report
  with `file:line` citations → approval → scoped implementation prompt. Don't jump
  straight to code on anything non-trivial.
- **CI must be green before review.**
- **PRs are small and single-purpose.**

---

## c. Engineering lessons (verbatim)

These caused real bugs in the sibling project. Treat them as hard-won rules, not
suggestions.

1. Verify UI controls by reaching them the way a user would, through the rendered UI,
   never only via console calls.
2. Verify visibility against the actual background, not DOM presence.
3. Save/restore asymmetry: any new persisted field must be explicitly added to the
   restore path; check the restore path every time state is extended.
4. Anything rendered both live and from persisted state goes through ONE shared
   builder; extract shared resolvers immediately when duplication appears.
5. Sync UI enabled/disabled state at the single choke point through which all relevant
   state changes flow.
6. Validate ingested JSON with actionable errors ("question 3: missing prompt"); never
   silently coerce malformed input.
7. Stale-ID guards: validate stored IDs against the registry before acting; truthiness
   is not validity.
8. Keep tested, harmless dormant code rather than deleting it.
9. Feel-values (sensitivities, sizes) ship as defaults and get user-tuned later.

---

## d. Design system summary

Light, playful theme ("**Style B**"). All values below are authoritative and live as
CSS custom properties in [`/styles/tokens.css`](styles/tokens.css). **Components must
never hardcode hex** — always reference tokens.

- **Page background:** `#fdf8ec`
- **Cards:** `#ffffff` with a **2px border** + **4–5px bottom edge** (`#e8e0cc`)
- **Action green:** `#48b178` (edge `#2c8a58`)
- **Brand ink:** `#1a4d35`
- **Gold:** `#f0c75e` / `#9a6b0a` — rewards / difficulty / checkpoints
- **Cyan:** `#8fd6e8` / `#0e6d86` — XP / hints
- **Coral:** `#f3b9b6` / `#b3423d` — errors
- **Studio mint:** `#beffdc` — **ON DARK SURFACES ONLY** (video player chrome)
- **Fonts:** Plus Jakarta Sans (headings / buttons) + Manrope (body)
- **Math:** KaTeX for ALL math (`$...$` inline / `$$...$$` block). Backslashes are
  **doubled in JSON** (e.g. `"\\frac{1}{2}"`).
- **Dark videos** sit in **bold-framed dark panels**.
- **Layout tokens** (in `tokens.css`, also authoritative): a **4px spacing scale**
  `--space-1..8`, corner radii `--radius-sm/md/lg/pill`, per-screen container
  widths `--container-wide` (1120, hub/grid) / `--container-list` (880, lesson
  list) / `--container-reading` (720, lesson content), and page padding
  `--page-pad-inline`/`--page-pad-block`. Screens consume these — **no literal
  sizes in component CSS** (radius/padding/width all go through tokens).

**Navigation:** Map-based topic navigation was explored and **ABANDONED**. Topic pages
are conventional **ordered lesson-card lists**. **Do not reintroduce maps.**

---

## e. JSON contracts summary

### Question JSON
- **Required:** `type`, `prompt`.
- `type` ∈ `text` | `table` | `graph` | `geometry` | `multiple-choice`.
  - `multiple-choice` carries `options: [{ text, isCorrect }]` — **exactly one**
    option may have `isCorrect: true` (zero or two-plus is an error).
  - `table` carries `rows` (`string[][]`).
  - **Figures** attach via an optional `figure: { kind, specVersion?, data }`
    field (specVersion defaults to 1). `kind` selects a sealed renderer family
    (see §g). `graphData`/`geometryData` are **deprecated aliases** — still
    accepted (mapped to a kind, with a warning), but new content uses `figure`.
- **Optional:** `skill`, `difficulty`.
- **Optional reveal (non-MC only):** `answer?: string` and `working?: string[]`
  on `text` / `table` / `graph` / `geometry` — both render through MathText. The
  runtime reveals them, then self-marks. `multiple-choice` does NOT take these
  (its options carry correctness). A `text` question with **no `answer`** is
  valid but **warns** — the runtime falls back to self-marking with no reveal.
- **NO `topic` field inside questions** (topic comes from the content hierarchy).

### Notes JSON — block types
- `heading`
- `paragraph`
- `example` — `{ prompt, working[], answer }`
- `callout` — `{ style: "key" | "warning" | "info" }`
- `list` — `{ items }`

### Lesson manifest
`{ lesson: { id, title, order?, video: { src, duration }, notes, questions } }` —
ties **video `src` + notes + questions** together into one lesson.
`notes`/`questions` are either inline arrays or a file path relative to the
lesson dir. Optional `order` (integer) sorts lessons within a topic area; ties
or absences fall back to id-alphabetical, and duplicate orders in one area warn.

`video.src` is a **YouTube source** (a `youtube.com/watch` URL, a `youtu.be`
short link, a `youtube.com/embed` URL, or a bare 11-char id) **or `null`**.
`null` is a first-class "authored before its video was recorded" state
(generation may run ahead of studio recording). An unparseable `src` is an
error. All parsing goes through `parseYouTubeId` (`/src/shared/youtube.ts`) —
the single resolver used by both the validator and `<VideoEmbed>`.

**Hierarchy is path-derived, never in the manifest.** `subject`, `topic`, and
`topicArea` come from the directory path
(`/content/<subject>/<topic>/<topic-area>/<lesson-id>/`) and are stamped on the
lesson by the loader. A manifest containing `subject`/`topic`/`topicArea` is an
error; a manifest at a wrong-depth path is a load-time error.

### Content strings are single-line by design
Every content string (`prompt`, `text`, `answer`, `working[]` entries, list
`items`, table cells) is **single-line**. Document structure comes from blocks —
paragraphs, list items, `working[]` steps — not from in-string line breaks. The
validator therefore treats **any** control character (`\b \f \n \r \t \v`) as an
error: in math content these are almost always a mangled LaTeX command that lost
its doubled backslash (`\neq`→`\n`+`eq`, `\theta`→`\t`+`heta`, `\rho`→`\r`+`ho`,
`\beta`→`\b`+`eta`). Write `\\neq`, `\\theta`, etc. in JSON.

See [`/content/math/algebra/expanding-brackets/single-brackets-1/`](content/math/algebra/expanding-brackets/single-brackets-1/)
for minimal valid examples of all three files.

---

## f. Current state

- **Stack: Vite + React + TypeScript** — chosen for a fast, zero-config dev
  server and first-class TS support with a minimal dependency surface.
- **Dependencies:** runtime `react`, `react-dom`, **`katex`**,
  **`react-router-dom`**; dev `vite`,
  `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`,
  `@types/node`, `@types/katex`, **`vitest`**, `@testing-library/react`,
  `@testing-library/dom`, `jsdom`. Routing is `react-router-dom`; no state lib
  or UI kit.
- **TypeScript strict mode is on;** path alias `@` → `/src`.
- **Video hosting: YouTube unlisted embeds** (no embed implementation yet).
- **App hosting: TBD.**
- **Soft-launch: `noindex` active** — `index.html` carries
  `<meta name="robots" content="noindex">` for the testing period; **remove it at
  public launch**. A one-time dismissible "progress is local to this browser"
  notice shows on the Library; its dismissal persists through the progress
  store's storage layer (`isNoticeDismissed`/`dismissNotice`, a separate
  `lp:notice:*` key — UI state, not in the versioned progress key).
- **`/src/ingest` is implemented:** `types.ts` (contracts), `validate.ts`
  (pure, non-throwing validators with actionable path-precise errors + the
  un-doubled-LaTeX control-character tripwire), and `load.ts` (discovery +
  loader).
- **Notes renderer is implemented:** `/src/render/notes/` (one component per
  block type + `NotesRenderer`) and the shared `/src/shared/MathText.tsx`.
- **Question runtime is implemented:** `/src/render/questions/` —
  `QuestionRunner` (one question at a time, progress dots + difficulty badge,
  end-of-set summary), per-type bodies (MC, text, table, graph/geometry), and
  one shared self-mark/reveal flow + result type (`Outcome`/`QuestionResult`,
  CLAUDE.md §c rule 4). The runtime itself holds no persistence — it emits
  results via `onResult`/`onComplete` callbacks, which the progress store layer
  consumes. Graph and geometry render a token-styled `FigurePlaceholder` (a
  swappable slot for the upcoming figure-renderer PR), not real figures.
- **Progress store is implemented:** `/src/state/` — `progress.ts`
  (localStorage-backed, single versioned key `lp:progress:v1`; ONE
  serialize/restore pair with an explicit field whitelist; hierarchy-scoped
  query helpers so topics never co-mingle; stale-id guard against the registry),
  `storage.ts` (backend detection + in-memory fallback + corrupt/future-version
  robustness), and `ProgressContext.tsx` (`ProgressProvider` + hooks). Writes go
  through store functions only — no component touches localStorage. Results are
  fed from the question runtime's `onResult`/`onComplete` callbacks. **No
  gamification fields yet** (stars/XP/streak get their own design pass).
  **Bump `SCHEMA_VERSION` (and add a migration) on ANY breaking change to the
  stored shape**, and extend `restoreState`'s whitelist — the round-trip test
  fails otherwise.
- **Figure-kind registry is implemented:** `/src/render/figures/` — sealed
  per-kind modules dispatched by (kind, specVersion); see §g. Two proof kinds
  ship: `triangle-figure` and `bearing-diagram`. The question runtime renders
  figures through the registry's `FigureSlot`.
- **App shell is implemented:** `react-router-dom` routing + two screens
  (`/src/app/`). `main.tsx` builds the registry + progress store and provides
  them (RegistryProvider + ProgressProvider) under a `BrowserRouter`. Lessons
  within a topic area are ordered by the manifest's optional `order` (ties/
  absences fall back to id-alphabetical); the loader exposes the sorted sequence
  + each lesson's `areaIndex`/`areaCount`. Sequential unlock logic lives in the
  pure `/src/app/unlock.ts`. The old multi-lesson harness is retained DORMANT at
  `/debug` (lesson 8/9), linked nowhere.
- **Responsive layout system:** `.app-page` is a centered container, fluid
  below a per-screen max-width (`--app-page--wide` Library / `--list` lesson list
  / `--reading` lesson page). The **Library is a hub**: greeting + day/date
  kicker, registry-driven subject pills, an **always-present** hero ("Continue
  where you left off" when there is a last-visited lesson, else "Start here" at
  the first lesson), and a responsive topic grid (1/2/3 cols) of topic cards with
  in-card area rows; a dashed empty-room placeholder tile keeps a one-topic
  library reading as "early", not broken. Tuned at 360/768/1280/1920.
- **Lesson page** (`LessonPage`): framed video + Notes/Practice tabs (default
  Notes). Practice resumes at the first unanswered question for incomplete
  lessons; the summary offers "Back to <area>" + "Next lesson →" (when the next
  lesson unlocks after completion). **Review-rerun ruling:** a completed lesson
  opens in review mode — re-running practice records fresh outcomes and
  increments attempts but **NEVER clears `completedAt`** (encoded as a test).
- **Figures render wherever present (ruling):** ANY non-MC question with a
  `figure` renders it through the registry — text and table included, not just
  graph/geometry.

  | Route | Screen |
  |-------|--------|
  | `/` | Library **hub** (greeting + day/date kicker, subject pills, always-present hero, responsive topic grid with in-card area rows + empty-room placeholder) |
  | `/:subject/:topic/:topicArea` | Lesson-selection list + locked checkpoint |
  | `/:subject/:topic/:topicArea/:lessonId` | Lesson page (framed video, Notes/Practice tabs, resume + review mode, next-lesson CTA) |
  | `/debug` | Dormant dev harness |
  | `*` (and invalid hierarchy params) | Token-styled not-found (stale-id guard) |

- **Video embed is implemented:** `/src/render/VideoEmbed.tsx` — a bold-framed
  near-black 16:9 stage with a privacy-friendly `youtube-nocookie` iframe
  (lazy-loaded, `rel=0`, no API keys/tracking). `src: null` renders a
  studio-mint "video coming soon" panel (honest state, not an error).
- **Still stubs:** `/src/shared/builders.ts`.
- **All math goes through `MathText` — never call `katex` directly in a
  component.** `MathText` is the single shared math renderer (CLAUDE.md §c rule
  4); the question runtime will reuse it. It segments `$...$`/`$$...$$`, renders
  with `throwOnError: false` (errors show KaTeX's red fallback, never crash),
  and only ever injects KaTeX output — authored text is rendered as React text
  nodes, never via `dangerouslySetInnerHTML`.
- **KaTeX via npm, not CDN:** the handoff doc suggested a CDN `<link>`, but we
  have a bundler, so `katex` is an npm dependency and `katex/dist/katex.min.css`
  is imported globally in `main.tsx`. Rationale: versioned/locked dependency,
  offline/dev-server friendly, fonts fingerprinted and served from our own
  origin (no third-party CDN dependency or SRI concerns), tree-shaken by Vite.
- **Content discovery:** the loader uses Vite's
  `import.meta.glob('/content/**/*.json', { eager: true })`. `/content` sits at
  the repo root (the Vite root), so the absolute glob resolves it directly — no
  `server.fs` changes needed. The pure core `buildLessonRegistry(files)` takes
  the resulting path→JSON map, so it is unit-testable without Vite.
- **Path-derived hierarchy:** the loader stamps `subject`/`topic`/`topicArea`
  onto each `ValidatedLesson` from the manifest's directory path; the manifest
  itself carries none of them (it is an error if it does). Wrong-depth paths are
  reported as load-time errors.
- **Multiple-choice:** exactly one option may be `isCorrect: true`.

### Build / run commands

```sh
npm install                  # install dependencies
npm run dev                  # Vite dev server (http://localhost:5173)
npm test                     # vitest run (validator + content fixture suite)
npm run build                # tsc --noEmit && vite build  -> dist/
node scripts/check-content.mjs   # validate all /content JSON parses
```

---

## g. Figure-kind architecture (SEALED kinds)

Question figures use a **sealed-kind** architecture so problem-family
conventions (bearings, triangles, grid maps…) can never contaminate each other.
A figure is `{ kind, specVersion?, data }`; the registry dispatches on
**(kind, specVersion)**.

**Isolation — HARD RULES (enforced by `src/render/figures/__tests__/structure.test.ts`, treat that test as untouchable):**
- Each kind lives in `/src/render/figures/kinds/<kind>/` (schema, render, SPEC,
  fixtures, tests). A **kind NEVER imports a sibling kind.**
- `/src/render/figures/shared/` is chrome only (SVG canvas, token palette, label
  styles). **Shared contains NO mathematical/problem-family conventions, and
  NEVER imports a kind.**
- **No fallback rendering across kinds.** An unknown kind renders a visible
  `role="alert"` error chip; a known-but-unimplemented kind renders a distinct
  placeholder. Never "best-effort with another kind".

**Temporal immutability — APPEND-ONLY specs:**
- Kind specs are **append-only**. Any change that alters the interpretation or
  rendering semantics of existing data requires a **new `specVersion`** with the
  previous renderer **retained and still dispatched** for old content. Renderers
  for shipped specVersions are never deleted or semantically edited.
- Each kind commits a **golden snapshot** of its rendered output. The snapshot is
  a corruption tripwire: changing how existing content renders fails CI until the
  golden is deliberately updated. **Golden updates require explicit
  justification in the PR description.**
- The **back-compat corpus** (`/src/ingest/__tests__/compat-corpus/`) is a frozen,
  **append-only** snapshot of previously-valid content; validator changes that
  break it fail CI.

**Authoring:** each kind has a `SPEC.md` written for a lesson-generation session;
[`/docs/authoring.md`](docs/authoring.md) indexes them plus the question/notes/
manifest contracts — the single document a generation chat needs.
