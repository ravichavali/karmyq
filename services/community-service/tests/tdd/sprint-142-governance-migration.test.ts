import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Sprint 142 migration applier contract', () => {
  const path = resolve(__dirname, '../../../../infrastructure/postgres/migrations/20261112-governance-quorum.sql');

  it('keeps the lock, legacy close and guard installation in one autocommit-safe DO statement', () => {
    const sql = readFileSync(path, 'utf8').replace(/^\s*--.*$/gm, '').trim();
    expect(sql).toMatch(/^DO \$migration\$/);
    expect(sql).toMatch(/END;\s*\$migration\$;$/);
    const outsideDo = sql.replace(/\$migration\$[\s\S]*\$migration\$/, '');
    expect(outsideDo).not.toMatch(/\b(?:BEGIN|COMMIT|LOCK TABLE)\b/);
    expect(sql).toContain('communities.governance_nomination_voters');
  });
});
