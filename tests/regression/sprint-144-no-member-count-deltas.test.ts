/**
 * Sprint 144 (ADR-106) — application code never does arithmetic on communities.current_members.
 *
 * The database owns the counter: a sync trigger on communities.members applies every delta and a
 * column guard ignores any other write. An application `±1` is therefore already a no-op; this gate
 * is hygiene that keeps the dead arithmetic from coming back and misleading the next reader.
 *
 * It flags any assignment to `current_members`, optionally alias-qualified, whose right-hand side
 * (up to the next top-level `,`, `)`, `;`, backtick, WHERE, RETURNING or FROM) references
 * `current_members`, plus `current_members +=` / `-=`. A converging recompute whose right-hand side
 * is a count(*) subquery that never names the column is allowed (fission/fusion, D7).
 *
 * Scope: every source file of every services/*, apps/* and packages/* workspace — SQL strings and JavaScript
 * alike — except dependencies, build output and test directories. (The spec named each workspace's src folder;
 * apps/mobile keeps its
 * code in app/, services/ and components/, and packages/shared in api/, events/, middleware/ and utils/, so the
 * scan covers workspace roots.)
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

const ROOT = resolve(__dirname, '../..');
const EXTENSIONS = /\.(ts|tsx|js)$/;
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', '.next', '.expo', '.turbo', 'coverage', 'out',
  // Tests may spell the forbidden forms on purpose (fixtures, mocked SQL); generated landing data is JSON.
  'tests', '__tests__', 'data',
]);

type Finding = { file: string; line: number; text: string };

const ASSIGNMENT = /(?:\b[A-Za-z_$][\w$]*\.)?\bcurrent_members\s*(\+=|-=|=(?!=))/g;
const STOP_WORD = /^(WHERE|RETURNING|FROM)\b/i;

/** The right-hand side of an assignment starting at `from`, cut at the first top-level terminator. */
function rightHandSide(source: string, from: number): string {
  let depth = 0;
  let i = from;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0 && (ch === ',' || ch === ';' || ch === '`')) break;
    else if (depth === 0 && /\s/.test(source[i - 1] ?? ' ') && STOP_WORD.test(source.slice(i, i + 9))) break;
  }
  return source.slice(from, i);
}

export function findCounterDeltas(source: string, file: string): Finding[] {
  const findings: Finding[] = [];
  for (const match of source.matchAll(ASSIGNMENT)) {
    const operator = match[1];
    const start = match.index ?? 0;
    const rhs = rightHandSide(source, start + match[0].length);
    if (operator === '+=' || operator === '-=' || /\bcurrent_members\b/.test(rhs)) {
      const line = source.slice(0, start).split('\n').length;
      findings.push({ file, line, text: source.split('\n')[line - 1].trim() });
    }
  }
  return findings;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (EXTENSIONS.test(entry)) out.push(full);
  }
  return out;
}

function scanRoots(): string[] {
  const roots: string[] = [];
  for (const group of ['services', 'apps', 'packages']) {
    for (const workspace of readdirSync(join(ROOT, group))) {
      const dir = join(ROOT, group, workspace);
      if (statSync(dir).isDirectory() && !SKIP_DIRS.has(workspace)) roots.push(dir);
    }
  }
  return roots;
}

