export function normalizeTags(tags: string[]): string[] {
  return tags
    .map(t => t.toLowerCase().trim())
    .filter(t => t.length > 0)
}
