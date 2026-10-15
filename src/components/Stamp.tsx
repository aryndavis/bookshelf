import { stampDate } from '../lib/dates'

export type StampKind = 'out' | 'returned' | 'overdue'

const LABELS: Record<StampKind, string> = { out: 'Checked out', returned: 'Returned', overdue: 'Overdue' }

interface StampProps {
  kind: StampKind
  date?: string
  /** Slam the stamp down with an animation (used right after checking out or returning). */
  animate?: boolean
  small?: boolean
}

/** A rubber library stamp that sits over a book cover. Decorative: status is also given in text. */
export default function Stamp({ kind, date, animate = false, small = false }: StampProps) {
  return (
    <span className={`stamp stamp-${kind}${animate ? ' stamp-animate' : ''}${small ? ' stamp-small' : ''}`} aria-hidden="true">
      <span className="stamp-word">{LABELS[kind]}</span>
      {date && <span className="stamp-date">{stampDate(date)}</span>}
    </span>
  )
}
