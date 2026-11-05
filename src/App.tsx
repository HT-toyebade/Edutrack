import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { landingPath } from './auth/routes'
import { useAuth } from './auth/useAuth'
import DashboardLayout from './components/DashboardLayout'
import { RedirectToAccountHome, RequireAccount } from './components/ProtectedRoutes'
import AuditPage from './pages/Audit'
import DashboardPage from './Dashboard'
import InvitationAcceptancePage from './pages/InvitationAcceptance'
import InvitationsPage from './pages/Invitations'
import LoginPage from './pages/Login'
import ProfilePage from './pages/Profile'
import StaffPage, { StaffDetailPage } from './pages/Staff'
import StudentPage, { StudentDetailPage } from './pages/Students'
import './App.css'
import './Dashboard.css'

function LoginRoute() {
  const { account } = useAuth()
  return account ? <Navigate to={landingPath(account.accountType)} replace /> : <LoginPage />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RedirectToAccountHome />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/accept-invitation" element={<InvitationAcceptancePage />} />

      <Route element={<RequireAccount roles={['super_admin']} />}>
        <Route path="/super-admin" element={<DashboardLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentPage />} />
          <Route path="students/:id" element={<StudentDetailPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="staff/:id" element={<StaffDetailPage />} />
          <Route path="invitations" element={<InvitationsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<RequireAccount roles={['staff']} />}>
        <Route path="/staff" element={<DashboardLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentPage />} />
          <Route path="students/:id" element={<StudentDetailPage />} />
          <Route path="invitations" element={<InvitationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<RequireAccount roles={['student']} />}>
        <Route path="/student" element={<DashboardLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<RedirectToAccountHome />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
