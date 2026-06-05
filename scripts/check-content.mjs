#!/usr/bin/env node
/**
 * check-content.mjs — Dependency-free content sanity check for CI.
 *
 * Walks /content and asserts that every *.json file parses. This runs BEFORE
 * any stack/framework decision, so it uses only Node's built-in modules.
 *
 * It deliberately does NOT enforce the full JSON contracts (CLAUDE.md §e) yet —
 * that belongs in src/ingest/validator.js once the stack is chosen. Here we
 * only guarantee the content tree is valid JSON.
 *
 * Exit code 0 = all good; 1 = at least one file failed to parse.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT_DIR = fileURLToPath(new URL("../content/", import.meta.url));
const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Recursively collect every *.json path under a directory. */
async function collectJson(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectJson(full)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      found.push(full);
    }
  }
  return found;
}

const files = await collectJson(CONTENT_DIR);

if (files.length === 0) {
  console.log("check-content: no JSON files found under /content (nothing to check).");
  process.exit(0);
}

let failures = 0;
for (const file of files) {
  const rel = relative(ROOT, file);
  try {
    JSON.parse(await readFile(file, "utf8"));
    console.log(`  ok   ${rel}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${rel}: ${err.message}`);
  }
}

if (failures > 0) {
  console.error(`\ncheck-content: ${failures} file(s) failed to parse.`);
  process.exit(1);
}

console.log(`\ncheck-content: all ${files.length} JSON file(s) under /content parse cleanly.`);
process.exit(0);
