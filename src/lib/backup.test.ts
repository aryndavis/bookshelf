import { describe, expect, it } from 'vitest'
import { catalogCsv } from './backup'
import type { Book, Loan } from './types'

const book = (patch: Partial<Book>): Book => ({
  id: 'b1',
  title: 'Matilda',
  author: 'Roald Dahl',
  isbn: null,
  genre: '',
  year: 1988,
  pages: null,
  coverColor: 'pink',
  coverPattern: 'hearts',
  notes: '',
  acquiredOn: '2026-10-01',
  createdAt: '2026-10-01',
  ...patch,
})

const rows = (csv: string) => csv.replace(/^﻿/, '').split('\r\n')

describe('catalogCsv', () => {
  it('starts with a UTF-8 byte-order mark and a header row', () => {
    const csv = catalogCsv([], [])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(rows(csv)[0]).toBe('"Title","Author","ISBN","Genre","Year","Pages","Acquired","Checked out to","Out since","Due","Notes"')
  })

  it('quotes cells and escapes quotes', () => {
    const [, row] = rows(catalogCsv([book({ title: 'The "Big" Book, Vol. 1' })], []))
    expect(row.startsWith('"The ""Big"" Book, Vol. 1","Roald Dahl"')).toBe(true)
  })

  it('defuses values a spreadsheet would run as formulas', () => {
    const [, row] = rows(catalogCsv([book({ title: '=HYPERLINK("http://evil")', author: '+1', notes: '@sum' })], []))
    expect(row).toContain(`"'=HYPERLINK(""http://evil"")"`)
    expect(row).toContain(`"'+1"`)
    expect(row).toContain(`"'@sum"`)
  })

  it('shows who has a book only for open loans', () => {
    const loans: Loan[] = [
      { id: 'l1', bookId: 'b1', borrower: 'Sam', contact: '', loanedOn: '2026-10-02', dueOn: '2026-10-23', returnedOn: null, notes: '', createdAt: '' },
      { id: 'l2', bookId: 'b2', borrower: 'Priya', contact: '', loanedOn: '2026-09-01', dueOn: null, returnedOn: '2026-09-10', notes: '', createdAt: '' },
    ]
    const [, out, back] = rows(catalogCsv([book({}), book({ id: 'b2', title: 'Survivor' })], loans))
    expect(out).toContain('"Sam","2026-10-02","2026-10-23"')
    expect(back).not.toContain('Priya')
  })
})
