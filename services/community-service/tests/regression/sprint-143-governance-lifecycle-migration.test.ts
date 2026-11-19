import { readFileSync } from 'fs';
import { resolve } from 'path';

const migrationPath = resolve(
  __dirname,
  '../../../../infrastructure/postgres/migrations/20261115-governance-nomination-lifecycle.sql',
);

describe('Sprint 143 governance lifecycle migration', () => {
  it('keeps expiry setup and guards in one autocommit-safe DO statement', () => {
    const sql = readFileSync(migrationPath, 'utf8').replace(/^\s*--.*$/gm, '').trim();
    expect(sql.match(/DO \$migration\$/g)).toHaveLength(1);
    expect(sql).toMatch(/^DO \$migration\$/);
    const outsideDo = sql.replace(/\$migration\$[\s\S]*\$migration\$/, '');
    expect(outsideDo).not.toMatch(/\b(?:BEGIN|COMMIT|LOCK TABLE)\b/);
  });

  it('adds the default and backfills v1 history before enforcing expiry metadata', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const orderedFragments = [
      'ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ',
      "SET DEFAULT (now() + interval '30 days')",
      'WHERE quorum_policy_version = 1 AND expires_at IS NULL',
      'ADD CONSTRAINT governance_expiry_metadata CHECK',
    ];
    const offsets = orderedFragments.map((fragment) => sql.indexOf(fragment));
    expect(offsets.every((offset) => offset >= 0)).toBe(true);
    expect(offsets).toEqual([...offsets].sort((left, right) => left - right));
  });

  it('allows exactly the four historical statuses plus declined and expired', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const statusCheck = sql.match(
      /ADD CONSTRAINT valid_nomination_status CHECK \(status IN \(([^)]+)\)\)/,
    );
    expect(statusCheck).not.toBeNull();
    expect(statusCheck?.[1].match(/'[^']+'/g)).toEqual([
      "'pending'",
      "'ratified'",
      "'rejected'",
      "'withdrawn'",
      "'declined'",
      "'expired'",
    ]);
  });

  it('preserves every Sprint 142 guard and adds expiry refusal for ballots and ratification', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain("current_setting('app.governance_policy_version', true) IS DISTINCT FROM '1'");
    expect(sql).toContain("RAISE EXCEPTION 'GOVERNANCE_PROTOCOL_REQUIRED' USING ERRCODE = '23514'");
    expect(sql).toContain('NEW.quorum_policy_version IS DISTINCT FROM 1 OR NEW.electorate_size IS NULL');
    expect(sql).toContain("RAISE EXCEPTION 'GOVERNANCE_POLICY_METADATA_REQUIRED' USING ERRCODE = '23514'");
    expect(sql).toContain("RAISE EXCEPTION 'GOVERNANCE_NOMINATION_EXPIRED' USING ERRCODE = '23514'");
    expect(sql.match(/GOVERNANCE_NOMINATION_EXPIRED/g)).toHaveLength(2);
    expect(sql).toMatch(/governance_ratifications[\s\S]*expires_at <= now\(\)/);
    expect(sql).toMatch(/NEW\.status = 'ratified'[\s\S]*NEW\.expires_at <= now\(\)/);
  });

  it('documents self-leave separately from staff removal', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toMatch(/COMMENT ON COLUMN communities\.members\.status IS '[^']*left:[^']*inactive:[^']*'/);
  });
});
