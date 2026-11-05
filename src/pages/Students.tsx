import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { EmptyState, ErrorState, LoadingState, PageTitle, StatusBadge } from '../components/PagePrimitives'
import type { AccountStatus, AccountType, Student, StudentCreation } from '../services/api-models'
import { createStudent, getStudentById, getStudents, updateStudent, updateStudentStatus } from '../services/students'

function studentRouteBase(role: AccountType | undefined): string {
  return role === 'super_admin' ? '/super-admin/students' : '/staff/students'
}

export default function StudentPage() {
  const { account } = useAuth()
  const base = studentRouteBase(account?.accountType)
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [created, setCreated] = useState<StudentCreation | null>(null)
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' })

  useEffect(() => {
    let active = true
    void getStudents().then((result) => {
      if (active) setStudents(result.all)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load Students.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [retry])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return students
    return students.filter((student) =>
      `${student.firstName} ${student.lastName} ${student.email}`.toLocaleLowerCase().includes(query),
    )
  }, [search, students])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setCreated(null)
    try {
      const result = await createStudent({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      })
      setCreated(result)
      setForm({ email: '', firstName: '', lastName: '' })
      setShowForm(false)
      setLoading(true)
      setRetry((value) => value + 1)
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Unable to register Student.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitle
        title="Student directory"
        description="Search and manage Student profiles. Legacy profiles remain unlinked until identity verification."
        action={<button className="button button--primary" type="button" onClick={() => { setShowForm((value) => !value); setFormError('') }}>{showForm ? 'Close form' : 'Register Student'}</button>}
      />
      {created && (
        <p className="inline-success" role="status">
          Account created for {created.email}. Invitation delivery is asynchronous; invitation #{created.invitation.id} expires {new Date(created.invitation.expiresAt).toLocaleString()}.
        </p>
      )}
      {showForm && (
        <form className="panel form-grid" onSubmit={handleCreate}>
          <h3 className="form-grid-title">Register a Student account</h3>
          <label>Email<input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>First name<input autoComplete="given-name" required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
          <label>Last name<input autoComplete="family-name" required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
          {formError && <p className="inline-error form-grid-wide" role="alert">{formError}</p>}
          <div className="form-grid-wide"><button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Creating account…' : 'Create account and invite'}</button></div>
        </form>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <label className="search-field">Search Students
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email" />
          </label>
          {!loading && !error && <span className="muted">{filtered.length} of {students.length} profiles</span>}
        </div>
        {loading ? <LoadingState label="Loading Students…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); setRetry((value) => value + 1) }} /> : students.length === 0 ? (
          <EmptyState title="No Student profiles yet" description="Register a Student to create an account and send an invitation." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching Students" description="Try a different name or email." />
        ) : (
          <div className="table-scroll"><table className="data-table">
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Account status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>{filtered.map((student) => (
              <tr key={student.id}>
                <td>#{student.id}</td>
                <td>{student.firstName} {student.lastName}</td>
                <td>{student.email}</td>
                <td><StatusBadge status={student.status} />{student.userId === null && <span className="table-note">Legacy, unlinked</span>}</td>
                <td><Link className="text-link" to={`${base}/${student.id}`}>View details</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  )
}

export function StudentDetailPage() {
  const { id } = useParams()
  const studentId = Number(id)
  const navigate = useNavigate()
  const { account } = useAuth()
  const base = studentRouteBase(account?.accountType)
  const isAdmin = account?.accountType === 'super_admin'
  const [student, setStudent] = useState<Student | null>(null)
  const [loadedId, setLoadedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' })
  const [nextStatus, setNextStatus] = useState<AccountStatus | ''>('')
  const [reason, setReason] = useState('')
  const [statusError, setStatusError] = useState('')
  const [statusSuccess, setStatusSuccess] = useState('')

  useEffect(() => {
    if (!Number.isInteger(studentId) || studentId < 1) return
    let active = true
    void getStudentById(studentId).then((value) => {
      if (!active) return
      setStudent(value)
      setLoadedId(studentId)
      setError('')
      setForm({ email: value.email, firstName: value.firstName, lastName: value.lastName })
    }).catch((failure: unknown) => {
      if (active) {
        setLoadedId(studentId)
        setError(failure instanceof Error ? failure.message : 'Unable to load this Student.')
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [studentId, retry])

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setSuccess('')
    try {
      const updated = await updateStudent(studentId, {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      })
      setStudent(updated)
      setForm({ email: updated.email, firstName: updated.firstName, lastName: updated.lastName })
      setEditing(false)
      setSuccess('Student profile updated.')
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Unable to update Student.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!nextStatus) return
    if (nextStatus === 'suspended' && !reason.trim()) {
      setStatusError('A reason is required to suspend an account.')
      return
    }
    setStatusError('')
    setStatusSuccess('')
    try {
      await updateStudentStatus(studentId, nextStatus, reason.trim() || undefined)
      setStatusSuccess(`Student account status changed to ${nextStatus}.`)
      setReason('')
      setNextStatus('')
      setLoading(true)
      setRetry((value) => value + 1)
    } catch (failure) {
      setStatusError(failure instanceof Error ? failure.message : 'Unable to update account status.')
    }
  }

  if (!Number.isInteger(studentId) || studentId < 1) return <ErrorState message="The Student ID in this address is invalid." />
  if (loading || loadedId !== studentId) return <LoadingState label="Loading Student profile…" />
  if (error || !student) return <ErrorState message={error || 'Student profile is unavailable.'} onRetry={() => { setLoading(true); setError(''); setRetry((value) => value + 1) }} />

  const transitions: Record<AccountStatus, AccountStatus[]> = {
    pending: [],
    active: ['inactive', 'suspended'],
    inactive: ['active'],
    suspended: ['active', 'inactive'],
  }
  const allowedTransitions = student.status ? transitions[student.status] : []

  return (
    <>
      <PageTitle title={`${student.firstName} ${student.lastName}`} description={`Student profile #${student.id}`} action={<button className="button button--quiet" type="button" onClick={() => navigate(base)}>Back to directory</button>} />
      {success && <p className="inline-success" role="status">{success}</p>}
      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading"><h3>Profile details</h3>{!editing && <button className="button button--secondary" type="button" onClick={() => setEditing(true)}>Edit profile</button>}</div>
          {editing ? (
            <form className="form-stack" onSubmit={handleUpdate}>
              <label>First name<input required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
              <label>Last name<input required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
              <label>Email<input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              {formError && <p className="inline-error" role="alert">{formError}</p>}
              <div className="button-row"><button className="button button--primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button><button className="button button--quiet" type="button" onClick={() => { setEditing(false); setFormError('') }}>Cancel</button></div>
            </form>
          ) : (
            <dl className="detail-list">
              <div><dt>Student ID</dt><dd>{student.id}</dd></div>
              <div><dt>User ID</dt><dd>{student.userId ?? 'Not linked'}</dd></div>
              <div><dt>Name</dt><dd>{student.firstName} {student.lastName}</dd></div>
              <div><dt>Email</dt><dd>{student.email}</dd></div>
              <div><dt>Account status</dt><dd><StatusBadge status={student.status} /></dd></div>
            </dl>
          )}
          {student.userId === null && <p className="callout">This legacy Student record is intentionally unlinked. Do not assign an account without identity verification.</p>}
        </section>
        {isAdmin && student.userId !== null && (
          <section className="panel">
            <h3>Account lifecycle</h3>
            <p className="muted">Changing status affects the next authenticated API request.</p>
            {statusSuccess && <p className="inline-success" role="status">{statusSuccess}</p>}
            {allowedTransitions.length === 0 ? <p>This account has no permitted status transitions.</p> : (
              <form className="form-stack" onSubmit={handleStatus}>
                <label>New status
                  <select required value={nextStatus} onChange={(event) => setNextStatus(event.target.value as AccountStatus | '')}>
                    <option value="">Choose a status</option>
                    {allowedTransitions.map((status) => <option value={status} key={status}>{status}</option>)}
                  </select>
                </label>
                {nextStatus === 'suspended' && <label>Suspension reason<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
                {statusError && <p className="inline-error" role="alert">{statusError}</p>}
                <button className="button button--primary" type="submit" disabled={!nextStatus}>Update status</button>
              </form>
            )}
          </section>
        )}
      </div>
    </>
  )
}
