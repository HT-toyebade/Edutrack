import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './context'
import type { AuthContextValue, AuthStatus } from './context'
import {
  clearSession,
  getAccessToken,
  getCurrentAccount,
  login as requestLogin,
  saveAccessToken,
  SESSION_EXPIRED_EVENT,
} from '../services/auth'

function clearStoredSession(): void {
  try {
    clearSession()
  } catch {
    sessionStorage.setItem('accessToken', '')
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('user')
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<AuthContextValue['account']>(null)
  const [status, setStatus] = useState<AuthStatus>(() =>
    getAccessToken() ? 'loading' : 'unauthenticated',
  )
  const [notice, setNotice] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let active = true
    const token = getAccessToken()
    if (!token) return
    void getCurrentAccount().then((current) => {
      if (!active) return
      setAccount(current)
      setStatus('authenticated')
    }).catch((error: unknown) => {
      if (!active) return
      if (error instanceof Error && 'status' in error && error.status === 401) {
        clearStoredSession()
        setAccount(null)
        setStatus('unauthenticated')
        setNotice('Your session has expired. Please sign in again.')
      } else {
        setStatus('unavailable')
      }
    })

    return () => {
      active = false
    }
  }, [retryKey])

  useEffect(() => {
    function handleSessionExpired() {
      clearStoredSession()
      setAccount(null)
      setStatus('unauthenticated')
      setNotice('Your session has expired. Please sign in again.')
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setNotice('')
    const result = await requestLogin(email, password)
    try {
      saveAccessToken(result.accessToken)
      const current = await getCurrentAccount()
      if (current.id !== result.id || current.accountType !== result.accountType) {
        throw new Error('The server returned inconsistent account details.')
      }
      setAccount(current)
      setStatus('authenticated')
      return current
    } catch (error) {
      clearStoredSession()
      setAccount(null)
      setStatus('unauthenticated')
      throw error
    }
  }, [])

  const signOut = useCallback(() => {
    clearStoredSession()
    setAccount(null)
    setStatus('unauthenticated')
    setNotice('')
  }, [])

  const refreshAccount = useCallback(async () => {
    const current = await getCurrentAccount()
    setAccount(current)
    setStatus('authenticated')
    return current
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    account,
    status,
    notice,
    signIn,
    signOut,
    refreshAccount,
  }), [account, status, notice, signIn, signOut, refreshAccount])

  if (status === 'loading') {
    return <main className="app-status" role="status">Checking your EduTrack session…</main>
  }

  if (status === 'unavailable') {
    return (
      <main className="app-status">
        <section className="state-card" role="alert">
          <h1>Unable to verify your session</h1>
          <p>The EduTrack API is unavailable. Your saved session has not been trusted.</p>
          <button type="button" className="button button--primary" onClick={() => { setStatus('loading'); setRetryKey((key) => key + 1) }}>
            Try again
          </button>
          <button type="button" className="button button--quiet" onClick={() => { clearStoredSession(); setAccount(null); setStatus('unauthenticated') }}>
            Sign in again
          </button>
        </section>
      </main>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
