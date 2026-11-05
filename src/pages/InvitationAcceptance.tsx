import { useState } from 'react'
import { Link } from 'react-router-dom'
import { acceptInvitation } from '../services/administration'
import BrandLogo from '../BrandLogo'

export default function InvitationAcceptancePage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!token) {
      setError('This invitation link is missing its token. Ask your administrator to resend the invitation.')
      return
    }
    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await acceptInvitation(token, password)
      setAccepted(true)
      setPassword('')
      setConfirmation('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to accept this invitation.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="public-page">
      <section className="public-card">
        <BrandLogo size="large" />
        {accepted ? (
          <>
            <h1>Invitation accepted</h1>
            <p>Your account is active. Sign in with your email and new password.</p>
            <Link className="button button--primary" to="/login">Go to sign in</Link>
          </>
        ) : (
          <>
            <p className="eyebrow">SECURE ACCOUNT SETUP</p>
            <h1>Accept your invitation</h1>
            <p>Choose a password to activate your EduTrack account.</p>
            <form className="form-stack" onSubmit={handleSubmit}>
              <label>Password
                <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
              </label>
              <label>Confirm password
                <input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              </label>
              {error && <p className="inline-error" role="alert">{error}</p>}
              <button type="submit" className="button button--primary" disabled={loading}>
                {loading ? 'Activating account…' : 'Set password and activate'}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
