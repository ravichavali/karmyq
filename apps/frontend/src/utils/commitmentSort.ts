const STATUS_PRIORITY: Record<string, number> = {
  proposed: 0,
  matched: 1,
  completed: 2,
}

export function sortByActionPriority<T extends { status: string; created_at: string }>(
  matches: T[]
): T[] {
  return [...matches].sort((a, b) => {
    const priorityDiff = (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99)
    if (priorityDiff !== 0) return priorityDiff
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}
