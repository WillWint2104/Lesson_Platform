# CLAUDE.md — Lesson Platform

This file is the durable project anchor. It is meant to survive context wipes: if you
are an agent picking this project up cold, read this file in full before doing anything.

---

## a. Project summary

A deployed, online lesson platform.

The unit of content is the **topic area**: an ordered sequence of **stages**,
each stage = **one skill** taught as **notes → video → exercise** and navigated
as pages (Mayer segmenting). Each exercise carries an optional **extra-practice**
pool. Videos are produced in the **HGL-Console** studio (dark mint theme);
exercises are interactive questions. All material is **ingested from JSON** — the
platform renders content; it does not author it inline. **Completion = all core
questions answered (any outcome), never gated on correctness.** (The earlier
lesson-as-unit and v2 area-sequence models are superseded; see §e.)

Content is organised as a strict hierarchy:

```
subject → topic → topic area  (each area = notes + an ordered video/exercise sequence)
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
- **Merged-branch cleanup is pre-approved.** Once a feature branch is fully merged,
  delete it (local AND remote) without asking — this is standing approval, not a
  per-time question.
- **Line endings are normalized by `.gitattributes` (LF in repo, LF on checkout for
  source/snapshots).** NEVER hand-patch CRLF "phantom" diffs (e.g. on `*.snap`
  goldens) again — if one reappears, the fix is to `.gitattributes` /
  `git add --renormalize`, not a manual per-file checkout.

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

**The app is a PAGE, never a framed card.** Backgrounds fill the viewport (the
cream `--page-bg` lives on `<body>`); only *content* is width-constrained. The
shared `AppShell` (`/src/app/AppShell.tsx`) is a `min-height:100svh` flex column
with a full-width sticky app bar (white surface, `--border` hairline) and a slim
footer; bar/footer/content all align to the active route's `--container` width
(published on the shell per route). Never reintroduce an outer border / page
max-width / floating-card surround on the page container.

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
- `example` — `{ prompt, answer, steps[{tex,why?}] }` (preferred) or legacy `{ prompt, answer, working[] }` (exactly one of steps/working)
- `callout` — `{ style: "key" | "warning" | "info" }`
- `list` — `{ items }`

### Area manifest (v3 — the unit is the topic AREA, made of STAGES)
The unit of content is the **topic area**; an area is an ordered list of
**stages**, each one skill = notes → video → exercise (navigated as pages, Mayer
segmenting). Notes belong to the **stage** (no area-level notes). The v2
`sequence` model and the v1 `lesson.json` are both **superseded**. Manifest lives
at `/content/<subject>/<topic>/<topic-area>/area.json`:

```
{ "area": {
  "title": string,
  "stages": [ {
    "title": string,
    "notes":   NoteBlock[] | string(path)            // optional
    "video":   { "src": string|null, "duration": number|null }   // optional
    "exercise": {                                    // REQUIRED
      "questions": Question[] | string(path),        // core, ≥1
      "extra":     Question[] | string(path)         // optional, ≥1 when present
    }
  } ]
} }
```
- **≥1 stage** (empty is an error); `exercise` is required per stage with **≥1
  core question**; `extra`, when present, needs **≥1 question**. Path-precise
  messages, e.g. `stages[1].exercise.extra[2]: …`.
- **A v2 `sequence` manifest now ERRORS** with a migration pointer (same pattern
  as the v1 `lesson.json` rejection).
- **Question JSON / Notes block contracts otherwise UNCHANGED** (additive
  changes only — see below).

`video.src` is a **YouTube source** (`youtube.com/watch`, `youtu.be`,
`youtube.com/embed`, or bare 11-char id) **or `null`** (first-class "not recorded
yet"). Unparseable `src` is an error; all parsing goes through `parseYouTubeId`.

**Completion = all CORE questions ANSWERED (any outcome), NEVER gated on
correctness.** Extra outcomes never affect completion. **Nothing locks** — the
stepper navigates freely both directions; `unlock.ts` only derives a display
status (done / current / upcoming).

**Worked-example extension (additive):** `example` blocks gain optional
`steps: [{ tex, why? }]`. An example must have `prompt`, `answer`, and **exactly
one** of `steps` (preferred) / `working` (legacy) — both is an error. Legacy
`working` stays fully valid.

**Note-block types are APPEND-ONLY (like figure kinds):** unknown types are
visible errors, never skipped; new interactive/animation content arrives as NEW
registered block types with their own specVersion, never as edits to existing
types.

**Math emphasis macros:** MathText's KaTeX config defines exactly two — `\\emA{}`
(outside-term, green-deep) and `\\emB{}` (in-use-term, cyan-ink), mapped to theme
tokens. They are the ONLY emphasis mechanism; raw `\\textcolor` in content is a
validator **warning**.

**Hierarchy is path-derived, never in the manifest.** `subject`/`topic`/
`topicArea` come from the directory path (`area.json` sits at the topic-area
level); the **areaId** is `<subject>/<topic>/<topicArea>`. A manifest containing
hierarchy fields is an error; a wrong-depth path is a load-time error.

### Content strings are single-line by design
Every content string (`prompt`, `text`, `answer`, `working[]` entries, list
`items`, table cells) is **single-line**. Document structure comes from blocks —
paragraphs, list items, `working[]` steps — not from in-string line breaks. The
validator therefore treats **any** control character (`\b \f \n \r \t \v`) as an
error: in math content these are almost always a mangled LaTeX command that lost
its doubled backslash (`\neq`→`\n`+`eq`, `\theta`→`\t`+`heta`, `\rho`→`\r`+`ho`,
`\beta`→`\b`+`eta`). Write `\\neq`, `\\theta`, etc. in JSON.

See [`/content/math/algebra/expanding-brackets/`](content/math/algebra/expanding-brackets/)
for a minimal valid area (`area.json` + `notes.json` + `exercise-*.json`).

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
- **`/src/ingest` is implemented (STAGE model, v3):** `types.ts` (contracts —
  `Area`/`AreaManifest` + `Stage`/`StageVideo`/`StageExercise`; `ExampleStep`;
  `Question` unchanged), `validate.ts` (pure, non-throwing validators with
  actionable path-precise errors — e.g. `stages[1].exercise.extra[2]: …` — + the
  un-doubled-LaTeX tripwire; `validateAreaManifest` enforces ≥1 stage, required
  exercise with ≥1 core question, optional extra ≥1, the example `steps` XOR
  `working` rule, a `\textcolor` WARNING, and **rejects both the superseded v2
  `sequence` manifest and the v1 `lesson.json` with migration pointers**), and
  `load.ts` (`buildAreaRegistry`/`loadAllAreas` — discovery, path-derived
  hierarchy, per-stage notes/video/core/extra resolution + figure
  normalization). `ResolvedStage` = `{ title, notes, video, exercise:{questions,
  extra} }`. Question contracts unchanged; the `example` note block is additively
  extended with `steps`.
- **Notes renderer is implemented:** `/src/render/notes/` (one component per
  block type + `NotesRenderer`) and the shared `/src/shared/MathText.tsx`.
- **Question runtime is implemented (two presentation modes share one set of
  per-type bodies + the `Outcome`/`QuestionResult` types):** `/src/render/questions/`.
  - **Worksheet (active)** — `Worksheet` renders ALL questions of an exercise as
    a numbered list; each row carries the prompt (MathText), an optional figure
    (registry), an optional difficulty badge, an answered-state indicator
    (✓/●, restored from the store), and an answer-icon button. MC options are
    tappable inline (reusing `MultipleChoice`); the answer icon opens
    `SolutionModal`. Non-MC questions are answered via the modal's self-mark
    actions.
  - **`SolutionModal`** — accessible dialog (role=dialog, aria-modal, labelled by
    the question number; focus moves in on open and returns to the opener on
    close; Escape + backdrop close; Tab trapped). Self-mark mode (non-MC) shows
    the worked solution (answer chip + working lines, NoteExample treatment) or
    an honest "No worked solution provided" state, plus "I got it" / "Not yet".
    Explanation mode (MC) shows the options with the correct one highlighted, no
    self-mark.
  - **`QuestionRunner` is DORMANT** (CLAUDE.md §c rule 8/9) — the one-at-a-time
    runner with progress dots + end-of-set summary, retained and still tested
    (`wiring.test.tsx`) as the future checkpoint/quiz mode, but no longer
    rendered by any route.
  - The runtime holds no persistence — it reports outcomes via callbacks
    (`onOutcome` / `onResult`/`onComplete`) that the AreaPage/store layer
    consumes. Graph/geometry without a `figure` render a token-styled
    placeholder, not real figures.
- **Progress store is implemented (schema v3, area/stage-keyed):**
  `/src/state/` — `progress.ts` (localStorage-backed, single versioned key
  `lp:progress:v3`; state is `areas[areaId].stages[stageIndex]` where each stage
  carries `{ core, extra, attempts, completedAt }` (separate core/extra outcome
  maps); `lastVisited` = `{ areaId, stageIndex, view }`; ONE serialize/restore
  pair with an explicit whitelist; stale-id guard on reads AND writes),
  `storage.ts` (backend detection + in-memory fallback + corrupt/future-version
  robustness; reads the v3 key, falls back to v2 then v1 for migration),
  `ProgressContext.tsx`. **v2→v3 migration** (`migrateToV3`): older records are
  **preserved verbatim under `legacy.v2` / `legacy.v1` — never destroyed**; the
  old key is left intact. `resetAll` preserves `legacy`. Outcomes are recorded
  via `recordOutcome(areaId, stageIdx, "core"|"extra", qIdx, outcome)`;
  `recordAttempt(areaId, stageIdx, completed)` sets the **sticky `completedAt`**
  (review re-runs record fresh outcomes + attempts, never clear it). **Completion
  = every CORE question answered (any outcome), never gated on correctness;**
  extra never affects it. **Bump `SCHEMA_VERSION` (+ migration) on ANY breaking
  shape change** and extend the whitelist — the round-trip test fails otherwise.
- **Figure-kind registry is implemented:** `/src/render/figures/` — sealed
  per-kind modules dispatched by (kind, specVersion); see §g. Two proof kinds
  ship: `triangle-figure` and `bearing-diagram`. The question runtime renders
  figures through the registry's `FigureSlot`.
- **App shell is implemented:** `react-router-dom` routing (`/src/app/`).
  `main.tsx` calls `loadAllAreas` to build the `AreaRegistry` + `createProgressStore`
  (keyed by `registry.areas.map(a => a.id)`) and provides them (RegistryProvider +
  ProgressProvider) under a `BrowserRouter`. **Stage status** lives in the pure
  `/src/app/unlock.ts` — `computeStageStatus(stages)` → `done`/`current`/`upcoming`
  (current = first stage with an incomplete core exercise, else the last stage),
  `currentStageIndex`, and `isAreaComplete` (true iff every stage complete).
  **NOTHING locks — navigation is free both directions** (stepper, Mayer
  segmenting). The debug harness at `/debug` is an **area inspector** (lists
  registry areas + validity + stage count, reset-progress), linked nowhere.
- **Stage-flow screens are implemented** (the old single-page AreaPage is
  REMOVED; its row + `SolutionModal` patterns are reused). Routes: the area root
  `/:subject/:topic/:topicArea` **redirects** to the current stage
  (`AreaRedirect`, progress-derived); `/…/stage/:n` is the **StagePage**
  (container 1280, main 1.6 / rail 1 — MAIN = video + WORKED EXAMPLES
  `StepPlayer`; RAIL = THE RULE + REMEMBER + the "Start Exercise N →" CTA at its
  foot; stacks below 980 as video → worked examples → rule → remember → CTA);
  `/…/stage/:n/exercise` is the **ExercisePage** (worksheet 7 / recap rail 4: core rows tappable → focus view,
  inline MC, **every non-MC row self-marks directly** (✓ Got it / ✕ Not yet —
  opening the solution is optional, never required), completion row whose CTA
  links to the **next stage's video** ("Next: Video N+1", or "Back to <area>" on
  the last stage) + gentle incorrect-nudge, a collapsed "More practice" expander
  whose extra **solutions are always available** (never locked) and never
  counting). Invalid `:n` → not-found. A shared `StageStepper`
  (`/src/app/StageStepper.tsx`) sits on both pages — every stage clickable both
  directions, nothing locks. The **question focus view** (`FocusView`) **enlarges
  the question IN PLACE** — a centered card over a dimmed + blurred backdrop
  (`--scrim` + `backdrop-filter`), NOT a full-surface page/route (role=dialog,
  aria-modal; ← → navigate / G = got it / N = not yet / S = solution / Esc close;
  rem-scaled type; focus in/restore; self-mark inside; works for core AND extra).
  Completion/outcome wiring is unchanged
  (recordOutcome core/extra; sticky `completedAt` on all-core-answered);
  `setLastVisited(area, stage, view)` updates on navigation and the hub deep-links
  to the stored stage/view. Stage helpers + path builders live in
  `/src/app/stageProgress.ts`.
- **Responsive layout system:** `.app-page` is a centered container, fluid
  below a per-screen max-width (`--app-page--wide` Library / `--app-page--area`
  area page, `--container-area` 960px). The **Library is a hub**: greeting + day/date kicker, registry-driven
  subject pills, an **always-present** hero ("Continue where you left off" when
  there is a last-visited area, else "Start here" at the first area), and a
  responsive topic grid (2 cols within the hub main zone) of topic cards with
  in-card area rows (area progress reflects stage completion); a dashed
  empty-room placeholder tile keeps a one-topic library reading as "early", not
  broken. The hub is a `main 2fr / rail 1fr` grid (rail = up-next / your-progress
  / how-it-works) collapsing below 920px; the local-progress notice is a muted
  Library-only app-bar line. Tuned at 360/768/1280/1920.
- **Review-rerun ruling (carried into v3):** a completed stage opens in review
  mode — re-running it records fresh outcomes and increments `attempts` but
  **NEVER clears `completedAt`** (encoded as a test).
- **Free-navigation ruling (v3):** nothing locks; the learner moves between
  stages freely in both directions. `unlock.ts` derives display status only.
- **Figures render wherever present (ruling):** ANY non-MC question with a
  `figure` renders it through the registry — text and table included, not just
  graph/geometry.

  | Route | Screen |
  |-------|--------|
  | `/` | Library **hub** (greeting + day/date kicker, subject pills, always-present hero, responsive topic grid with in-card area rows + empty-room placeholder) |
  | `/:subject/:topic/:topicArea` | **Redirects** to the current stage (progress-derived) |
  | `/:subject/:topic/:topicArea/stage/:n` | Stage page — stepper, video (7) + notes (4: rule / remember / worked-example step player), "Start Exercise N" |
  | `/:subject/:topic/:topicArea/stage/:n/exercise` | Exercise page — stepper, worksheet (7) + recap rail (4); tappable rows → enlarge-in-place focus view; per-row self-mark; completion row → next-stage video; always-open "More practice" expander |
  | `/debug` | Dormant area inspector |
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
  `server.fs` changes needed. The pure core `buildAreaRegistry(files)` takes
  the resulting path→JSON map, so it is unit-testable without Vite.
- **Path-derived hierarchy:** the loader stamps `subject`/`topic`/`topicArea`
  onto each `ValidatedArea` from the `area.json` directory path (four path
  segments after `/content/`); the manifest itself carries none of them (it is
  an error if it does). Wrong-depth paths are reported as load-time errors.
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
