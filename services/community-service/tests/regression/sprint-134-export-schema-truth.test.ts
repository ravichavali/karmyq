/**
 * Sprint 134 PR A (BUG-063) — schema-truth gate for the community export router.
 *
 * BUG-063 shipped because the only test of `export.ts` mocked `pool.query` with regexes that encoded
 * the wrong names (`community.memberships`), so every route 500'd in every environment while the
 * suite stayed green. This gate reads the router's SQL and `infrastructure/postgres/init.sql` as text
 * and checks, per `pool.query` template:
 *   - every `FROM|JOIN schema.table` is a `CREATE TABLE` in init.sql;
 *   - every `alias.column` names a column of the table that alias is bound to;
 *   - an alias is bound to one table only, and every qualifier is a bound alias;
 *   - single-table queries: every bare identifier is a column of that table;
 *   - joined queries: no bare identifier names a column (it would be ambiguous or unchecked);
 *   - `'alias.column'` literals inside `${...}` (the date filter) are checked like the SQL itself.
 * The negative fixtures prove each rule can fail.
 */
import fs from 'fs';
import path from 'path';

const REPO = path.resolve(__dirname, '../../../..');
const EXPORT_TS = path.join(REPO, 'services/community-service/src/routes/export.ts');
const INIT_SQL = path.join(REPO, 'infrastructure/postgres/init.sql');

const KEYWORDS = new Set([
  'select', 'from', 'where', 'and', 'or', 'not', 'as', 'order', 'by', 'asc', 'desc', 'join', 'left',
  'inner', 'on', 'distinct', 'is', 'null', 'true', 'false', 'case', 'when', 'then', 'else', 'end',
  'exists', 'in', 'limit', 'group', 'having', 'between', 'like', 'ilike',
]);

