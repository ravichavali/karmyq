// tests/regression/sprint-122-adr-060-code-scanning-gate.test.ts
//
// Locks the ADR-060 code-scanning gate against the defect found in Sprint 122: on `pull_request`
// events the gate queried `github.ref` (= refs/pull/N/MERGE) and `github.sha` (= the ephemeral
// merge commit), while CodeQL default setup publishes to refs/pull/N/HEAD. The query could never
// match, so the gate fail-opened on every PR and had never blocked one.
//
// Verified against the live API at the time of the fix: querying PR #194's merge ref returned 0
// analyses; querying its head ref returned 1.
//
// A green gate run cannot distinguish a working gate from an inert one, so this file asserts BOTH
// the ref/sha resolution AND that the real script actually blocks on a seeded critical finding.

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
    // The regression was exactly this interpolation inside the API query strings.
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

describe('ADR-060 gate — proves it can actually FAIL', () => {
  const alert = (severity: string) => [
    {
      number: 42,
      rule: { id: 'js/command-line-injection', security_severity_level: severity },
      most_recent_instance: { location: { path: 'scripts/example.js', start_line: 17 } },
    },
  ]

  /** Runs the shipped gate script with `gh` stubbed to return a seeded alert set. */
  function runGate(alerts: unknown[]): number {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'adr060-'))
    try {
      fs.writeFileSync(path.join(work, 'gate.sh'), extractGateScript())
      const alertsPath = path.join(work, 'alerts.json').replace(/\\/g, '/')
      fs.writeFileSync(alertsPath, JSON.stringify(alerts))

      // Emulates the two endpoints plus gh's built-in --jq post-processing.
      const ghStub = `#!/usr/bin/env bash
url=""; jqexpr=""
while [ $# -gt 0 ]; do
  case "$1" in
    --jq) jqexpr="$2"; shift 2 ;;
    --paginate|api) shift ;;
    *) [ -z "$url" ] && url="$1"; shift ;;
  esac
done
if [[ "$url" == *"/analyses"* ]]; then echo 1; exit 0; fi
if [[ "$url" == *"/alerts"* ]]; then
  node -e '
    const a=require("${alertsPath}");
    const hits=a.filter(x=>["critical","high"].includes(x.rule.security_severity_level));
    const fmt=process.argv[1].includes("  - #");
    hits.forEach(h=>console.log(fmt
      ? "  - #"+h.number+" "+h.rule.id+" "+h.most_recent_instance.location.path+":"+h.most_recent_instance.location.start_line
      : h.number));
  ' "$jqexpr"
  exit 0
fi
exit 0
`
      const ghPath = path.join(work, 'gh')
      fs.writeFileSync(ghPath, ghStub)
      fs.chmodSync(ghPath, 0o755)

      // Stub `sleep` to a no-op. The real script retries 10x with `sleep 30`, so a script that
      // stops finding analyses would otherwise hang this suite for 5 minutes per case instead of
      // failing fast — which is exactly what happened when this test was mutation-checked.
      const sleepPath = path.join(work, 'sleep')
      fs.writeFileSync(sleepPath, '#!/usr/bin/env bash\nexit 0\n')
      fs.chmodSync(sleepPath, 0o755)

      try {
        execFileSync('bash', [path.join(work, 'gate.sh')], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PATH: work + path.delimiter + process.env.PATH,
            GITHUB_EVENT_NAME: 'pull_request',
            SCAN_REF: 'refs/pull/999/head',
            SCAN_SHA: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
          },
        })
        return 0
      } catch (e) {
        return (e as { status: number }).status
      }
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
    }
  }

  it('BLOCKS (exit 1) on a seeded critical finding', () => {
    expect(runGate(alert('critical'))).toBe(1)
  })

  it('BLOCKS (exit 1) on a seeded high finding', () => {
    expect(runGate(alert('high'))).toBe(1)
  })

  it('passes on medium-only findings', () => {
    expect(runGate(alert('medium'))).toBe(0)
  })

  it('passes when there are no findings', () => {
    expect(runGate([])).toBe(0)
  })
})
