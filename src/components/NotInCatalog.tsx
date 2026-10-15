import { Link } from 'react-router-dom'
import Panel from './Panel'

/** Shown when a /book/:id link points at a book that doesn't exist (or was removed). */
export default function NotInCatalog() {
  return (
    <Panel title="error.txt" tone="pink" className="narrow">
      <p>That book isn’t in the catalog.</p>
      <Link to="/" className="pixel-button">
        Back to the catalog
      </Link>
    </Panel>
  )
}
