import { Link } from 'react-router-dom'
import BookCover from '../components/BookCover'
import Panel from '../components/Panel'
import { daysBetween, formatDate, plural, today } from '../lib/dates'
import { groupByName, isOverdue } from '../lib/loans'
import type { Book, Loan } from '../lib/types'
import { useLibrary } from '../state/LibraryContext'

const tones = ['pink', 'mint', 'lilac', 'yellow', 'sky'] as const

export default function Loans() {
  const { books, loans } = useLibrary()
  const t = today()
  const bookById = new Map(books.map((b) => [b.id, b]))
  const open = loans.filter((l) => !l.returnedOn && bookById.has(l.bookId))
  const history = loans.filter((l) => l.returnedOn && bookById.has(l.bookId)).sort((a, b) => (b.returnedOn ?? '').localeCompare(a.returnedOn ?? ''))

  // Group open loans by borrower, overdue people first, with the first way to reach them that was given.
  const people = groupByName(open, (l) => l.borrower, (l) => l.loanedOn).map((g) => ({
    name: g.name,
    contact: g.items.find((l) => l.contact)?.contact ?? '',
    loans: g.items,
    overdue: g.overdue,
  }))

  const loanLine = (loan: Loan) => {
    const days = daysBetween(loan.loanedOn, t)
    if (isOverdue(loan) && loan.dueOn) return <strong className="overdue-text">Overdue by {plural(daysBetween(loan.dueOn, t), 'day')}</strong>
    return (
      <>
        Out {days === 0 ? 'since today' : plural(days, 'day')}
        {loan.dueOn && ` · due ${formatDate(loan.dueOn)}`}
      </>
    )
  }

  const book = (loan: Loan) => bookById.get(loan.bookId) as Book

  return (
    <>
      <section className="hero" aria-labelledby="loans-title">
        <h1 id="loans-title">Who has what</h1>
        <p className="hero-sub">
          {open.length === 0 ? 'Every book is home on the shelf.' : `${plural(open.length, 'book')} out with ${people.length} ${people.length === 1 ? 'person' : 'people'}.`}
        </p>
      </section>

      {people.length === 0 ? (
        <div className="empty">
          <BookCover title="✓" color="mint" pattern="stars" size={90} />
          <p>Nothing checked out right now. Lend something good!</p>
        </div>
      ) : (
        <ul className="borrower-grid">
          {people.map((person, i) => (
            <li key={person.name}>
              <Panel title={`${person.name.toLowerCase().replace(/\s+/g, '_')}.card`} tone={person.overdue ? 'pink' : tones[i % tones.length]}>
                <h2 className="borrower-name">{person.name}</h2>
                {person.contact && <p className="borrower-contact">{person.contact}</p>}
                <ul className="borrower-books">
                  {person.loans.map((loan) => (
                    <li key={loan.id} className={isOverdue(loan) ? 'is-overdue' : ''}>
                      <BookCover title={book(loan).title} color={book(loan).coverColor} pattern={book(loan).coverPattern} size={40} />
                      <span>
                        <Link to={`/book/${loan.bookId}`}>{book(loan).title}</Link>
                        <small>{loanLine(loan)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <Panel title="returns_log.txt" tone="cream" className="history">
        <h2 className="history-title">Returned books</h2>
        {history.length === 0 ? (
          <p>No returns yet.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Book</th>
                  <th scope="col">Borrower</th>
                  <th scope="col">Out</th>
                  <th scope="col">Back</th>
                  <th scope="col">Kept for</th>
                </tr>
              </thead>
              <tbody>
                {history.map((loan) => (
                  <tr key={loan.id}>
                    <td>
                      <Link to={`/book/${loan.bookId}`}>{book(loan).title}</Link>
                    </td>
                    <td>{loan.borrower}</td>
                    <td>{formatDate(loan.loanedOn)}</td>
                    <td>{formatDate(loan.returnedOn as string)}</td>
                    <td>{plural(daysBetween(loan.loanedOn, loan.returnedOn as string), 'day')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
