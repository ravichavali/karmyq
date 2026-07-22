import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const initSql = readFileSync(join(ROOT, 'infrastructure', 'postgres', 'init.sql'), 'utf8');

describe('Sprint 120 generated init.sql drift gate', () => {
  it.each([
    ['generated-file fence', /GENERATED SCHEMA — DO NOT EDIT BY HAND/i],
    ['help-request status constraint', /chk_help_requests_status/i],
    ['trust decay configuration table', /social_graph\.trust_decay_config/i],
    [
      'trust-edge stability column',
      /CREATE TABLE social_graph\.trust_edges[\s\S]*?\bstability\s+(?:double precision|numeric|real)/i,
    ],
    [
      'global NULL-dedup guard index',
      /CREATE UNIQUE INDEX(?: IF NOT EXISTS)? uq_[a-z0-9_]*_global/i,
    ],
    ['lossless cached path score', /path_trust_score\s+double precision/i],
    [
      'migration ledger backfill',
      /INSERT INTO public\.schema_migrations\s*\(migration_name\)\s*VALUES/i,
    ],
  ])('contains the %s', (_description, sentinel) => {
    expect((sentinel as RegExp).test(initSql)).toBe(true);
  });
});
