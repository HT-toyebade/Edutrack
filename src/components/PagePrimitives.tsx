import type { ReactNode } from 'react'
import type { AccountStatus } from '../services/api-models'

export function PageTitle({
  eyebrow = 'EDUTRACK',
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-title-action">{action}</div>}
    </div>
  )
}

export function StatusBadge({ status }: { status: AccountStatus | null }) {
  return <span className={`status-badge status-badge--${status ?? 'unlinked'}`}>{status ?? 'unlinked'}</span>
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="state-card" role="status">{label}</div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-card state-card--error" role="alert">
      <strong>Something went wrong</strong>
      <p>{message}</p>
      {onRetry && <button className="button button--secondary" type="button" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="state-card"><strong>{title}</strong><p>{description}</p></div>
}
