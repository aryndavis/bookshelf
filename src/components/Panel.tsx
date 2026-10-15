import { useId, type ReactNode } from 'react'

interface PanelProps {
  title: string
  tone?: 'cream' | 'pink' | 'mint' | 'lilac' | 'yellow' | 'sky'
  children: ReactNode
  className?: string
  /** Use a heading inside the panel as its label instead of the title bar. */
  labelledBy?: string
}

/** A pixel window frame with a striped title bar. */
export default function Panel({ title, tone = 'cream', children, className = '', labelledBy }: PanelProps) {
  const titleId = useId()
  return (
    <section className={`panel tone-${tone} ${className}`} aria-labelledby={labelledBy ?? titleId}>
      <div className="panel-bar">
        <span id={titleId}>{title}</span>
        <span className="panel-stripes" aria-hidden="true" />
        <span className="panel-dots" aria-hidden="true">
          ● ● ●
        </span>
      </div>
      <div className="panel-body">{children}</div>
    </section>
  )
}