/** `schema.table` → its column names, from every `CREATE TABLE schema.table (...);` in init.sql. */
function parseSchema(initSql: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const re = /^CREATE TABLE (\w+)\.(\w+) \(\r?\n([\s\S]*?)\r?\n\);/gm;
  for (let m = re.exec(initSql); m; m = re.exec(initSql)) {
    const columns = m[3].split(/\r?\n/)
      .map(line => line.trim().split(/\s+/)[0].replace(/"/g, ''))
      .filter(name => name && name !== 'CONSTRAINT');
    tables.set(`${m[1]}.${m[2]}`, new Set(columns));
  }
  return tables;
}

/** The SQL text of every `pool.query(\`...\`)` call. */
function extractQueries(source: string): string[] {
  return [...source.matchAll(/pool\.query\(\s*`([\s\S]*?)`/g)].map(m => m[1]);
}

/** Every `.query(` call whose SQL is not an inline template literal, so `extractQueries` cannot check it. */
function unscannableQueries(source: string): string[] {
  return [...source.matchAll(/\b(\w+)\.query\(\s*([^\s])/g)]
    .filter(m => m[1] !== 'pool' || m[2] !== '`')
    .map(m => `${m[1]}.query(${m[2]}`);
}

/** Every schema-truth violation in `queries`, de-duplicated and sorted. */
function checkQueries(queries: string[], schema: Map<string, Set<string>>): string[] {
  const problems = new Set<string>();
  for (const raw of queries) {
    // Column literals the date filter interpolates, e.g. ${dateClauseFor('m.joined_at')}.
    const interpolatedRefs = [...raw.matchAll(/\$\{([^}]*)\}/g)]
      .flatMap(m => [...m[1].matchAll(/'(\w+)\.(\w+)'/g)].map(r => [r[1], r[2]] as const));

    let sql = raw
      .replace(/\$\{[^}]*\}/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/'[^']*'/g, ' ')
      .replace(/"[^"]*"/g, ' ')
      .replace(/\$\d+/g, ' ');

    // Bind aliases, then blank the bindings so later scans don't read them as columns.
    const aliases = new Map<string, string>();
    const bound: string[] = [];
    sql = sql.replace(/\b(FROM|JOIN)\s+(\w+)\.(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi, (_all, kw, s, t, alias) => {
      const table = `${s}.${t}`;
      bound.push(table);
      if (!schema.has(table)) problems.add(`unknown table ${table}`);
      const hasAlias = alias && !KEYWORDS.has(alias.toLowerCase());
      if (hasAlias) {
        const prior = aliases.get(alias);
        if (prior && prior !== table) problems.add(`alias ${alias} bound to both ${prior} and ${table}`);
        aliases.set(alias, table);
      }
      return hasAlias ? ` ${kw} ` : ` ${kw} ${alias ?? ''} `;
    });
    for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+([a-z_]\w*)\b(?!\s*\.)/gi)) {
      if (!KEYWORDS.has(m[1].toLowerCase())) problems.add(`unqualified table ${m[1]}`);
    }

    const checkRef = (alias: string, column: string) => {
      const table = aliases.get(alias);
      if (!table) problems.add(`unbound qualifier ${alias}.${column}`);
      else if (schema.has(table) && !schema.get(table)!.has(column)) {
        problems.add(`${table} has no column ${column} (${alias}.${column})`);
      }
    };
    for (const [alias, column] of interpolatedRefs) checkRef(alias, column);
    for (const m of sql.matchAll(/\b(\w+)\.(\w+)\b/g)) checkRef(m[1], m[2]);

    // Bare identifiers: not qualified, not a qualifier, not a function call, not an AS name or ::cast.
    const bare = [...sql.matchAll(/(?<![.\w:])([a-z_]\w*)\b(?!\s*[.(])/gi)]
      .filter(m => !KEYWORDS.has(m[1].toLowerCase()))
      .filter(m => !/\bAS\s+$/i.test(sql.slice(0, m.index)))
      .map(m => m[1]);
    const tables = [...new Set(bound)];
    if (tables.length === 1) {
      const columns = schema.get(tables[0]);
      for (const name of bare) {
        if (columns && !columns.has(name)) problems.add(`${tables[0]} has no column ${name}`);
      }
    } else {
      for (const name of bare) {
        const owners = tables.filter(t => schema.get(t)?.has(name));
        problems.add(owners.length > 0
          ? `unqualified column ${name} in a joined query (${owners.join(', ')})`
          : `unknown bare identifier ${name} in a joined query`);
      }
    }
  }
  return [...problems].sort();
}

describe('Sprint 134 PR A — community export SQL matches init.sql (BUG-063)', () => {
  const schema = parseSchema(fs.readFileSync(INIT_SQL, 'utf8'));
  const exportSource = fs.readFileSync(EXPORT_TS, 'utf8');
  const exportQueries = extractQueries(exportSource);

  it('can see every query the router runs (no SQL outside an inline pool.query template)', () => {
    expect(unscannableQueries(exportSource)).toEqual([]);
  });

  it('parses init.sql and finds the router\'s queries', () => {
    expect(schema.get('communities.members')).toEqual(new Set([
      'id', 'community_id', 'user_id', 'role', 'invited_by', 'status', 'join_request_message', 'joined_at',
    ]));
    expect(schema.get('communities.norm_approvals')).toEqual(new Set(['id', 'norm_id', 'approved_by', 'approved_at']));
    // 3 admin checks + community + members + requests + matches + norms + settings + karma + members CSV + activity.
    expect(exportQueries).toHaveLength(12);
  });

  it('names only tables and columns that exist in init.sql', () => {
    expect(checkQueries(exportQueries, schema)).toEqual([]);
  });

  describe('negative fixtures (each rule can fail)', () => {
    it('reports a query the extractor cannot read: a quoted string, a variable, or another client', () => {
      const source = [
        "await pool.query('SELECT role FROM community.memberships WHERE user_id = $1', [u]);",
        'await pool.query(sql, params);',
        'await client.query(`SELECT 1`);',
        'await pool.query(`SELECT 1`);',
      ].join('\n');
      expect(unscannableQueries(source)).toEqual(["pool.query('", 'pool.query(s', 'client.query(`']);
      expect(extractQueries(source)).toEqual(['SELECT 1']);
    });

    it('reads a template that starts on the line after pool.query( (Codex review)', () => {
      const source = 'await pool.query(\n  `SELECT role FROM community.memberships WHERE user_id = $1`, [u]);';
      expect(unscannableQueries(source)).toEqual([]);
      expect(extractQueries(source)).toEqual(['SELECT role FROM community.memberships WHERE user_id = $1']);
      expect(checkQueries(extractQueries(source), schema)).toEqual(['unknown table community.memberships']);
    });

    it('reports a wrong schema and a nonexistent qualified column', () => {
      expect(checkQueries([
        'SELECT role FROM community.memberships WHERE community_id = $1',
        'SELECT m.id, m.created_at FROM communities.members m WHERE m.community_id = $1',
      ], schema)).toEqual([
        'communities.members has no column created_at (m.created_at)',
        'unknown table community.memberships',
      ]);
    });

    it('reports a nonexistent bare column in a single-table query', () => {
      expect(checkQueries(['SELECT request_ttl_days, match_ttl_days FROM communities.settings WHERE community_id = $1'], schema))
        .toEqual(['communities.settings has no column match_ttl_days']);
    });

    it('reports an unqualified column in a joined query', () => {
      expect(checkQueries([
        'SELECT m.id FROM communities.members m JOIN auth.users u ON m.user_id = u.id WHERE created_at >= $2',
      ], schema)).toEqual(['unqualified column created_at in a joined query (auth.users)']);
    });

    it('reports a bare identifier no joined table has (a typo is not silently ignored)', () => {
      expect(checkQueries([
        "SELECT m.id FROM communities.members m JOIN auth.users u ON m.user_id = u.id WHERE stauts = 'active' ORDER BY created_on",
      ], schema)).toEqual([
        'unknown bare identifier created_on in a joined query',
        'unknown bare identifier stauts in a joined query',
      ]);
    });

    it('checks interpolated date-filter columns against the alias they name', () => {
      expect(checkQueries([
        "SELECT m.id FROM communities.members m WHERE m.community_id = $1 ${dateClauseFor('m.created_at')}",
      ], schema)).toEqual(['communities.members has no column created_at (m.created_at)']);
    });

    it('reports an unbound qualifier and an alias rebound to a different table', () => {
      expect(checkQueries([
        'SELECT x.id FROM communities.members m WHERE m.community_id = $1',
        'SELECT r.id, (SELECT COUNT(*) FROM requests.matches r) FROM requests.help_requests r',
      ], schema)).toEqual([
        'alias r bound to both requests.matches and requests.help_requests',
        'unbound qualifier x.id',
      ]);
    });

    it('accepts aliases, AS names, casts, string literals and comments', () => {
      expect(checkQueries([
        `SELECT u.name as "Member", COUNT(*)::int AS total, to_char(m.joined_at, 'YYYY-MM-DD') as joined
         FROM communities.members m JOIN auth.users u ON m.user_id = u.id
         WHERE /* not-directed */ m.status = 'active' AND m.community_id = $1`,
      ], schema)).toEqual([]);
    });
  });
});
