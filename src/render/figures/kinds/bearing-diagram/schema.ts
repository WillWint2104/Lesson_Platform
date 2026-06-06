/**
 * @file schema.ts — bearing-diagram data validator (specVersion 1).
 * Conventions live in SPEC.md. This file ONLY validates shape.
 */
import type { Issue } from "@/ingest/validate";

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function validateBearingData(data: unknown, path: string): Issue[] {
  const issues: Issue[] = [];
  if (!isObject(data)) {
    issues.push({ path, message: "bearing-diagram data must be an object" });
    return issues;
  }

  const ids = new Set<string>();
  const points = data["points"];
  if (!Array.isArray(points) || points.length === 0) {
    issues.push({ path: `${path}.points`, message: "must be a non-empty array of points" });
  } else {
    points.forEach((p, i) => {
      const pp = `${path}.points[${i}]`;
      if (!isObject(p) || typeof p["id"] !== "string" || typeof p["x"] !== "number" || typeof p["y"] !== "number") {
        issues.push({ path: pp, message: "must be { id: string, x: number, y: number, label?: string }" });
        return;
      }
      if (ids.has(p["id"] as string)) {
        issues.push({ path: `${pp}.id`, message: `duplicate point id '${p["id"]}'` });
      }
      ids.add(p["id"] as string);
      if (p["label"] !== undefined && typeof p["label"] !== "string") {
        issues.push({ path: `${pp}.label`, message: "must be a string" });
      }
    });
  }

  const bearings = data["bearings"];
  if (bearings !== undefined) {
    if (!Array.isArray(bearings)) {
      issues.push({ path: `${path}.bearings`, message: "must be an array" });
    } else {
      bearings.forEach((b, i) => {
        const bp = `${path}.bearings[${i}]`;
        if (!isObject(b)) {
          issues.push({ path: bp, message: "must be { from, to, degrees }" });
          return;
        }
        if (typeof b["from"] !== "string" || !ids.has(b["from"] as string)) {
          issues.push({ path: `${bp}.from`, message: "must reference an existing point id" });
        }
        if (typeof b["to"] !== "string" || !ids.has(b["to"] as string)) {
          issues.push({ path: `${bp}.to`, message: "must reference an existing point id" });
        }
        const deg = b["degrees"];
        if (typeof deg !== "number" || deg < 0 || deg > 360) {
          issues.push({
            path: `${bp}.degrees`,
            message: "must be a number 0–360 (clockwise from north)",
          });
        }
      });
    }
  }

  return issues;
}
