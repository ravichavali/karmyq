// tests/regression/sprint-122-adr-060-code-scanning-gate.test.ts
//
// Locks the ADR-060 code-scanning gate. Two defects are under proof here:
//
// 1. Sprint 122: on `pull_request` events the gate queried `github.ref` (= refs/pull/N/MERGE) and
//    `github.sha` (= the ephemeral merge commit) while CodeQL publishes to refs/pull/N/HEAD, so the
//    query could never match and the gate fail-opened on every PR. Verified live: PR #194's merge
//    ref returned 0 analyses, its head ref returned 1.
//
// 2. Review of PR #195: breaking the poll on the FIRST analysis to appear let the gate pass before
//    javascript-typescript had run. Measured on #195 at sha 27e2d474 — `actions` published
//    04:00:04Z, `javascript-typescript` 04:01:10Z, and the gate reported clean at 04:00:10Z, a full
//    66 seconds before the JS analysis existed. A late JS high/critical would have escaped.
//
// A green gate run cannot distinguish a working gate from an inert one, so this file drives the
// SHIPPED script (extracted from ci.yml) against a stubbed `gh` and asserts the failing directions:
// blocking on findings, refusing to fail open on API errors, and waiting for every analysis
// category. The stub honours the workflow's own jq severity predicate rather than reimplementing
// it, so narrowing that predicate in ci.yml breaks these tests instead of silently passing them.

import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const CI_YML = path.join(__dirname, '..', '..', '.github', 'workflows', 'ci.yml')
const ci = fs.readFileSync(CI_YML, 'utf8')

/** Pulls the gate step's `run: |` body out of the workflow, so we test the shipped script. */
function extractGateScript(): string {
  const lines = ci.split('\n')
  const stepIdx = lines.findIndex((l) => l.includes('Fail on open critical/high CodeQL alerts'))
  expect(stepIdx).toBeGreaterThan(-1)
  const runIdx = lines.findIndex((l, i) => i > stepIdx && /^\s*run:\s*\|/.test(l))
  expect(runIdx).toBeGreaterThan(-1)

  const indent = lines[runIdx + 1].match(/^\s*/)![0].length
  const body: string[] = []
  for (let i = runIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() && line.match(/^\s*/)![0].length < indent) break
    body.push(line.slice(indent))
  }
  return body.join('\n').replace(/\$\{\{ github\.repository \}\}/g, 'karmyq/karmyq')
}

type Alert = {
  number: number
  rule: { id: string; security_severity_level: string }
  most_recent_instance: { location: { path: string; start_line: number } }
}

type Scenario = {
  /** Categories the DEFAULT BRANCH publishes — the arbiter for what must be present. */
  baseline?: string[]
  /** Analysis categories present for the SHA under test (e.g. "/language:actions"). */
  categories?: string[]
  /** Open alerts the alerts endpoint returns before jq filtering. */
  alerts?: Alert[]
  /** Which query (if any) should hard-fail, simulating an API/auth/rate-limit error. */
  failEndpoint?: 'baseline' | 'analyses' | 'alerts'
  /** Fail that query only for the first N calls, then succeed — a transient 502/rate-limit. */
  failTimes?: number
  /** Categories published for OTHER commits on the same ref (the API returns these too). */
  foreignCategories?: string[]
  /** Raw baseline rows (category + commit_sha) for testing the "current config" derivation. */
  baselineRows?: Array<{ category: string; commit_sha: string }>
}

const alertOf = (severity: string, number = 42): Alert => ({
  number,
  rule: { id: 'js/command-line-injection', security_severity_level: severity },
  most_recent_instance: { location: { path: 'scripts/example.js', start_line: 17 } },
})

const BOTH_CATEGORIES = ['/language:actions', '/language:javascript-typescript']

/**
 * Runs the shipped gate script with `gh` stubbed. Returns exit code + combined output.
 *
 * The stub deliberately does NOT hardcode the severity filter: it parses the
 * `security_severity_level=="…"` literals out of the jq expression the workflow actually passes,
 * so dropping `high` from ci.yml makes the seeded-high expectations fail.
 */
