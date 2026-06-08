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

Content is organised as a strict hierarchy (**course is the new top level** —
content-architecture-v1 §2):

```text
course → topic → topic area  (each area = notes + an ordered video/exercise sequence)
```

A **course** is a year-level + stream of maths (e.g. `year-8`, `year-11-advanced`),
carrying a small `/content/<course>/course.json` manifest (§e). Everything below
the course (topic/area/stage) is contract v3/v4 **unchanged**. A course may have
**zero areas** (registered, "content coming") — never an error.

**Content packs are strictly isolated from each other.** There are no cross-pack
imports. Learner progress is **namespaced by course** so packs never read or
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
- **Optional:** `skill`. **`difficulty`** (`easy|medium|hard`) is an authored
  **hidden** tag — stored for a future teacher mode, **NEVER rendered in the
  student UI** (design-language-v2 §8). Out-of-enum values warn.
- **`answer` + `working` (non-MC):** `answer: string` and `working?: string[]`,
  both render through MathText. **In an area exercise, a `text` question's
  `answer` is REQUIRED** — it is the *canonical* answer the algebraic-equivalence
  check (`mathjs`, client-side) marks the learner's typed answer against (v2 §8);
  a missing exercise-text answer is a validator **error** (path-precise). The
  other answerable types (`table`/`graph`/`geometry`) keep `answer` optional
  (future variants, §10), and a **standalone** `questions.json` text question
  still only **warns** (preserves the frozen back-compat corpus, §g).
  `multiple-choice` takes neither (its options carry correctness).
- **NO `topic` field inside questions** (topic comes from the content hierarchy).

### Notes JSON — block types
- `heading`
- `paragraph`
- `example` — `{ prompt, answer, steps[{tex,why?}] }` (preferred) or legacy `{ prompt, answer, working[] }` (exactly one of steps/working)
- `callout` — `{ style: "key" | "warning" | "info" }`
- `list` — `{ items }`

### Course manifest (`course.json`, content-architecture-v1 §3)
The **course** is the top of the hierarchy. Each `/content/<course>/course.json`:
```jsonc
{ "id": string,            // MUST equal the folder name (path-derived, validated)
  "displayName": string,   // single-line, non-empty (e.g. "Year 11 · Mathematics Advanced")
  "year": number,          // integer 7–12
  "stream": "Advanced" | "Standard" | "Extension" | null,   // null = junior, no stream
  "subject": string,       // default "Mathematics" (reserved for multi-subject)
  "order": number }        // picker sort key
```
`validateCourseManifest` enforces id===folder, year 7–12, single-line displayName,
numeric order (id-mismatch / bad year / bad order / non-string subject are
**errors**; an out-of-enum `stream` **warns**). Courses are discovered by scanning
`/content/<course>/course.json` → `registry.courses` (sorted by `order`) +
`getCourses()` / `getCourseById()`, each with an `areaCount` (0 = empty course,
**valid**, "content coming"). Senior courses `year-11-advanced` / `year-12-advanced`
are scaffolded empty.

### Area manifest (v3 — the unit is the topic AREA, made of STAGES)
The unit of content is the **topic area**; an area is an ordered list of
**stages**, each one skill = notes → video → exercise (navigated as pages, Mayer
segmenting). Notes belong to the **stage** (no area-level notes). The v2
`sequence` model and the v1 `lesson.json` are both **superseded**. Manifest lives
at `/content/<course>/<topic>/<topic-area>/area.json`:

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

**Hierarchy is path-derived, never in the manifest.** The top path segment is
the **course**; `topic`/`topicArea` follow (`area.json` sits at the topic-area
level); the **areaId** is `<course>/<topic>/<topicArea>`. (The loader currently
still exposes the top segment as `ValidatedArea.subject` for back-compat — a
rename to `.course` lands with the routing PR; `area.subject` now holds the
course slug, e.g. `year-8`.) A manifest containing hierarchy fields is an error;
a wrong-depth path is a load-time error.

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
  **`react-router-dom`**, **`mathjs`** (client-side algebraic-equivalence answer
  checking, §8), `lucide-react`; dev `vite`,
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
  extended with `steps`. **Course level (content-architecture-v1 §3):**
  `types.ts` adds `CourseManifest` (+ `COURSE_STREAMS`/`DEFAULT_COURSE_SUBJECT`),
  `validate.ts` adds `validateCourseManifest`, and `load.ts` discovers courses by
  scanning `/content/<course>/course.json` → `registry.courses` /
  `getCourses()` / `getCourseById()` (each a `ValidatedCourse` with `areaCount`;
  empty courses valid). The course level is **additive** — area resolution + the
  v3/v4 contracts below the course are unchanged.
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
- **Progress store is implemented (schema v4, area/stage-keyed):**
  `/src/state/` — `progress.ts` (localStorage-backed, single versioned key
  `lp:progress:v4`; state is `areas[areaId].stages[stageIndex]` where each stage
  carries `{ core, extra, attempts, completedAt }`. **core/extra are maps of
  `AnswerRecord { answer, correct }`** — the learner's typed answer + whether the
  equivalence check passed (design-language-v2 §8, replacing the v3 honour-system
  outcome); `lastVisited` = `{ areaId, stageIndex, view }`; ONE serialize/restore
  pair with an explicit whitelist; stale-id guard on reads AND writes),
  `storage.ts` (backend detection + in-memory fallback + corrupt/future-version
  robustness; reads the v4 key, falls back to v3 → v2 → v1 for migration),
  `ProgressContext.tsx`. **Migration to v4** (`migrateToV4`): older records
  (v3/v2/v1) are **preserved verbatim under `legacy.v3` / `.v2` / `.v1` — never
  destroyed** and current progress **starts fresh** (the leaf shape changed with
  no faithful answer to recover); the old key is left intact. `resetAll`
  preserves `legacy`. Results are recorded via
  `recordResult(areaId, stageIdx, "core"|"extra", qIdx, { answer, correct })`;
  `recordAttempt(areaId, stageIdx, completed)` sets the **sticky `completedAt`**
  (review re-runs record fresh results + attempts, never clear it). **Completion
  = every CORE question answered (correct or not), never gated on correctness;**
  extra never affects it. **Bump `SCHEMA_VERSION` (+ migration) on ANY breaking
  shape change** and extend the whitelist — the round-trip test fails otherwise.
