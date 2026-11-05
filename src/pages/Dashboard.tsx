import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { LoadingState, PageTitle, ErrorState } from '../components/PagePrimitives'
import { getOverview } from '../services/administration'
import type { Overview } from '../services/administration'

const STATUSES = ['active', 'pending', 'inactive', 'suspended'] as const

export default function DashboardPage() {
  const { account } = useAuth()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (account?.accountType !== 'super_admin') return
    let active = true
    void getOverview().then((result) => {
      if (active) setOverview(result)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load the overview.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [account?.accountType, retry])

  if (!account) return null
  const home = account.accountType === 'super_admin'
    ? '/super-admin'
    : account.accountType === 'staff'
      ? '/staff'
      : '/student'

  if (account.accountType !== 'super_admin') {
    const isStudent = account.accountType === 'student'
    return (
      <>
        <PageTitle title={isStudent ? 'Welcome to your student portal' : 'Welcome to your staff workspace'} description={isStudent ? 'Your account and personal Student profile are available here.' : 'Register and update Students, and manage invitations you are permitted to access.'} />
        <section className="welcome-panel">
          <p className="eyebrow">SIGNED IN AS {account.accountType.replace('_', ' ').toUpperCase()}</p>
          <h2>{account.email}</h2>
          <p>For privacy, this overview does not request directory data. Use the navigation to open the resources your account can access.</p>
          <Link className="button button--primary" to={isStudent ? `${home}/profile` : `${home}/students`}>
            {isStudent ? 'View my profile' : 'Open Student directory'}
          </Link>
        </section>
      </>
    )
  }

  return (
    <>
      <PageTitle title="Overview" description="Current account and profile counts from the backend." />
      {loading ? <LoadingState label="Loading school overview…" /> : error ? (
        <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); setRetry((value) => value + 1) }} />
      ) : overview ? (
        <>
          <section className="metric-grid" aria-label="School overview">
            <article className="metric-card"><span>Student profiles</span><strong>{overview.students}</strong></article>
            <article className="metric-card"><span>Staff profiles</span><strong>{overview.staff}</strong></article>
            {STATUSES.map((status) => (
              <article className="metric-card" key={status}>
                <span>{status} accounts</span>
                <strong>{overview.accountsByStatus[status] ?? 0}</strong>
              </article>
            ))}
          </section>
          <section className="quick-links">
            <h3>Administration</h3>
            <Link to={`${home}/students`}>Manage Students</Link>
            <Link to={`${home}/staff`}>Manage Staff</Link>
            <Link to={`${home}/invitations`}>Review invitations</Link>
            <Link to={`${home}/audit`}>View audit history</Link>
          </section>
        </>
      ) : <ErrorState message="The server returned no overview." onRetry={() => { setLoading(true); setRetry((value) => value + 1) }} />}
    </>
  )
}
