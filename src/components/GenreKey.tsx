import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { DEFAULT_ICON, GENRE_ICONS, iconFor } from '../lib/genreIcons'
import { COVER_COLORS } from '../lib/types'
import { useLibrary } from '../state/LibraryContext'
import BookCover from './BookCover'
import Panel from './Panel'

/** A bookmark lying beside the catalog heading that opens a key to the genre icons on the covers. */
export default function GenreKey() {
  const { books } = useLibrary()
  const [open, setOpen] = useState(false)
  const bookmark = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const titleId = useId()

  // How many of the library's books each icon stands for.
  const counts = useMemo(() => {
    const byIcon = new Map<string, number>()
    for (const book of books) {
      const icon = iconFor(book.genre)
      byIcon.set(icon, (byIcon.get(icon) ?? 0) + 1)
    }
    return byIcon
  }, [books])

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) bookmark.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    closeButton.current?.focus()
    const inside = (target: EventTarget | null) => target instanceof Node && (panel.current?.contains(target) || bookmark.current?.contains(target))
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true)
    }
    // A click elsewhere, or tabbing out to the page under it, closes it (the bookmark toggles it itself).
    const onPointer = (event: PointerEvent) => {
      if (!inside(event.target)) close(false)
    }
    const onFocus = (event: FocusEvent) => {
      if (!inside(event.target)) close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('focusin', onFocus)
    }
  }, [open, close])

  return (
    <div className="genre-key-spot">
      <button ref={bookmark} type="button" className="genre-bookmark" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        {/* The outline goes on the wrapper: a filter on the clipped ribbon itself would be clipped away. */}
        <span className="bookmark-outline">
          <span className="bookmark-ribbon">
            <svg className="bookmark-heart" viewBox="0 0 7 6" width="14" height="12" shapeRendering="crispEdges" aria-hidden="true">
              <path d="M1 0h2v1h1V0h2v1h1v2H6v1H5v1H4v1H3V5H2V4H1V3H0V1h1z" fill="currentColor" />
            </svg>
            Genre key
          </span>
        </span>
        {/* A little pixel tassel on a cord, hanging from the bookmark's tip */}
        <svg className="bookmark-tassel" viewBox="0 0 9 18" width="24" height="48" shapeRendering="crispEdges" aria-hidden="true">
          <rect x="4" y="0" width="1" height="6" fill="var(--ink)" />
          <rect x="3" y="6" width="3" height="3" fill="var(--ink)" />
          <rect x="4" y="7" width="1" height="1" fill="var(--pink-deep)" />
          <rect x="2" y="9" width="5" height="1" fill="var(--ink)" />
          {[2, 3, 4, 5, 6].map((x) => (
            <rect key={x} x={x} y="10" width="1" height={x % 2 ? 7 : 8} fill={x % 2 ? 'var(--pink-deep)' : 'var(--ink)'} />
          ))}
        </svg>
      </button>
      {open && (
        <Panel
          ref={panel}
          id={panelId}
          role="dialog"
          title="genre_key.txt"
          tone="lilac"
          className="genre-key"
          labelledBy={titleId}
          onClose={() => close(true)}
          closeLabel="Close the genre key"
          closeRef={closeButton}
        >
          <h2 id={titleId} className="panel-heading">
            What the icons mean
          </h2>
          <p className="hint">Each cover’s icon comes from its genre. A genre that isn’t listed here gets the open book.</p>
          <ul className="genre-key-grid">
            {Object.keys(GENRE_ICONS).map((genre, i) => {
              const count = counts.get(genre) ?? 0
              return (
                <li key={genre}>
                  <BookCover title="" genre={genre} color={COVER_COLORS[i % COVER_COLORS.length]} pattern="plain" size={40} />
                  <span>
                    {genre}
                    {genre === DEFAULT_ICON && <small>and anything else</small>}
                    {count > 0 && <small>{count === 1 ? '1 book' : `${count} books`}</small>}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}
    </div>
  )
}
