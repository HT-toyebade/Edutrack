import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ErrorState, LoadingState, PageTitle, StatusBadge } from '../components/PagePrimitives'
import { updateOwnEmail } from '../services/auth'
import { getMyStaffProfile } from '../services/staff'
import { getMyStudentProfile } from '../services/students'
import type { StaffMember, Student } from '../services/api-models'

export default function ProfilePage() {
  const { account, refreshAccount } = useAuth()
  const accountId = account?.id
  const accountType = account?.accountType
  const accountEmail = account?.email
  const [student, setStudent] = useState<Student | null>(null)
  const [staff, setStaff] = useState<StaffMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState(account?.email ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!accountId || !accountType) return
    let active = true
    const profileRequest = accountType === 'student'
      ? getMyStudentProfile().then((value) => { if (active) setStudent(value) })
      : accountType === 'staff'
        ? getMyStaffProfile().then((value) => { if (active) setStaff(value) })
        : Promise.resolve()
    void Promise.all([profileRequest, refreshAccount()]).then(() => {
      if (active) {
        setEmail(accountEmail ?? '')
        setError('')
      }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load your profile.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [accountId, accountType, accountEmail, refreshAccount, retry])

  async function handleEmailSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setSaveError('')
    setMessage('')
    try {
      const updated = await updateOwnEmail(email.trim())
      await refreshAccount()
      setEmail(updated.email)
      setMessage('Your account email was updated.')
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Unable to update your email.')
    } finally {
      setSaving(false)
    }
  }

  if (!account) return null
  return (
    <>
      <PageTitle title="My profile" description="Your account identity and permitted profile information." />
      {loading ? <LoadingState label="Loading your profile…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); setRetry((value) => value + 1) }} /> : (
        <div className="content-grid">
          <section className="panel">
            <h3>Account information</h3>
            <dl className="detail-list">
              <div><dt>Account ID</dt><dd>{account.id}</dd></div>
              <div><dt>Account type</dt><dd>{account.accountType}</dd></div>
              <div><dt>Account status</dt><dd><StatusBadge status={account.status} /></dd></div>
            </dl>
            <form className="form-stack" onSubmit={handleEmailSave}>
              <label htmlFor="account-email">Email address</label>
              <input id="account-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              {saveError && <p className="inline-error" role="alert">{saveError}</p>}
              {message && <p className="inline-success" role="status">{message}</p>}
              <button className="button button--primary" type="submit" disabled={saving || email.trim() === account.email}>
                {saving ? 'Saving…' : 'Update email'}
              </button>
            </form>
          </section>
          {student && (
            <section className="panel">
              <h3>Student profile</h3>
              <p className="muted">Official profile fields are read-only for Students.</p>
              <dl className="detail-list">
                <div><dt>Student ID</dt><dd>{student.id}</dd></div>
                <div><dt>Name</dt><dd>{student.firstName} {student.lastName}</dd></div>
                <div><dt>Profile email</dt><dd>{student.email}</dd></div>
                <div><dt>Status</dt><dd><StatusBadge status={student.status} /></dd></div>
              </dl>
            </section>
          )}
          {staff && (
            <section className="panel">
              <h3>Staff profile</h3>
              <p className="muted">Staff profile fields are read-only here. Your account email can be updated above.</p>
              <dl className="detail-list">
                <div><dt>Staff ID</dt><dd>{staff.id}</dd></div>
                <div><dt>Name</dt><dd>{staff.firstName} {staff.lastName}</dd></div>
                <div><dt>Phone</dt><dd>{staff.phoneNumber}</dd></div>
                <div><dt>Department</dt><dd>{staff.department}</dd></div>
                <div><dt>Designation</dt><dd>{staff.designation}</dd></div>
                <div><dt>Status</dt><dd><StatusBadge status={staff.status} /></dd></div>
              </dl>
            </section>
          )}
        </div>
      )}
    </>
  )
}
