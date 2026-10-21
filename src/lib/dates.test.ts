import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, formatDate, plural, stampDate, toIsoDate } from './dates'

describe('dates', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-10-20', 21)).toBe('2026-11-10')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('counts whole days between dates, including across daylight saving changes', () => {
    expect(daysBetween('2026-10-20', '2026-11-10')).toBe(21)
    expect(daysBetween('2026-03-01', '2026-03-15')).toBe(14)
    expect(daysBetween('2026-11-10', '2026-10-20')).toBe(-21)
  })

  it('formats for people and for library stamps', () => {
    expect(formatDate('2026-10-05')).toBe('Oct 5, 2026')
    expect(stampDate('2026-10-05')).toBe('OCT 05 2026')
  })

  it('pluralizes', () => {
    expect(plural(1, 'day')).toBe('1 day')
    expect(plural(0, 'day')).toBe('0 days')
    expect(plural(3, 'book')).toBe('3 books')
  })
})