- **Figure-kind registry is implemented:** `/src/render/figures/` — sealed
  per-kind modules dispatched by (kind, specVersion); see §g. Two proof kinds
  ship: `triangle-figure` and `bearing-diagram`. The question runtime renders
  figures through the registry's `FigureSlot`. The shared figure **palette is on
  the v2 token scale** (`shared/palette.ts` — neutral `--ink`/`--muted` + the one
  green accent; no gold/cyan per §2.5); the two kind goldens were re-snapshotted
  for that re-theme.
- **v2 re-theme is in progress (`docs/design-language-v2.md`, the locked source
  of truth that supersedes the v1 `design-language.md`).** Shipped so far:
  tokens (`styles/tokens-v2.css` — the §2 scale + §3 fonts incl. JetBrains Mono +
  `--text-v2-*` type tokens), primitives (`styles/v2-primitives.css` +
  `/src/shared/v2/` — GridCanvas, mint-strip `Panel`, `Card`, rounded `Button`,
  `ResultBar`, the inline-SVG icon set, NO emoji), the **app shell** (grid
  canvas + white top bar with breadcrumb + mastery % + the 288px **contents
  sidebar** `/src/app/ContentsSidebar.tsx`, the new primary nav driven by
  `parseAreaRoute`), and the **stage page** (§7a). A validator **warning** flags
  Unicode fraction glyphs (author `\frac`). Migration is PR-by-PR; the **Library/home hub** (a
  scoped `.v2-home` re-skin), and the **exercise page + answer-lock behaviour**
  (§7b/§7c/§8): `mathjs` algebraic-equivalence checking (`answerCheck.ts`,
  client-side), `{ answer, correct }` results in the store (schema v4), per-question
  solution gating, hidden difficulty — the honour-system self-mark is gone. **All
  screens are now on the v2 system.** Build/run commands unchanged.
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
  (**design-language-v2 §7a**: a plain title row → the VIDEO BAND full-width on
  its own row (mint-strip panel + dark 16:9 + caption, gap-proof) → ONE notes
  panel with two internal columns (THE RULE + REMEMBER | WORKED EXAMPLES
  `StepPlayer`, collapsing to one column < 920px) → an "Up next · Exercise N"
  footer with the single primary CTA. Stage nav is the contents sidebar (§4) —
  **no in-page stepper here**);
  `/…/stage/:n/exercise` is the **ExercisePage** (**design-language-v2 §7b/§8**:
  ONE worksheet panel (mint strip) on the grid canvas — no stepper/breadcrumb
  (the shell bar + contents sidebar carry chrome/nav); the panel header holds the
  title + question count + instruction, then a grid of **question cards** (mint
  number badge + expand icon, mint-outlined question box, an **answer field** the
  learner **Checks by algebraic equivalence** (`mathjs`, `answerCheck.ts`), and a
  Solution button **LOCKED until that question is answered**). The result IS the
  mark — **no honour-system self-mark**; wrong answers show **"Incorrect"** (no
  retake). Completion = every core question answered (correct or not); the
  completion CTA links to the **next stage's video** ("Next: Video N+1", or "Back
  to <area>" on the last stage). A "More practice" expander holds the extra pool
  (solvable + gated per-question like core; **never affects completion**).
  **Difficulty is never rendered** (§8). Invalid `:n` → not-found. The
  `StageStepper` is no longer used by either stage-flow page (the contents sidebar
  is the nav); it remains only in the dormant runner's tests. The **question
  focus view** (`FocusView`, §7c) **enlarges the question IN PLACE** — a centered
  v2 card over a dimmed + blurred scrim (`--scrim` + `backdrop-filter`), NOT a
  route (role=dialog, aria-modal, **Tab focus trap** + restore; ← → navigate /
  S = solution / Esc close — arrows/S are **suppressed while typing** in the
  answer field), with
  three states: **unanswered** (field + Check + LOCKED solution), **answered**
  (result bar + active solution), **solution** (working → answer, shown in place).
  Solution gating is **per-question** — it stays locked when you arrive via
  prev/next on an unanswered question. The shared `AnswerControl` powers both the
  cards and the focus view; results record via `recordResult` (sticky
  `completedAt` on all-core-answered); `setLastVisited` updates on navigation.
  Stage helpers + path builders live in `/src/app/stageProgress.ts`.
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
  | `/` | Library **hub** (v2 `.v2-home` skin: grid canvas, mint-strip panels, white continue/start hero, subject pills, responsive topic grid with in-card area rows + mastery + empty-room placeholder) |
  | `/:subject/:topic/:topicArea` | **Redirects** to the current stage (progress-derived) |
  | `/:subject/:topic/:topicArea/stage/:n` | Stage page (v2 §7a) — full-width video band → two-column notes panel (rule + remember / worked examples) → "Up next · Exercise N" CTA; nav via the contents sidebar |
  | `/:subject/:topic/:topicArea/stage/:n/exercise` | Exercise page (v2 §7b/§8) — one worksheet panel + question-card grid; type a final answer → **Check** (algebraic-equivalence, math.js); Solution locked until answered; completion → next-stage video; "More practice" expander (never gates); difficulty hidden; nav via the contents sidebar |
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
