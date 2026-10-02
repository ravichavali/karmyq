import { readFileSync } from 'fs';
import { resolve } from 'path';

type VocabularyRow = { slug: string; label: string; synonyms: string[] };

function sqlString(value: string): string {
  const match = /^'((?:''|[^'])*)'$/s.exec(value.trim());
  if (!match) throw new Error(`Expected a SQL string literal: ${value}`);
  return match[1].replace(/''/g, "'");
}

// Split only on commas outside SQL strings and array brackets.
function splitValues(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let quote = false;
  let bracketDepth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") {
      if (quote && text[i + 1] === "'") { i++; continue; }
      quote = !quote;
    } else if (!quote && text[i] === '[') bracketDepth++;
    else if (!quote && text[i] === ']') bracketDepth--;
    else if (!quote && bracketDepth === 0 && text[i] === ',') {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

function vocabularyRows(file: string): VocabularyRow[] {
  const sql = readFileSync(resolve(__dirname, '../../../..', file), 'utf8');
  const inserts = [...sql.matchAll(/INSERT\s+INTO\s+auth\.skill_vocabulary\s*\(\s*slug\s*,\s*label\s*,\s*synonyms\s*\)\s*VALUES\s*([\s\S]*?)\s*ON\s+CONFLICT\s*\(\s*slug\s*\)/gi)];
  const insertCount = [...sql.matchAll(/INSERT\s+INTO\s+auth\.skill_vocabulary\b/gi)].length;
  if (inserts.length !== insertCount) {
    throw new Error(`Unrecognized auth.skill_vocabulary INSERT in ${file}`);
  }
  const rows: VocabularyRow[] = [];
  for (const insert of inserts) {
    const values = insert[1];
    // Each tuple has two SQL strings and an ARRAY of SQL strings. SQL string quotes
    // can be escaped as doubled quotes; whitespace and line wrapping are irrelevant.
    const tuplePattern = /\(\s*('(?:''|[^'])*')\s*,\s*('(?:''|[^'])*')\s*,\s*ARRAY\s*\[([^\]]*)\](?:::text\[\])?\s*\)/gi;
    let parsedThrough = 0;
    let tupleCount = 0;
    for (const tuple of values.matchAll(tuplePattern)) {
      if (!/^[\s,]*$/.test(values.slice(parsedThrough, tuple.index))) {
        throw new Error(`Unparsed auth.skill_vocabulary values in ${file}`);
      }
      rows.push({
        slug: sqlString(tuple[1]),
        label: sqlString(tuple[2]),
        synonyms: tuple[3].trim() ? splitValues(tuple[3]).map(sqlString).sort() : [],
      });
      tupleCount++;
      parsedThrough = tuple.index + tuple[0].length;
    }
    if (!tupleCount || !/^[\s,]*$/.test(values.slice(parsedThrough))) {
      throw new Error(`Could not parse every auth.skill_vocabulary tuple in ${file}`);
    }
  }
  return rows.sort((a, b) => a.slug.localeCompare(b.slug));
}

it('keeps migration and fresh-install seed vocabulary exactly equal and nonempty', () => {
  const migration = vocabularyRows('infrastructure/postgres/migrations/20260930-skill-vocabulary.sql');
  const seed = vocabularyRows('infrastructure/postgres/seed-data.sql');
  expect(migration.length).toBeGreaterThan(0);
  expect(seed.length).toBeGreaterThan(0);
  expect(new Set(migration.map(row => row.slug)).size).toBe(migration.length);
  expect(new Set(seed.map(row => row.slug)).size).toBe(seed.length);
  expect(seed).toEqual(migration);
});
