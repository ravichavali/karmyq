/**
 * A MODEL of the GitHub Actions expression subset our workflow `if:` conditions use.
 *
 * Shared by the workflow gates (Sprint 129 demo-health, Sprint 134 expo-sdk-drift). It cannot
 * prove a workflow runs correctly on GitHub; it proves a condition still reports in every
 * failure shape, so nobody can quietly narrow it back to an outputs-only test.
 */

/** A simulated GitHub step/job state. */
export interface Ctx {
  jobFailed: boolean;
  outcome: string;
  outputs: Record<string, string>;
}

const STATUS_FUNCTION = /\b(always|failure|success|cancelled)\(\)/;

/**
 * Evaluate a condition against a simulated state.
 *
 * Deliberately refuses anything outside a small allowlist rather than trying to be a general
 * parser: if a future condition needs syntax this cannot model, the test must fail loudly instead
 * of silently approving an expression it does not understand.
 *
 * GitHub prefixes `success() &&` to a condition that calls no status function. That implicit
 * term is the whole bug class (an outputs-only step is SKIPPED once an earlier step fails), so
 * the model applies it too.
 */
export function evaluateCondition(expr: string, ctx: Ctx): boolean {
  const normalized = expr.replace(/\s+/g, ' ').trim();

  // Allowlist: functions, step references, string literals, boolean operators, parens.
  const allowed =
    /^[\sA-Za-z0-9_.'()!=&|]+$/.test(normalized) &&
    !/[;`${}[\]]/.test(normalized);
  if (!allowed) {
    throw new Error(
      `Condition uses syntax this test cannot model, so it cannot be verified: ${normalized}`,
    );
  }

  let js = STATUS_FUNCTION.test(normalized) ? normalized : `success() && (${normalized})`;
  js = js.replace(/\balways\(\)/g, 'true');
  js = js.replace(/\bfailure\(\)/g, String(ctx.jobFailed));
  js = js.replace(/\bsuccess\(\)/g, String(!ctx.jobFailed));
  js = js.replace(/\bcancelled\(\)/g, 'false');
  js = js.replace(/steps\.[A-Za-z0-9_-]+\.outputs\.([A-Za-z0-9_-]+)/g, (_m, name) =>
    JSON.stringify(ctx.outputs[name] ?? ''),
  );
  js = js.replace(/steps\.[A-Za-z0-9_-]+\.outcome/g, JSON.stringify(ctx.outcome));

  if (/steps\./.test(js) || /[A-Za-z_]\w*\s*\(/.test(js)) {
    throw new Error(`Unresolved reference or unmodelled function in condition: ${js}`);
  }

  // eslint-disable-next-line no-new-func
  return Boolean(new Function(`"use strict"; return (${js});`)());
}
