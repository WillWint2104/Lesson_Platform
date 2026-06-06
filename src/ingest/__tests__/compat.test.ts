/**
 * Back-compat guard. The corpus under ./compat-corpus/ is a FROZEN, APPEND-ONLY
 * snapshot of previously-valid content (including legacy graphData/geometryData).
 * A validator change that breaks any of it fails CI. Add to the corpus; never
 * edit existing entries to make them pass.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateManifest,
  validateNotesFile,
  validateQuestionsFile,
} from "@/ingest/validate";
import { figureSchemas } from "@/render/figures/registry";

const corpusDir = fileURLToPath(new URL("./compat-corpus/", import.meta.url));
const files = readdirSync(corpusDir).filter((f) => f.endsWith(".json"));

describe("frozen back-compat corpus", () => {
  it("has frozen fixtures", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("still validates with zero errors: %s", (rel) => {
    const raw = JSON.parse(readFileSync(join(corpusDir, rel), "utf8"));
    const res = rel.startsWith("lesson")
      ? validateManifest(raw, { figureSchemas })
      : rel.startsWith("questions")
        ? validateQuestionsFile(raw, { figureSchemas })
        : rel.startsWith("notes")
          ? validateNotesFile(raw)
          : { valid: true, errors: [] as { path: string; message: string }[] };
    if (!res.valid) {
      throw new Error(
        `${rel} broke back-compat:\n` +
          res.errors.map((e) => `  - ${e.path}: ${e.message}`).join("\n"),
      );
    }
    expect(res.valid).toBe(true);
  });
});
