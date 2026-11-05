import { apiRequest, isRecord, requireNumber, requireString } from './api'
import type { AccountIdentity, AccountType } from './api-models'

export { SESSION_EXPIRED_EVENT } from './api'
export type { AccountType } from './api-models'

export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  id: number
  email: string
  accountType: AccountType
}

function isAccountType(value: unknown): value is AccountType {
  return value === 'super_admin' || value === 'staff' || value === 'student'
}

function isAccountStatus(value: unknown): value is AccountIdentity['status'] {
  return value === 'pending' || value === 'active' || value === 'inactive' || value === 'suspended'
}

export function parseAccountIdentity(value: unknown): AccountIdentity {
  if (!isRecord(value) || !isAccountType(value.accountType) || !isAccountStatus(value.status)) {
    throw new Error('The server returned an invalid account profile.')
  }
  return {
    id: requireNumber(value.id, 'The server returned an invalid account profile.'),
    email: requireString(value.email, 'The server returned an invalid account profile.'),
    accountType: value.accountType,
    status: value.status,
  }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const result = await apiRequest('/users/login', {
    method: 'POST',
    authenticated: false,
    body: JSON.stringify({ email, password }),
  })
  if (!isRecord(result) || !isAccountType(result.accountType) || result.tokenType !== 'Bearer') {
    throw new Error('The server returned an invalid sign-in response.')
  }
  const accessToken = requireString(result.accessToken, 'The server returned an invalid sign-in response.')
  if (!accessToken) throw new Error('The server returned an invalid sign-in response.')
  return {
    accessToken,
    tokenType: 'Bearer',
    id: requireNumber(result.id, 'The server returned an invalid sign-in response.'),
    email: requireString(result.email, 'The server returned an invalid sign-in response.'),
    accountType: result.accountType,
  }
}

export async function getCurrentAccount(): Promise<AccountIdentity> {
  return parseAccountIdentity(await apiRequest('/users/me'))
}

export async function updateOwnEmail(email: string): Promise<AccountIdentity> {
  return parseAccountIdentity(await apiRequest('/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ email }),
  }))
}

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem('accessToken')
  } catch {
    return null
  }
}

export function saveAccessToken(token: string): void {
  try {
    sessionStorage.setItem('accessToken', token)
  } catch {
    throw new Error('Unable to save your session in this browser.')
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem('accessToken')
    sessionStorage.removeItem('user')
  } catch {
    throw new Error('Unable to clear the saved session in this browser.')
  }
}
