import { query } from '../database/db';

export function normalizeSkillText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Resolve exactly on slug, label or synonym; substring matching belongs to scoring. */
export async function resolveSkillSlug(text: string): Promise<string | null> {
  const result = await query(
    `SELECT slug FROM auth.skill_vocabulary
     WHERE slug = replace($1, ' ', '_') OR lower(label) = $1 OR $1 = ANY (synonyms)
     LIMIT 1`,
    [normalizeSkillText(text)]
  );
  return result.rows[0]?.slug ?? null;
}

export async function listSkillSuggestions(): Promise<string[]> {
  const result = await query('SELECT label FROM auth.skill_vocabulary ORDER BY label ASC');
  return result.rows.map((row: { label: string }) => row.label);
}
