export function resolveNumericDraft(draft: string, min: number, max: number): number | null {
  const normalized = draft.trim()
  if (normalized === '') return null

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null

  return Math.min(max, Math.max(min, parsed))
}
