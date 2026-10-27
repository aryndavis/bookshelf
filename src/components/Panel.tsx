import { useId, type ReactNode, type Ref } from 'react'

interface PanelProps {
  title: string
  tone?: 'cream' | 'pink' | 'mint' | 'lilac' | 'yellow' | 'sky'
  children: ReactNode
  className?: string
  /** Use a heading inside the panel as its label instead of the title bar. */
  labelledBy?: string
  id?: string
  role?: 'dialog'
  /** Shows a × in the title bar instead of the dots. */
  onClose?: () => void
  closeLabel?: string
  closeRef?: Ref<HTMLButtonElement>
  ref?: Ref<HTMLElement>
}

/** A pixel window frame with a striped title bar. */
export default function Panel({ title, tone = 'cream', children, className = '', labelledBy, id, role, onClose, closeLabel = 'Close', closeRef, ref }: PanelProps) {
  const titleId = useId()
  return (
    <section ref={ref} id={id} role={role} className={`panel tone-${tone} ${className}`} aria-labelledby={labelledBy ?? titleId}>
      <div className="panel-bar">
        <span id={titleId}>{title}</span>
        <span className="panel-stripes" aria-hidden="true" />
        {onClose ? (
          <button ref={closeRef} type="button" className="panel-close" aria-label={closeLabel} onClick={onClose}>
            ×
          </button>
        ) : (
          <span className="panel-dots" aria-hidden="true">
            ● ● ●
          </span>
        )}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  )
}
