/**
 * @file validator.ts — Ingested JSON validator.
 *
 * Validates lesson manifests, notes, and questions against the JSON contracts
 * (CLAUDE.md §e) and produces ACTIONABLE errors, e.g. "question 3: missing
 * prompt" (CLAUDE.md §c rule 6). Never silently coerces malformed input.
 *
 * Contract highlights enforced here:
 *  - Question: `type` and `prompt` required; type ∈
 *    text | table | graph | geometry | multiple-choice; no `topic` field.
 *  - Notes blocks: heading | paragraph | example | callout | list.
 *  - Lesson manifest: video src + notes + questions references resolve.
 *
 * Stub only — no logic yet (stack decision pending, CLAUDE.md §f).
 */

// Stub module: no exports yet. Present so the file is a module under
// isolatedModules (CLAUDE.md §f).
export {};