function runGate(scenario: Scenario): { code: number; out: string } {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'adr060-'))
  try {
    fs.writeFileSync(path.join(work, 'gate.sh'), extractGateScript())
    fs.writeFileSync(
      path.join(work, 'config.json'),
      JSON.stringify({
        baseline: scenario.baseline ?? BOTH_CATEGORIES,
        baselineRows: scenario.baselineRows ?? null,
        categories: scenario.categories ?? BOTH_CATEGORIES,
        foreignCategories: scenario.foreignCategories ?? [],
        alerts: scenario.alerts ?? [],
        failEndpoint: scenario.failEndpoint ?? null,
        failTimes: scenario.failTimes ?? null,
        counterFile: path.join(work, 'calls').replace(/\\/g, '/'),
      })
    )

    // Emulates the three endpoints plus gh's built-in --jq post-processing.
    fs.writeFileSync(
      path.join(work, 'stub.js'),
      `
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync(__dirname + '/config.json', 'utf8'));
const [url, jqexpr] = process.argv.slice(2);
const SCAN_SHA = process.env.SCAN_SHA;
const hit = (name) => url.includes('/' + name);

// Both /analyses queries look alike; the baseline one targets refs/heads/<default branch>,
// the per-SHA one targets the PR head ref. (It no longer carries sha= — that parameter is
// ignored by the API, so filtering moved client-side.)
const which = hit('alerts') ? 'alerts' : url.includes('refs/heads/') ? 'baseline' : 'analyses';

if (cfg.failEndpoint === which) {
  // failTimes = transient: fail the first N calls to this endpoint, then recover.
  let n = 0;
  try { n = JSON.parse(fs.readFileSync(cfg.counterFile, 'utf8'))[which] || 0; } catch {}
  const transient = cfg.failTimes !== null && n >= cfg.failTimes;
  let all = {};
  try { all = JSON.parse(fs.readFileSync(cfg.counterFile, 'utf8')); } catch {}
  all[which] = n + 1;
  fs.writeFileSync(cfg.counterFile, JSON.stringify(all));
  if (!transient) {
    process.stderr.write('gh: simulated API failure for ' + which + '\\n');
    process.exit(1);
  }
}
if (which === 'baseline') {
  // Mirrors the workflow's jq: categories of the MOST RECENT analysed commit only.
  if (cfg.baselineRows) {
    const newest = cfg.baselineRows.length ? cfg.baselineRows[0].commit_sha : '';
    [...new Set(cfg.baselineRows.filter((r) => r.commit_sha === newest).map((r) => r.category))]
      .sort()
      .forEach((c) => console.log(c));
    process.exit(0);
  }
  cfg.baseline.forEach((c) => console.log(c));
  process.exit(0);
}
if (which === 'analyses') {
  // The real API IGNORES ?sha=, returning every analysis on the ref. The stub reproduces that:
  // it emits foreign-SHA rows too, so a gate that does not filter client-side will wrongly
  // count them. Output shape matches the workflow's jq: "<commit_sha> <category>".
  cfg.categories.forEach((c) => console.log(SCAN_SHA + ' ' + c));
  (cfg.foreignCategories || []).forEach((c) => console.log('0000000000000000000000000000000000000000 ' + c));
  process.exit(0);
}
if (hit('alerts')) {
  // Honour the WORKFLOW's predicate: read the severities out of the jq expression itself.
  const severities = [...(jqexpr || '').matchAll(/security_severity_level\\s*==\\s*"([a-z]+)"/g)].map(
    (m) => m[1]
  );
  if (!severities.length) throw new Error('no severity predicate found in jq expr: ' + jqexpr);
  cfg.alerts
    .filter((a) => severities.includes(a.rule.security_severity_level))
    .forEach((a) =>
      console.log(
        '  - #' + a.number + ' ' + a.rule.id + ' ' +
        a.most_recent_instance.location.path + ':' + a.most_recent_instance.location.start_line
      )
    );
  process.exit(0);
}
process.exit(0);
`
    )

    const ghPath = path.join(work, 'gh')
    fs.writeFileSync(
      ghPath,
      `#!/usr/bin/env bash
url=""; jqexpr=""
while [ $# -gt 0 ]; do
  case "$1" in
    --jq) jqexpr="$2"; shift 2 ;;
    --paginate|api) shift ;;
    *) [ -z "$url" ] && url="$1"; shift ;;
  esac
done
node "${work.replace(/\\/g, '/')}/stub.js" "$url" "$jqexpr"
`
    )
    fs.chmodSync(ghPath, 0o755)

    // Stub `sleep` to a no-op: the real script retries 10x with `sleep 30`, so a script that stops
    // finding analyses would otherwise hang this suite for 5 minutes per case.
    const sleepPath = path.join(work, 'sleep')
    fs.writeFileSync(sleepPath, '#!/usr/bin/env bash\nexit 0\n')
    fs.chmodSync(sleepPath, 0o755)

    const env = {
      ...process.env,
      PATH: work + path.delimiter + process.env.PATH,
      GITHUB_EVENT_NAME: 'pull_request',
      SCAN_REF: 'refs/pull/999/head',
      SCAN_SHA: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      DEFAULT_BRANCH: 'master',
    }

    try {
      // `-e` matches how GitHub Actions invokes it (`shell: /usr/bin/bash -e {0}`); running plain
      // bash here once hid an unguarded failure that only surfaced under -e in CI.
      const out = execFileSync('bash', ['-e', path.join(work, 'gate.sh')], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      })
      return { code: 0, out }
    } catch (e) {
      const err = e as { status: number; stdout?: string; stderr?: string }
      return { code: err.status, out: (err.stdout ?? '') + (err.stderr ?? '') }
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

describe('ADR-060 gate — scan target resolution', () => {
  it('resolves the PR HEAD ref, not the merge ref', () => {
    expect(ci).toMatch(/SCAN_REF:.*github\.event_name == 'pull_request'/)
    expect(ci).toMatch(/format\('refs\/pull\/\{0\}\/head', github\.event\.number\)/)
  })

  it('resolves the PR HEAD sha, not the merge commit sha', () => {
    expect(ci).toMatch(/SCAN_SHA:.*github\.event\.pull_request\.head\.sha/)
  })

  it('falls back to github.ref / github.sha on push events', () => {
    expect(ci).toMatch(/SCAN_REF:.*\|\|\s*github\.ref\s*\}\}/)
    expect(ci).toMatch(/SCAN_SHA:.*\|\|\s*github\.sha\s*\}\}/)
  })

  it('never queries the code-scanning API with the raw github.ref/github.sha again', () => {
    const gate = extractGateScript()
    expect(gate).toContain('$SCAN_REF')
    expect(gate).toContain('$SCAN_SHA')
    expect(gate).not.toMatch(/ref=\$\{\{ github\.ref \}\}/)
    expect(gate).not.toMatch(/sha=\$\{\{ github\.sha \}\}/)
  })

  it('applies the resolved ref to the ALERTS query too, not just the analyses poll', () => {
    const gate = extractGateScript()
    const alertQueries = gate.match(/code-scanning\/alerts\?[^"]*/g) ?? []
    expect(alertQueries.length).toBeGreaterThan(0)
    alertQueries.forEach((q) => expect(q).toContain('ref=$SCAN_REF'))
  })
})

