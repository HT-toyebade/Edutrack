import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import type { AccountType } from '../services/api-models'
import BrandLogo from '../BrandLogo'

interface NavigationItem {
  label: string
  to: string
  end?: boolean
}

function navigationFor(role: AccountType): NavigationItem[] {
  if (role === 'super_admin') {
    return [
      { label: 'Overview', to: '/super-admin/dashboard', end: true },
      { label: 'Students', to: '/super-admin/students' },
      { label: 'Staff', to: '/super-admin/staff' },
      { label: 'Invitations', to: '/super-admin/invitations' },
      { label: 'Audit history', to: '/super-admin/audit' },
      { label: 'My profile', to: '/super-admin/profile' },
    ]
  }
  if (role === 'staff') {
    return [
      { label: 'Overview', to: '/staff/dashboard', end: true },
      { label: 'Students', to: '/staff/students' },
      { label: 'Invitations', to: '/staff/invitations' },
      { label: 'My profile', to: '/staff/profile' },
    ]
  }
  return [
    { label: 'Overview', to: '/student/dashboard', end: true },
    { label: 'My profile', to: '/student/profile' },
  ]
}

export default function DashboardLayout() {
  const { account, signOut } = useAuth()
  const [logoutError, setLogoutError] = useState('')
  if (!account) return null

  function handleSignOut() {
    try {
      signOut()
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Unable to clear the local session.')
    }
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <Link to="/" aria-label="EduTrack home"><BrandLogo size="compact" /></Link>
        <p className="sidebar-label">WORKSPACE</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigationFor(account.accountType).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-account">
          <span className="sidebar-account-email">{account.email}</span>
          <span className="role-label">{account.accountType.replace('_', ' ')}</span>
          <button type="button" className="logout-button" onClick={handleSignOut}>Sign out</button>
          {logoutError && <p className="inline-error" role="alert">{logoutError}</p>}
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">EDUTRACK PHASE 1</p>
            <h1>{account.accountType === 'super_admin' ? 'Administration' : account.accountType === 'staff' ? 'Staff workspace' : 'Student portal'}</h1>
          </div>
          <div className="account-chip">
            <span className="avatar" aria-hidden="true">{account.email.slice(0, 1).toUpperCase()}</span>
            <span>{account.email}</span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
