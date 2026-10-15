import { today } from './dates'
import type { Book, Loan } from './types'

function download(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadJson(books: Book[], loans: Loan[]) {
  download(`library-backup-${today()}.json`, 'application/json', JSON.stringify({ exportedAt: new Date().toISOString(), books, loans }, null, 2))
}

// Quote every cell, and defuse values that spreadsheet apps would run as formulas.
const cell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function downloadCsv(books: Book[], loans: Loan[]) {
  const open = new Map(loans.filter((l) => !l.returnedOn).map((l) => [l.bookId, l]))
  const header = ['Title', 'Author', 'ISBN', 'Genre', 'Year', 'Pages', 'Acquired', 'Checked out to', 'Out since', 'Due', 'Notes']
  const rows = books.map((b) => {
    const loan = open.get(b.id)
    return [b.title, b.author, b.isbn, b.genre, b.year, b.pages, b.acquiredOn, loan?.borrower, loan?.loanedOn, loan?.dueOn, b.notes]
  })
  // The byte-order mark tells Excel the file is UTF-8, so curly quotes and accents don't turn into mojibake.
  download(`library-catalog-${today()}.csv`, 'text/csv;charset=utf-8', '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n'))
}
