import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { landingPath } from '../auth/routes'
import { useAuth } from '../auth/useAuth'
import BrandLogo from '../BrandLogo'

export default function LoginPage() {
  const { signIn, notice } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const account = await signIn(email.trim(), password)
      navigate(landingPath(account.accountType), { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <BrandLogo size="large" />
        <div className="brand-content">
          <p className="eyebrow">SMARTER SCHOOL MANAGEMENT</p>
          <h1>Education management, made simpler.</h1>
          <p>One secure sign-in for school administrators, staff and students.</p>
        </div>
        <p className="brand-footer">© 2026 EduTrack. All rights reserved.</p>
      </section>
      <section className="login-section">
        <div className="login-card">
          <div className="login-heading">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your account.</p>
          </div>
          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="password-visibility-button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <button type="submit" className="login-button" disabled={loading || !email || !password}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            {(notice || error) && <p className="error-message" role="alert">{error || notice}</p>}
          </form>
          <p className="login-note">Invitation accounts are activated from the secure link sent to your email.</p>
        </div>
      </section>
    </main>
  )
}
