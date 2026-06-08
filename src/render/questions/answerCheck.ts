/**
 * @file answerCheck.ts — algebraic-equivalence answer checking (design-language-v2 §8).
 *
 * The student types their final answer; we mark it by ALGEBRAIC EQUIVALENCE, not
 * string match — so `4x+12`, `12+4x`, and `4(x+3)` all pass against `4x+12`.
 * 100% client-side (math.js), no API/backend, so it works on static hosting.
 *
 * Method: normalise both sides (strip `$…$` + a small LaTeX subset), parse with
 * math.js, then evaluate BOTH at several deterministic non-integer points and
 * compare within a relative epsilon. For polynomials (the exercise domain),
 * agreement at many distinct points means equivalence — and unlike `simplify`,
 * it also catches factored forms like `4(x+3)`. Any parse/eval failure, or an
 * empty input, marks INCORRECT (never throws, never crashes the runtime).
 */
import { parse, type MathNode } from "mathjs";

const RESERVED = new Set(["e", "pi", "i", "tau", "Infinity", "NaN"]);
const SAMPLE_POINTS = 16;
const EPSILON = 1e-6;

/** Strip `$…$`/`$$…$$` delimiters and a small LaTeX subset down to math.js syntax. */
export function normalizeMathInput(raw: string): string {
  let s = raw.trim();
  // Surrounding math delimiters (authored answers carry them; students don't).
  s = s.replace(/^\$\$?/, "").replace(/\$\$?$/, "").trim();
  s = s
    .replace(/\\left|\\right/g, "")
    .replace(/\\,|\\;|\\!|\\quad|\\qquad/g, " ")
    .replace(/\\times|\\cdot/g, "*")
    .replace(/\\div/g, "/")
    // \frac / \tfrac / \dfrac / \cfrac {a}{b}  ->  ((a)/(b))
    .replace(/\\[tdc]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "(($1)/($2))")
    .replace(/[{}]/g, "") // remaining TeX braces, e.g. x^{2} -> x^2
    .replace(/\\[a-zA-Z]+/g, ""); // drop any other leftover commands
  return s.trim();
}

function freeVariables(node: MathNode): string[] {
  const out = new Set<string>();
  node.traverse((n) => {
    // SymbolNode carries a `name`; constants (e, pi, …) are excluded.
    if (n.type === "SymbolNode") {
      const name = (n as unknown as { name: string }).name;
      if (!RESERVED.has(name)) out.add(name);
    }
  });
  return [...out];
}

/**
 * Are two math expressions algebraically equivalent? `student` is the learner's
 * raw input; `canonical` is the authored answer. Empty/garbage input → false.
 */
export function checkEquivalence(student: string, canonical: string): boolean {
  const a = normalizeMathInput(student);
  const b = normalizeMathInput(canonical);
  if (a === "" || b === "") return false;

  let na: MathNode;
  let nb: MathNode;
  try {
    na = parse(a);
    nb = parse(b);
  } catch {
    return false;
  }

  const vars = [...new Set([...freeVariables(na), ...freeVariables(nb)])];
  let ca: ReturnType<MathNode["compile"]>;
  let cb: ReturnType<MathNode["compile"]>;
  try {
    ca = na.compile();
    cb = nb.compile();
  } catch {
    return false;
  }

  for (let t = 0; t < SAMPLE_POINTS; t++) {
    const scope: Record<string, number> = {};
    // Distinct non-integer values per variable + per sample, to avoid the
    // coincidental agreement that integer roots could produce.
    vars.forEach((v, i) => {
      scope[v] = 2 + t * 1.3 + i * 0.7;
    });
    let va: unknown;
    let vb: unknown;
    try {
      va = ca.evaluate(scope);
      vb = cb.evaluate(scope);
    } catch {
      return false;
    }
    if (typeof va !== "number" || typeof vb !== "number" || !Number.isFinite(va) || !Number.isFinite(vb)) {
      return false;
    }
    if (Math.abs(va - vb) > EPSILON * (1 + Math.abs(va))) return false;
  }
  return true;
}
