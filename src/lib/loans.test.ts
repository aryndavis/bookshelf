import { afterEach, describe, expect, it, vi } from 'vitest'
import { groupByName, isOverdue } from './loans'
import type { Loan } from './types'

const loan = (patch: Partial<Loan>): Loan => ({
  id: 'l1',
  bookId: 'b1',
  borrower: 'Sam',
  contact: '',
  loanedOn: '2026-10-01',
  dueOn: '2026-10-15',
  returnedOn: null,
  notes: '',
  createdAt: '2026-10-01',
  ...patch,
})

describe('isOverdue', () => {
  afterEach(() => vi.useRealTimers())

  it('is overdue only when still out and past the due date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 20))
    expect(isOverdue(loan({}))).toBe(true)
    expect(isOverdue(loan({ dueOn: '2026-10-20' }))).toBe(false) // due today
    expect(isOverdue(loan({ dueOn: '2026-11-01' }))).toBe(false)
    expect(isOverdue(loan({ dueOn: null }))).toBe(false)
    expect(isOverdue(loan({ returnedOn: '2026-10-18' }))).toBe(false)
  })
})

describe('groupByName', () => {
  afterEach(() => vi.useRealTimers())

  it('groups by name ignoring capitalization, oldest first, overdue groups first', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 20))
    const groups = groupByName(
      [
        loan({ id: 'a', borrower: 'Sam', loanedOn: '2026-10-10', dueOn: null }),
        loan({ id: 'b', borrower: 'sam ', loanedOn: '2026-10-05', dueOn: null }),
        loan({ id: 'c', borrower: 'Priya', loanedOn: '2026-10-01', dueOn: '2026-10-15' }),
      ],
      (l) => l.borrower,
      (l) => l.loanedOn,
    )
    expect(groups.map((g) => [g.name, g.items.map((l) => l.id), g.overdue])).toEqual([
      ['Priya', ['c'], 1],
      ['Sam', ['b', 'a'], 0],
    ])
  })
})