describe('Sprint 144 counter-delta detector', () => {
  it.each([
    ['SQL +1', "UPDATE communities.communities SET current_members = current_members + 1 WHERE id = $1"],
    ['SQL -1 without spaces', 'UPDATE communities.communities SET current_members=current_members-1 WHERE id=$1'],
    ['alias-qualified operand', 'UPDATE communities.communities c SET current_members = c.current_members - 1 WHERE c.id = $1'],
    ['alias-qualified target', 'UPDATE communities.communities c SET c.current_members = c.current_members + 1'],
    ['reversed operands', 'UPDATE communities.communities SET current_members = 1 + current_members WHERE id = $1'],
    ['wrapped in GREATEST', 'UPDATE communities.communities SET current_members = GREATEST(0, current_members - 1) WHERE id = $1'],
    ['multi-line SQL', 'UPDATE communities.communities\n       SET current_members = current_members\n         + 1\n       WHERE id = $1'],
    ['JS response arithmetic', 'existing.current_members = (existing.current_members ?? 0) + 1;'],
    ['JS +=', 'community.current_members += 1;'],
    ['JS -=', 'community.current_members -= 1;'],
    ['bare +=', 'current_members += 2'],
  ])('flags %s', (_label, source) => {
    expect(findCounterDeltas(`const sql = \`${source}\`;`, 'fixture.ts')).toHaveLength(1);
  });

  it.each([
    ['the fission recompute', `await q(
        \`UPDATE communities.communities
         SET current_members = (
           SELECT COUNT(*) FROM communities.members m
           WHERE m.community_id = $1 AND m.status = 'active'
         )
         WHERE id = $1\`,
        [childId]
      );`],
    ['the fusion recompute', `await client.query(
      \`UPDATE communities.communities
       SET current_members = (
         SELECT COUNT(*) FROM communities.members
         WHERE community_id = $1 AND status = 'active'
       )
       WHERE id = $1\`,
      [mergedId]
    );`],
    ['a plain read', 'const n = community.current_members ?? 0;'],
    ['a SELECT list', 'SELECT c.max_members, c.current_members, c.access_type FROM communities.communities c'],
    ['a comparison', "if (community.current_members >= community.max_members) return full;"],
    ['a strict equality', 'if (row.current_members === 0) skip();'],
    ['an insert column list', 'INSERT INTO communities.communities (name, max_members, current_members) VALUES ($1, $2, 0)'],
    ['a literal assignment', 'UPDATE communities.communities SET current_members = 0, max_members = 5 WHERE id = $1'],
    ['an object literal', 'const row = { current_members: 3, max_members: 150 };'],
    ['a SQL filter', 'WHERE c.current_members < c.max_members AND c.current_members >= $1'],
  ])('allows %s', (_label, source) => {
    expect(findCounterDeltas(source, 'fixture.ts')).toEqual([]);
  });

  it('reports the line of a delta inside a larger file', () => {
    const source = "const a = 1;\nconst b = 2;\nawait q(`UPDATE communities.communities SET current_members=current_members+1 WHERE id=$1`);\n";
    expect(findCounterDeltas(source, 'x.ts')).toEqual([{
      file: 'x.ts',
      line: 3,
      text: 'await q(`UPDATE communities.communities SET current_members=current_members+1 WHERE id=$1`);',
    }]);
  });
});

describe('Sprint 144 gate: no hand-written member-count arithmetic (ADR-106)', () => {
  it('scans every services, apps and packages workspace root, including code outside src/', () => {
    const roots = scanRoots().map((root) => relative(ROOT, root).replace(/\\/g, '/'));
    expect(roots).toEqual(expect.arrayContaining([
      'services/community-service',
      'services/social-graph-service',
      'services/simulation-service',
      'apps/frontend',
      'apps/mobile',
      'packages/shared',
    ]));
    const files = roots.flatMap((root) => sourceFiles(join(ROOT, root)))
      .map((file) => relative(ROOT, file).replace(/\\/g, '/'));
    expect(files).toEqual(expect.arrayContaining([
      'services/community-service/src/routes/members.ts',
      'packages/shared/events/routes.ts',
      'apps/mobile/services/api.ts',
    ]));
    expect(files.some((file) => /\/(node_modules|tests|\.next)\//.test(file))).toBe(false);
  });

  it('finds no self-referential current_members assignment', () => {
    const findings = scanRoots()
      .flatMap((root) => sourceFiles(root))
      .flatMap((file) => findCounterDeltas(readFileSync(file, 'utf8'), relative(ROOT, file).replace(/\\/g, '/')));
    expect(findings).toEqual([]);
  });
});
