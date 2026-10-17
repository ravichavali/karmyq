/**
 * Sprint 133 PR D — live arbiters for the curated seed's enums (CLAUDE.md Discipline 5).
 *
 * The compiler holds the sets it validates against; this test locks each one to the file that
 * actually decides it, parsed at run time:
 *  - skill vocabulary: `INSERT INTO auth.skill_vocabulary` in infrastructure/postgres/migrations/*.sql
 *  - item category / condition / status: the `items_*_check` arrays in infrastructure/postgres/init.sql
 *  - offer TTL: `offer_ttl_days integer DEFAULT n` in `communities.settings` (init.sql)
 *  - offer category: the `<option value>`s of the type select in apps/frontend/src/pages/offers/new.tsx
 *    (`POST /offers` stores `type` as `category`; `requests.help_offers.category` has no CHECK)
 * Every parser has a negative fixture proving it finds a planted extra value, so a parser that
 * silently matches nothing cannot turn the comparison green.
 */

import fs from 'fs';
import path from 'path';
import {
  CURATED_DEMO_MANIFEST,
  compileManifest,
  ITEM_CATEGORIES,
  ITEM_CONDITIONS,
  ITEM_STATUSES,
  OFFER_CATEGORIES,
  OFFER_TTL_DAYS,
  SKILL_VOCABULARY,
  TEXT_LIMITS,
} from '../../src/fixtures/curatedDemo/compiler';

const REPO = path.resolve(__dirname, '../../../..');
const MIGRATIONS_DIR = path.join(REPO, 'infrastructure/postgres/migrations');
const INIT_SQL = path.join(REPO, 'infrastructure/postgres/init.sql');
const OFFER_FORM = path.join(REPO, 'apps/frontend/src/pages/offers/new.tsx');

const read = (file: string) => fs.readFileSync(file, 'utf8');
const migrationTexts = () =>
  fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort().map(f => read(path.join(MIGRATIONS_DIR, f)));
const sorted = (values: Iterable<string>) => [...values].sort();

/** slug -> label from every `INSERT INTO auth.skill_vocabulary (...) VALUES (...), ...;` statement. */
function parseVocabulary(sqlTexts: string[]): Map<string, string> {
  const vocabulary = new Map<string, string>();
  for (const sql of sqlTexts) {
    for (const insert of sql.matchAll(/INSERT\s+INTO\s+auth\.skill_vocabulary\s*\([^)]*\)\s*VALUES([\s\S]*?);/gi)) {
      for (const tuple of insert[1].matchAll(/\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/g)) {
        vocabulary.set(tuple[1].replace(/''/g, "'"), tuple[2].replace(/''/g, "'"));
      }
    }
  }
  return vocabulary;
}

/** The ARRAY[...] values of one named CHECK constraint; it must be declared exactly once. */
function parseCheckArray(initSql: string, constraint: string): string[] {
  const lines = initSql.split(/\r?\n/).filter(line => line.includes(`CONSTRAINT ${constraint} CHECK`));
  if (lines.length !== 1) throw new Error(`expected exactly one ${constraint} declaration, found ${lines.length}`);
  const array = /ARRAY\[([^\]]*)\]/.exec(lines[0]);
  if (!array) throw new Error(`${constraint} has no ARRAY[...] value list`);
  return [...array[1].matchAll(/'([^']*)'::/g)].map(m => m[1]);
}

/** `offer_ttl_days integer DEFAULT n` inside `CREATE TABLE communities.settings (...);`. */
function parseOfferTtlDefault(initSql: string): number {
  const table = /CREATE TABLE communities\.settings \(([\s\S]*?)\n\);/.exec(initSql);
  if (!table) throw new Error('CREATE TABLE communities.settings not found');
  const column = /\boffer_ttl_days\s+integer\s+DEFAULT\s+(\d+)/.exec(table[1]);
  if (!column) throw new Error('offer_ttl_days default not found');
  return Number(column[1]);
}

/** The `<option value>`s of the `<select id="type">` in the offer form. */
function parseOfferCategories(tsx: string): string[] {
  const select = /<select\b[^>]*\bid="type"[\s\S]*?<\/select>/.exec(tsx);
  if (!select) throw new Error('offer form type <select id="type"> not found');
  return [...select[0].matchAll(/<option\s+value="([^"]+)"/g)].map(m => m[1]);
}

/** varchar(n) of one column inside the CREATE TABLE statement of `table`. */
function parseVarcharLimit(initSql: string, table: string, column: string): number {
  const [schema, name] = table.split('.');
  const body = new RegExp(`CREATE TABLE ${schema}\\.${name} \\(([\\s\\S]*?)\\n\\);`).exec(initSql);
  if (!body) throw new Error('CREATE TABLE ' + table + ' not found');
  const col = new RegExp(`\\b${column}\\s+character varying\\((\\d+)\\)`).exec(body[1]);
  if (!col) throw new Error(table + '.' + column + ' varchar limit not found');
  return Number(col[1]);
}

