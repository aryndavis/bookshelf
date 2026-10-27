import type { Book, BookInput } from './types'

/** A book's editable fields, for saving it back with a change. */
export const toBookInput = ({ id: _id, createdAt: _createdAt, ...input }: Book): BookInput => input

/** A random item, for surprise cover colors and patterns. */
export const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]
