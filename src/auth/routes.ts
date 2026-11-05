import type { AccountType } from '../services/api-models'

export function landingPath(role: AccountType): string {
  if (role === 'super_admin') return '/super-admin/dashboard'
  if (role === 'staff') return '/staff/dashboard'
  return '/student/dashboard'
}
