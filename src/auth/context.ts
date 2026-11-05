import { createContext } from 'react'
import type { AccountIdentity } from '../services/api-models'

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable'

export interface AuthContextValue {
  account: AccountIdentity | null
  status: AuthStatus
  notice: string
  signIn: (email: string, password: string) => Promise<AccountIdentity>
  signOut: () => void
  refreshAccount: () => Promise<AccountIdentity>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
