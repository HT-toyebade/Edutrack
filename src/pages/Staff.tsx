import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState, PageTitle, StatusBadge } from '../components/PagePrimitives'
import type { AccountStatus, StaffCreation, StaffMember } from '../services/api-models'
import { createStaff, getStaff, getStaffById, updateStaff, updateStaffStatus } from '../services/staff'

interface StaffForm {
  email: string
  firstName: string
  lastName: string
  phoneNumber: string
  department: string
  designation: string
}

const EMPTY_FORM: StaffForm = {
  email: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
  department: '',
  designation: '',
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<StaffCreation | null>(null)

  useEffect(() => {
    let active = true
    void getStaff().then((result) => {
      if (active) setStaff(result)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load Staff.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [retry])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return staff
    return staff.filter((member) =>
      `${member.firstName} ${member.lastName} ${member.email} ${member.department} ${member.designation}`
        .toLocaleLowerCase().includes(query),
    )
  }, [search, staff])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setCreated(null)
    try {
      const result = await createStaff({
        ...form,
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        department: form.department.trim(),
        designation: form.designation.trim(),
      })
      setCreated(result)
      setForm(EMPTY_FORM)
      setShowForm(false)
      setLoading(true)
      setRetry((value) => value + 1)
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Unable to create Staff account.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageTitle
        title="Staff directory"
        description="Create and manage Staff accounts. New accounts receive a time-limited invitation."
        action={<button className="button button--primary" type="button" onClick={() => { setShowForm((value) => !value); setFormError('') }}>{showForm ? 'Close form' : 'Create Staff account'}</button>}
      />
      {created && <p className="inline-success" role="status">Staff account created for {created.email}. Invitation #{created.invitation.id} expires {new Date(created.invitation.expiresAt).toLocaleString()}.</p>}
      {showForm && (
        <form className="panel form-grid" onSubmit={handleCreate}>
          <h3 className="form-grid-title">Create Staff account</h3>
          <label>Email<input type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>First name<input required maxLength={100} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
          <label>Last name<input required maxLength={100} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
          <label>Phone number<input type="tel" required maxLength={30} value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} /></label>
          <label>Department<input required maxLength={100} value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
          <label>Designation<input required maxLength={100} value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} /></label>
          {formError && <p className="inline-error form-grid-wide" role="alert">{formError}</p>}
          <div className="form-grid-wide"><button className="button button--primary" type="submit" disabled={saving}>{saving ? 'Creating account…' : 'Create account and invite'}</button></div>
        </form>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <label className="search-field">Search Staff
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or department" />
          </label>
          {!loading && !error && <span className="muted">{filtered.length} of {staff.length} profiles</span>}
        </div>
        {loading ? <LoadingState label="Loading Staff…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); setRetry((value) => value + 1) }} /> : staff.length === 0 ? (
          <EmptyState title="No Staff profiles yet" description="Create a Staff account to send an invitation." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No matching Staff" description="Try a different search term." />
        ) : (
          <div className="table-scroll"><table className="data-table">
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Department</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>{filtered.map((member) => (
              <tr key={member.id}>
                <td>#{member.id}</td>
                <td>{member.firstName} {member.lastName}</td>
                <td>{member.email}</td>
                <td>{member.department}</td>
                <td><StatusBadge status={member.status} /></td>
                <td><Link className="text-link" to={`/super-admin/staff/${member.id}`}>View details</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  )
}

export function StaffDetailPage() {
  const { id } = useParams()
  const staffId = Number(id)
  const navigate = useNavigate()
  const [staff, setStaff] = useState<StaffMember | null>(null)
  const [loadedId, setLoadedId] = useState<number | null>(null)
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [nextStatus, setNextStatus] = useState<AccountStatus | ''>('')
  const [reason, setReason] = useState('')
  const [statusError, setStatusError] = useState('')
  const [statusSuccess, setStatusSuccess] = useState('')

  useEffect(() => {
    if (!Number.isInteger(staffId) || staffId < 1) return
    let active = true
    void getStaffById(staffId).then((value) => {
      if (!active) return
      setStaff(value)
      setLoadedId(staffId)
      setError('')
      setForm({
        email: value.email,
        firstName: value.firstName,
        lastName: value.lastName,
        phoneNumber: value.phoneNumber,
        department: value.department,
        designation: value.designation,
      })
    }).catch((failure: unknown) => {
      if (active) {
        setLoadedId(staffId)
        setError(failure instanceof Error ? failure.message : 'Unable to load this Staff profile.')
      }
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [staffId, retry])

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    setSuccess('')
    try {
      const updated = await updateStaff(staffId, {
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        department: form.department.trim(),
        designation: form.designation.trim(),
      })
      setStaff(updated)
      setEditing(false)
      setSuccess('Staff profile updated.')
      setLoading(true)
      setRetry((value) => value + 1)
    } catch (failure) {
      setFormError(failure instanceof Error ? failure.message : 'Unable to update Staff profile.')
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
      await updateStaffStatus(staffId, nextStatus, reason.trim() || undefined)
      setStatusSuccess(`Staff account status changed to ${nextStatus}.`)
      setReason('')
      setNextStatus('')
      setLoading(true)
      setRetry((value) => value + 1)
    } catch (failure) {
      setStatusError(failure instanceof Error ? failure.message : 'Unable to update account status.')
    }
  }

  if (!Number.isInteger(staffId) || staffId < 1) return <ErrorState message="The Staff ID in this address is invalid." />
  if (loading || loadedId !== staffId) return <LoadingState label="Loading Staff profile…" />
  if (error || !staff) return <ErrorState message={error || 'Staff profile is unavailable.'} onRetry={() => { setLoading(true); setError(''); setRetry((value) => value + 1) }} />

  const transitions: Record<AccountStatus, AccountStatus[]> = {
    pending: [],
    active: ['inactive', 'suspended'],
    inactive: ['active'],
    suspended: ['active', 'inactive'],
  }
  const allowedTransitions = transitions[staff.status]

  return (
    <>
      <PageTitle title={`${staff.firstName} ${staff.lastName}`} description={`Staff profile #${staff.id}`} action={<button className="button button--quiet" type="button" onClick={() => navigate('/super-admin/staff')}>Back to directory</button>} />
      {success && <p className="inline-success" role="status">{success}</p>}
      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading"><h3>Profile details</h3>{!editing && <button className="button button--secondary" type="button" onClick={() => setEditing(true)}>Edit profile</button>}</div>
          {editing ? (
            <form className="form-grid" onSubmit={handleUpdate}>
              <label>Email<input type="email" required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label>First name<input required maxLength={100} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
              <label>Last name<input required maxLength={100} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
              <label>Phone number<input type="tel" required maxLength={30} value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} /></label>
              <label>Department<input required maxLength={100} value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
              <label>Designation<input required maxLength={100} value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })} /></label>
              {formError && <p className="inline-error form-grid-wide" role="alert">{formError}</p>}
              <div className="button-row form-grid-wide"><button className="button button--primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button><button className="button button--quiet" type="button" onClick={() => { setEditing(false); setFormError('') }}>Cancel</button></div>
            </form>
          ) : (
            <dl className="detail-list">
              <div><dt>Staff ID</dt><dd>{staff.id}</dd></div>
              <div><dt>User ID</dt><dd>{staff.userId}</dd></div>
              <div><dt>Email</dt><dd>{staff.email}</dd></div>
              <div><dt>Phone</dt><dd>{staff.phoneNumber}</dd></div>
              <div><dt>Department</dt><dd>{staff.department}</dd></div>
              <div><dt>Designation</dt><dd>{staff.designation}</dd></div>
              <div><dt>Account status</dt><dd><StatusBadge status={staff.status} /></dd></div>
            </dl>
          )}
        </section>
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
      </div>
    </>
  )
}
