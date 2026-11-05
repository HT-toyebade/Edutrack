import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { landingPath } from '../auth/routes'
import { useAuth } from '../auth/useAuth'
import type { AccountType } from '../services/api-models'

export function RequireAccount({ roles }: { roles: AccountType[] }) {
  const { account } = useAuth()
  const location = useLocation()
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!roles.includes(account.accountType)) {
    return <Navigate to={landingPath(account.accountType)} replace />
  }
  return <Outlet />
}

export function RedirectToAccountHome() {
  const { account } = useAuth()
  return <Navigate to={account ? landingPath(account.accountType) : '/login'} replace />
}
