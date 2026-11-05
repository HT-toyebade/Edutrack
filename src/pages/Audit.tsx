import { useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../components/PagePrimitives'
import type { AuditEvent } from '../services/api-models'
import { getAuditEvents } from '../services/administration'

const LIMIT = 100

function redact(value: unknown, key = ''): unknown {
  if (/email|phone|name|password|token|secret|hash/i.test(key)) return '[redacted]'
  if (Array.isArray(value)) return value.map((item) => redact(item))
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, redact(childValue, childKey)]))
  }
  return value
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    let active = true
    void getAuditEvents(LIMIT).then((result) => {
      if (!active) return
      setEvents(result)
      setHasMore(result.length === LIMIT)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load audit history.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [retry])

  async function loadMore() {
    const beforeId = events.at(-1)?.id
    if (beforeId === undefined) return
    setLoadingMore(true)
    setError('')
    try {
      const older = await getAuditEvents(LIMIT, beforeId)
      setEvents((current) => [...current, ...older])
      setHasMore(older.length === LIMIT)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load older audit events.')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <>
      <PageTitle title="Audit history" description="Read-only activity history. Event IDs are used as the backend's exclusive pagination cursor." />
      <section className="panel">
        {loading ? <LoadingState label="Loading audit events…" /> : error && events.length === 0 ?         <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); setRetry((value) => value + 1) }} /> : events.length === 0 ? (
          <EmptyState title="No audit events" description="Events will appear here as administrative actions are recorded." />
        ) : (
          <>
            {error && <p className="inline-error" role="alert">{error}</p>}
            <div className="audit-list">
              {events.map((event) => (
                <article className="audit-event" key={event.id}>
                  <div className="audit-event-heading">
                    <strong>{event.action}</strong>
                    <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
                  </div>
                  <p>Event #{event.id} · Actor {event.actorUserId === null ? 'system' : `User #${event.actorUserId}`} · {event.targetType}{event.targetId === null ? '' : ` #${event.targetId}`}</p>
                  {event.reason && <p><strong>Reason:</strong> {event.reason}</p>}
                  {event.changes && <details><summary>Before / after details</summary><pre>{JSON.stringify(redact(event.changes), null, 2)}</pre></details>}
                </article>
              ))}
            </div>
            {hasMore && <div className="pagination"><button className="button button--secondary" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load older events'}</button></div>}
          </>
        )}
      </section>
    </>
  )
}
