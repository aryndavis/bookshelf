import { today } from './dates'
import type { Borrowing, Loan } from './types'

/** Still out and past its due date: a book you lent, or one you borrowed. */
export const isOverdue = (loan: Pick<Loan | Borrowing, 'dueOn' | 'returnedOn'>) => Boolean(loan.dueOn && !loan.returnedOn && loan.dueOn < today())

/**
 * Open loans or borrowings grouped by person or place (ignoring capitalization): oldest first within a group,
 * and groups with something overdue first.
 */
export function groupByName<T extends Pick<Loan | Borrowing, 'dueOn' | 'returnedOn'>>(items: T[], nameOf: (item: T) => string, dateOf: (item: T) => string) {
  const groups = new Map<string, { name: string; items: T[] }>()
  for (const item of items) {
    const key = nameOf(item).trim().toLowerCase()
    const group = groups.get(key) ?? { name: nameOf(item).trim(), items: [] }
    group.items.push(item)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((g) => ({ ...g, items: g.items.sort((a, b) => dateOf(a).localeCompare(dateOf(b))), overdue: g.items.filter(isOverdue).length }))
    .sort((a, b) => b.overdue - a.overdue || a.name.localeCompare(b.name))
}