describe('ADR-060 gate — baseline is the CURRENT config, not all history', () => {
  // `jq` is not installed on the Windows dev box, so the stub below models the baseline jq's
  // semantics rather than executing it. That means the behavioural tests cannot detect a change
  // to the expression itself — this assertion is what locks it. (Mutation-checked: replacing the
  // expression with `.[].category` turns this red.)
  it('selects only the newest analysed commit_sha', () => {
    const gate = extractGateScript()
    expect(gate).toMatch(/\$all\[0\]\.commit_sha/)
    expect(gate).toMatch(/select\(\.commit_sha == \$newest\)/)
  })
})

describe('ADR-060 gate — severity predicate', () => {
  it('blocks on BOTH critical and high (narrowing this predicate must break the tests below)', () => {
    const gate = extractGateScript()
    expect(gate).toMatch(/security_severity_level\s*==\s*"critical"/)
    expect(gate).toMatch(/security_severity_level\s*==\s*"high"/)
  })
})

describe('ADR-060 gate — proves it can actually FAIL', () => {
  it('BLOCKS (exit 1) on a seeded critical finding', () => {
    const { code, out } = runGate({ alerts: [alertOf('critical')] })
    expect(code).toBe(1)
    expect(out).toContain('blocking (ADR-060)')
  })

  it('BLOCKS (exit 1) on a seeded high finding', () => {
    const { code } = runGate({ alerts: [alertOf('high')] })
    expect(code).toBe(1)
  })

  it('reports every blocking alert, and the count matches the listing', () => {
    const { code, out } = runGate({ alerts: [alertOf('critical', 1), alertOf('high', 2)] })
    expect(code).toBe(1)
    expect(out).toContain('2 open critical/high')
    expect(out).toContain('#1')
    expect(out).toContain('#2')
  })

  it('passes on medium-only findings', () => {
    expect(runGate({ alerts: [alertOf('medium')] }).code).toBe(0)
  })

  it('passes when there are no findings', () => {
    const { code, out } = runGate({ alerts: [] })
    expect(code).toBe(0)
    expect(out).toContain('Code-scanning gate clean')
  })
})

