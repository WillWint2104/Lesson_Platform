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

**Navigation:** Map-based topic navigation was explored and **ABANDONED**. Topic pages
are conventional **ordered lesson-card lists**. **Do not reintroduce maps.**

---

## e. JSON contracts summary

### Question JSON
- **Required:** `type`, `prompt`.
- `type` ∈ `text` | `table` | `graph` | `geometry` | `multiple-choice`.
  - `multiple-choice` carries `options: [{ text, isCorrect }]`.
  - `table` carries `rows`.
  - `graph` / `geometry` carry `graphData` / `geometryData`.
- **Optional:** `skill`, `difficulty`.
- **NO `topic` field inside questions** (topic comes from the content hierarchy).

### Notes JSON — block types
- `heading`
- `paragraph`
- `example` — `{ prompt, working[], answer }`
- `callout` — `{ style: "key" | "warning" | "info" }`
- `list` — `{ items }`

### Lesson manifest
Ties **video `src` + notes + questions** together into one lesson.

See [`/content/math/algebra/expanding-brackets/single-brackets-1/`](content/math/algebra/expanding-brackets/single-brackets-1/)
for minimal valid examples of all three files.

---

## f. Current state

- **Stack: Vite + React + TypeScript** — chosen for a fast, zero-config dev
  server and first-class TS support with a minimal dependency surface.
- **Dependencies kept minimal:** `react`, `react-dom` + dev `vite`,
  `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`.
  No router, state lib, UI kit, or KaTeX yet (KaTeX arrives with the
  notes-renderer PR).
- **TypeScript strict mode is on;** path alias `@` → `/src`.
- **Video hosting: YouTube unlisted embeds** (no embed implementation yet).
- **App hosting: TBD.**
- `/src` modules in `ingest`/`render`/`state`/`shared` are TypeScript stubs
  (JSDoc headers preserved; no runtime logic yet).

### Build / run commands

```sh
npm install                  # install dependencies
npm run dev                  # Vite dev server (http://localhost:5173)
npm run build                # tsc --noEmit && vite build  -> dist/
node scripts/check-content.mjs   # validate all /content JSON parses
```
