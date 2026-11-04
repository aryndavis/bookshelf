import type { Book, BookInput } from './types'

/** A book's editable fields, for saving it back with a change. */
export const toBookInput = ({ id: _id, createdAt: _createdAt, ...input }: Book): BookInput => input

/** A random item, for surprise cover colors and patterns. */
export const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]

/**
 * The New Arrivals shelf: books acquired on or after `since`, newest first, up to `max`.
 * Empty when every book would qualify (say, a whole collection cataloged at once), since the shelf would just repeat the catalog.
 */
export function newArrivals(books: readonly Book[], since: string, max = 8): Book[] {
  const recent = books.filter((b) => b.acquiredOn >= since)
  if (recent.length === books.length) return []
  return recent.sort((a, b) => b.acquiredOn.localeCompare(a.acquiredOn) || b.createdAt.localeCompare(a.createdAt)).slice(0, max)
}
