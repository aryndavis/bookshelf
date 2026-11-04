import { describe, expect, it } from 'vitest'
import { newArrivals } from './books'
import type { Book } from './types'

const book = (id: string, acquiredOn: string, createdAt = `${acquiredOn}T12:00:00Z`) => ({ id, acquiredOn, createdAt }) as Book

describe('newArrivals', () => {
  it('lists books acquired since the cutoff, newest first', () => {
    const books = [book('old', '2026-01-02'), book('a', '2026-10-01'), book('b', '2026-10-20'), book('c', '2026-10-20', '2026-10-21T09:00:00Z')]
    expect(newArrivals(books, '2026-09-20').map((b) => b.id)).toEqual(['c', 'b', 'a'])
  })

  it('caps the shelf', () => {
    const books = [book('old', '2026-01-02'), ...Array.from({ length: 10 }, (_, i) => book(`n${i}`, '2026-10-20'))]
    expect(newArrivals(books, '2026-09-20', 8)).toHaveLength(8)
  })

  it('stays empty when every book is new, so the shelf doesn’t repeat the catalog', () => {
    expect(newArrivals([book('a', '2026-10-27'), book('b', '2026-10-27')], '2026-09-20')).toEqual([])
    expect(newArrivals([], '2026-09-20')).toEqual([])
  })
})
