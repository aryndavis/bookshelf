// Dates are stored as plain YYYY-MM-DD strings in local time, like a library stamp.

const pad = (n: number) => String(n).padStart(2, '0')

export const toIsoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const today = () => toIsoDate(new Date())

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (iso: string, days: number) => {
  const date = parse(iso)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** Whole days from a to b (positive when b is later). */
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)

export const formatDate = (iso: string) => parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** Library-stamp style: OCT 15 2026 */
export const stampDate = (iso: string) =>
  parse(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(',', '').toUpperCase()

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
