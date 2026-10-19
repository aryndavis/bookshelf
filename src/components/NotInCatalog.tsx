import { Link } from 'react-router-dom'
import Panel from './Panel'

/** Shown when a /book/:id link points at a book that doesn't exist (or was removed), or at an unknown page. */
export default function NotInCatalog({ message = 'That book isn’t in the catalog.' }: { message?: string }) {
  return (
    <Panel title="error.txt" tone="pink" className="narrow">
      <p>{message}</p>
      <Link to="/" className="pixel-button">
        Back to the catalog
      </Link>
    </Panel>
  )
}