describe('ADR-060 gate — waits for EVERY analysis category', () => {
  it('does not evaluate alerts while javascript-typescript is still missing', () => {
    const { out } = runGate({ categories: ['/language:actions'], alerts: [] })
    expect(out).toContain('Waiting for analyses')
    expect(out).toContain('javascript-typescript')
    // The premature "clean" verdict is the exact PR #195 defect.
    expect(out).not.toContain('Code-scanning gate clean')
  })

  it('fails open with a warning (not a clean verdict) when a category never arrives', () => {
    const { code, out } = runGate({ categories: ['/language:actions'], alerts: [] })
    expect(code).toBe(0)
    expect(out).toContain('Missing code-scanning analyses')
    expect(out).not.toContain('Code-scanning gate clean')
  })

  it('ignores an analysis belonging to a DIFFERENT commit on the same ref', () => {
    // The API ignores ?sha=, so it returns every analysis for the ref. Before this was filtered
    // client-side, a stale javascript-typescript analysis from an earlier commit satisfied the
    // readiness check — observed live on 13e273b6, whose own JS analysis had been cancelled.
    const { code, out } = runGate({
      categories: ['/language:actions'],
      foreignCategories: ['/language:javascript-typescript'],
      alerts: [],
    })
    expect(out).toContain('Waiting for analyses')
    expect(out).toContain('javascript-typescript')
    expect(out).not.toContain('Code-scanning gate clean')
    expect(code).toBe(0) // fail-open on genuinely missing, with a warning
  })

  it('proceeds once every required category is present', () => {
    const { code, out } = runGate({ categories: BOTH_CATEGORIES, alerts: [] })
    expect(code).toBe(0)
    expect(out).toContain('All required analyses present')
  })

  it('derives required categories from what the default branch publishes, not a hardcoded list', () => {
    // A repo whose base branch only ever publishes one category must not wait on the other.
    const { code, out } = runGate({
      baseline: ['/language:actions'],
      categories: ['/language:actions'],
      alerts: [],
    })
    expect(code).toBe(0)
    expect(out).toContain('All required analyses present')
    expect(out).not.toContain('Waiting for analyses')
  })

  it('fails open when the default branch has no analyses at all (nothing to require)', () => {
    const { code, out } = runGate({ baseline: [], categories: [], alerts: [] })
    expect(code).toBe(0)
    expect(out).toContain('nothing to require')
    expect(out).not.toContain('Code-scanning gate clean')
  })
})

describe('ADR-060 gate — refuses to fail open on API errors', () => {
  it('exits 1 when the analyses query errors (auth/rate-limit/5xx), rather than treating it as "no analysis"', () => {
    const { code, out } = runGate({ failEndpoint: 'analyses' })
    expect(code).toBe(1)
    expect(out).toContain('API error, not an empty result')
  })

  it('exits 1 when the baseline query errors, rather than guessing the required categories', () => {
    const { code, out } = runGate({ failEndpoint: 'baseline' })
    expect(code).toBe(1)
    expect(out).toContain('Could not read baseline analyses')
  })

  it('exits 1 when the alerts query errors, rather than reporting the gate clean', () => {
    const { code, out } = runGate({ failEndpoint: 'alerts' })
    expect(code).toBe(1)
    expect(out).not.toContain('Code-scanning gate clean')
  })
})

// A gate that reds on one transient 502 among ~11 API calls is its own kind of broken.
describe('ADR-060 gate — survives transient API errors', () => {
  it('retries a transient analyses failure instead of failing the job', () => {
    const { code, out } = runGate({ failEndpoint: 'analyses', failTimes: 2, alerts: [] })
    expect(code).toBe(0)
    expect(out).toContain('Code-scanning gate clean')
  })

  it('retries a transient baseline failure instead of failing the job', () => {
    const { code, out } = runGate({ failEndpoint: 'baseline', failTimes: 2, alerts: [] })
    expect(code).toBe(0)
    expect(out).toContain('Required analysis categories')
  })

  it('retries a transient alerts failure, and still blocks on the finding it then sees', () => {
    const { code } = runGate({
      failEndpoint: 'alerts',
      failTimes: 2,
      alerts: [alertOf('critical')],
    })
    expect(code).toBe(1)
  })
})

describe('ADR-060 gate — required categories reflect the CURRENT config', () => {
  it('does not keep requiring a language that the newest default-branch commit dropped', () => {
    // Historical analyses still mention `ruby`; the newest analysed commit does not.
    const { code, out } = runGate({
      baselineRows: [
        { category: '/language:actions', commit_sha: 'new' },
        { category: '/language:javascript-typescript', commit_sha: 'new' },
        { category: '/language:ruby', commit_sha: 'old' },
        { category: '/language:actions', commit_sha: 'old' },
      ],
      categories: BOTH_CATEGORIES,
      alerts: [],
    })
    expect(out).not.toContain('ruby')
    expect(out).toContain('All required analyses present')
    expect(code).toBe(0)
  })

  it('does require a language the newest commit added', () => {
    const { out } = runGate({
      baselineRows: [
        { category: '/language:actions', commit_sha: 'new' },
        { category: '/language:javascript-typescript', commit_sha: 'new' },
        { category: '/language:ruby', commit_sha: 'new' },
      ],
      categories: BOTH_CATEGORIES,
      alerts: [],
    })
    expect(out).toContain('ruby')
    expect(out).toContain('Waiting for analyses')
  })
})