describe('Sprint 133 PR D: seed enums equal their live arbiters', () => {
  it('uses init.sql varchar limits for tag value, item name and offer title', () => {
    const initSql = read(INIT_SQL);
    expect(TEXT_LIMITS).toEqual({
      tagValue: parseVarcharLimit(initSql, 'auth.user_tags', 'tag_value'),
      itemName: parseVarcharLimit(initSql, 'inventory.items', 'name'),
      offerTitle: parseVarcharLimit(initSql, 'requests.help_offers', 'title'),
    });
    // Negative: a drifted limit is parsed (and the comparison above would go red).
    const planted = initSql.replace(/(\bname character varying\()120\)/, "$1121)");
    expect(planted).not.toBe(initSql);
    expect(parseVarcharLimit(planted, 'inventory.items', 'name')).toBe(121);
  });

  it('uses only vocabulary slugs the migrations insert, with the migrations\' labels', () => {
    const vocabulary = parseVocabulary(migrationTexts());
    expect(vocabulary.get('cooking')).toBe('Cooking'); // non-vacuity: the parser reads the real file

    // Every slug the compiler knows is a real vocabulary row with the same label.
    const compilerVocabulary = Object.entries(SKILL_VOCABULARY);
    expect(compilerVocabulary.length).toBeGreaterThan(0);
    for (const [slug, label] of compilerVocabulary) expect({ slug, label: vocabulary.get(slug) }).toEqual({ slug, label });

    // Every manifest skill_slug occurs in the migrations, and its tag_value is that row's label.
    const slugged = compileManifest(CURATED_DEMO_MANIFEST, new Date('2026-10-20T12:00:00.000Z')).skills.filter(s => s.skillSlug !== null);
    expect(slugged.length).toBeGreaterThan(0);
    for (const skill of slugged) {
      expect({ key: skill.key, label: vocabulary.get(skill.skillSlug!) }).toEqual({ key: skill.key, label: skill.tagValue });
    }
  });

  it('uses the item category, condition and status sets of init.sql\'s CHECK constraints', () => {
    const initSql = read(INIT_SQL);
    expect(sorted(ITEM_CATEGORIES)).toEqual(sorted(parseCheckArray(initSql, 'items_category_check')));
    expect(sorted(ITEM_CONDITIONS)).toEqual(sorted(parseCheckArray(initSql, 'items_condition_check')));
    expect(sorted(ITEM_STATUSES)).toEqual(sorted(parseCheckArray(initSql, 'items_status_check')));
    expect(parseCheckArray(initSql, 'items_status_check')).toContain('available'); // non-vacuity
  });

  it('uses init.sql\'s offer_ttl_days default as the offer TTL', () => {
    expect(OFFER_TTL_DAYS).toBe(parseOfferTtlDefault(read(INIT_SQL)));
  });

  it('uses the offer form\'s type options as the offer category set', () => {
    const options = parseOfferCategories(read(OFFER_FORM));
    expect(options).toContain('transportation'); // non-vacuity
    expect(sorted(OFFER_CATEGORIES)).toEqual(sorted(options));
  });
});

describe('Sprint 133 PR D: each arbiter parser finds a planted extra value', () => {
  it('vocabulary parser', () => {
    const real = migrationTexts();
    const planted = real.map(sql =>
      sql.replace(/(INSERT\s+INTO\s+auth\.skill_vocabulary\s*\([^)]*\)\s*VALUES\s*)/i, "$1('zz_planted', 'Planted', ARRAY[]::text[]),\n  "));
    expect(planted).not.toEqual(real);
    const vocabulary = parseVocabulary(planted);
    expect(vocabulary.get('zz_planted')).toBe('Planted');
    expect(vocabulary.size).toBe(parseVocabulary(real).size + 1);
    // A second INSERT statement elsewhere is read too.
    expect(parseVocabulary([...real, "INSERT INTO auth.skill_vocabulary (slug, label, synonyms) VALUES ('zz_other', 'Other planted', ARRAY[]::text[]);"]).get('zz_other'))
      .toBe('Other planted');
  });

  it.each([
    ['items_category_check', ITEM_CATEGORIES],
    ['items_condition_check', ITEM_CONDITIONS],
    ['items_status_check', ITEM_STATUSES],
  ] as Array<[string, ReadonlySet<string>]>)('%s parser', (constraint, compilerSet) => {
    const initSql = read(INIT_SQL);
    const planted = initSql.split(/\r?\n/).map(line =>
      line.includes(`CONSTRAINT ${constraint} CHECK`) ? line.replace(/ARRAY\[/, "ARRAY['zz_planted'::character varying, ") : line).join('\n');
    expect(planted).not.toBe(initSql);
    const values = parseCheckArray(planted, constraint);
    expect(values).toContain('zz_planted');
    expect(values).toHaveLength(parseCheckArray(initSql, constraint).length + 1);
    expect(sorted(compilerSet)).not.toEqual(sorted(values)); // the comparison above would go red
  });

  it('offer_ttl_days parser', () => {
    const initSql = read(INIT_SQL);
    const planted = initSql.replace(/(\boffer_ttl_days\s+integer\s+DEFAULT\s+)\d+/, `$1${OFFER_TTL_DAYS + 1}`);
    expect(planted).not.toBe(initSql);
    expect(parseOfferTtlDefault(planted)).toBe(OFFER_TTL_DAYS + 1);
  });

  it('offer form option parser', () => {
    const tsx = read(OFFER_FORM);
    const planted = tsx.replace(/(<option value="other">)/, '<option value="zz_planted">Planted</option>\n                $1');
    expect(planted).not.toBe(tsx);
    const options = parseOfferCategories(planted);
    expect(options).toContain('zz_planted');
    expect(sorted(OFFER_CATEGORIES)).not.toEqual(sorted(options));
    // The community <select> (dynamic options) is not mistaken for the type select.
    expect(parseOfferCategories(tsx)).not.toContain('');
  });
});
