const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** Pickers list roles, teams and projects alphabetically, "Dev 2" before "Dev 10". */
export function sortByLabel<T>(items: readonly T[], label: (item: T) => string): T[] {
  return [...items].sort((a, b) => collator.compare(label(a), label(b)))
}

export function sortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return sortByLabel(items, (item) => item.name)
}
