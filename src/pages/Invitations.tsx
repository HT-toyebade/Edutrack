import { useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../components/PagePrimitives'
import { useAuth } from '../auth/useAuth'
import type { AccountType, Invitation, InvitationPage, InvitationStatus } from '../services/api-models'
import { getInvitations, resendInvitation, revokeInvitation } from '../services/administration'

const LIMIT = 25

export default function InvitationsPage() {
  const { account } = useAuth()
  const isAdmin = account?.accountType === 'super_admin'
  const [status, setStatus] = useState<InvitationStatus | ''>('')
  const [accountType, setAccountType] = useState<AccountType | ''>('')
  const [emailInput, setEmailInput] = useState('')
  const [email, setEmail] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [result, setResult] = useState<InvitationPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [actionError, setActionError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [workingId, setWorkingId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    void getInvitations({
      status: status || undefined,
      accountType: isAdmin ? accountType || undefined : undefined,
      email: email.trim() || undefined,
      page: pageNumber,
      limit: LIMIT,
    }).then((value) => {
      if (active) setResult(value)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load invitations.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [status, accountType, email, pageNumber, retry, isAdmin])

  async function handleAction(invitation: Invitation, action: 'revoke' | 'resend') {
    const verb = action === 'revoke' ? 'revoke' : 'resend'
    if (!window.confirm(`Are you sure you want to ${verb} the invitation for ${invitation.email}?`)) return
    setWorkingId(invitation.id)
    setActionError('')
    setFeedback('')
    try {
      if (action === 'revoke') {
        await revokeInvitation(invitation.id)
        setFeedback(`Invitation for ${invitation.email} revoked.`)
      } else {
        const replacement = await resendInvitation(invitation.id)
        setFeedback(`Replacement invitation #${replacement.id} queued for ${invitation.email}; delivery is asynchronous.`)
      }
      setLoading(true)
      setRetry((value) => value + 1)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : `Unable to ${verb} invitation.`)
    } finally {
      setWorkingId(null)
    }
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setEmail(emailInput.trim())
    setPageNumber(1)
    setRetry((value) => value + 1)
  }

  return (
    <>
      <PageTitle title="Invitation management" description={isAdmin ? 'Review invitations across the school.' : 'Review only Student invitations you created. The backend enforces this scope.'} />
      {feedback && <p className="inline-success" role="status">{feedback}</p>}
      {actionError && <p className="inline-error" role="alert">{actionError}</p>}
      <form className="panel filter-bar" onSubmit={applyFilters}>
        <label>Status
          <select value={status} onChange={(event) => { setLoading(true); setStatus(event.target.value as InvitationStatus | ''); setPageNumber(1) }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </label>
        {isAdmin && <label>Account type
          <select value={accountType} onChange={(event) => { setLoading(true); setAccountType(event.target.value as AccountType | ''); setPageNumber(1) }}>
            <option value="">All account types</option>
            <option value="student">Student</option>
            <option value="staff">Staff</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </label>}
        <label>Email address
          <input type="email" value={emailInput} onChange={(event) => setEmailInput(event.target.value)} placeholder="Exact email match" />
        </label>
        <button className="button button--secondary" type="submit">Apply filters</button>
      </form>

      <section className="panel">
        {loading ? <LoadingState label="Loading invitations…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); setRetry((value) => value + 1) }} /> : !result || result.items.length === 0 ? (
          <EmptyState title="No invitations found" description="Try changing the filters or check again after an account has been created." />
        ) : (
          <>
            <div className="table-toolbar">
              <span className="muted">{result.total} invitation{result.total === 1 ? '' : 's'} · Page {result.page} of {result.totalPages}</span>
            </div>
            <div className="table-scroll"><table className="data-table">
              <thead><tr><th>Recipient</th><th>Account</th><th>Status</th><th>Created</th><th>Expires</th><th>Created by</th><th>Actions</th></tr></thead>
              <tbody>{result.items.map((invitation) => (
                <tr key={invitation.id}>
                  <td>{invitation.email}<span className="table-note">Invitation #{invitation.id}</span></td>
                  <td>{invitation.accountType}</td>
                  <td><span className={`status-badge status-badge--${invitation.status}`}>{invitation.status}</span></td>
                  <td>{new Date(invitation.createdAt).toLocaleString()}</td>
                  <td>{new Date(invitation.expiresAt).toLocaleString()}</td>
                  <td>{invitation.creator?.email ?? 'System'}</td>
                  <td><div className="button-row">
                    {invitation.status !== 'accepted' && invitation.status !== 'revoked' && <button className="button button--quiet" type="button" disabled={workingId === invitation.id} onClick={() => void handleAction(invitation, 'revoke')}>Revoke</button>}
                    {invitation.status !== 'accepted' && <button className="button button--secondary" type="button" disabled={workingId === invitation.id} onClick={() => void handleAction(invitation, 'resend')}>{workingId === invitation.id ? 'Working…' : 'Resend'}</button>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
            <div className="pagination">
              <button className="button button--secondary" type="button" disabled={pageNumber <= 1} onClick={() => { setLoading(true); setPageNumber((value) => value - 1) }}>Previous</button>
              <span>Page {result.page} of {result.totalPages}</span>
              <button className="button button--secondary" type="button" disabled={pageNumber >= result.totalPages} onClick={() => { setLoading(true); setPageNumber((value) => value + 1) }}>Next</button>
            </div>
          </>
        )}
      </section>
    </>
  )
}
