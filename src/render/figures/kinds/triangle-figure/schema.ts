/**
 * @file schema.ts — triangle-figure data validator (specVersion 1).
 * Conventions live in SPEC.md. This file ONLY validates shape.
 */
import type { Issue } from "@/ingest/validate";

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isStringArrayOfLength(v: unknown, n: number): v is string[] {
  return Array.isArray(v) && v.length === n && v.every((s) => typeof s === "string");
}

/** Validate triangle-figure `data`. Returns path-precise issues (none = valid). */
export function validateTriangleData(data: unknown, path: string): Issue[] {
  const issues: Issue[] = [];
  if (!isObject(data)) {
    issues.push({ path, message: "triangle-figure data must be an object" });
    return issues;
  }

  const vertices = data["vertices"];
  if (!Array.isArray(vertices) || vertices.length !== 3) {
    issues.push({ path: `${path}.vertices`, message: "must be an array of exactly 3 points" });
  } else {
    vertices.forEach((v, i) => {
      if (!isObject(v) || typeof v["x"] !== "number" || typeof v["y"] !== "number") {
        issues.push({
          path: `${path}.vertices[${i}]`,
          message: "must be a point { x: number, y: number }",
        });
      }
    });
  }

  if (data["labels"] !== undefined && !isStringArrayOfLength(data["labels"], 3)) {
    issues.push({
      path: `${path}.labels`,
      message: "must be an array of exactly 3 strings (one per vertex)",
    });
  }

  if (data["sideLabels"] !== undefined && !isStringArrayOfLength(data["sideLabels"], 3)) {
    issues.push({
      path: `${path}.sideLabels`,
      message: "must be an array of exactly 3 strings (one per side)",
    });
  }

  const ra = data["rightAngleAt"];
  if (ra !== undefined && (typeof ra !== "number" || !Number.isInteger(ra) || ra < 0 || ra > 2)) {
    issues.push({ path: `${path}.rightAngleAt`, message: "must be a vertex index 0, 1, or 2" });
  }

  return issues;
}
