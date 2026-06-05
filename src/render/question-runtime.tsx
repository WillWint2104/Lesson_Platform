/**
 * @file question-runtime.tsx — Interactive question runtime.
 *
 * Renders and drives interactive questions (text | table | graph | geometry |
 * multiple-choice), captures learner answers, and reports outcomes to the
 * progress store.
 *
 * UI enabled/disabled state must be synced at the single choke point through
 * which all state changes flow (CLAUDE.md §c rule 5). Controls must be
 * verifiable through the rendered UI, not only via console (rule 1).
 *
 * KaTeX renders all math in prompts and options.
 *
 * Stub only — no logic yet (stack decision pending, CLAUDE.md §f).
 */

// Stub module: no exports yet. Present so the file is a module under
// isolatedModules (CLAUDE.md §f).
export {};
