import { apiRequest, isRecord, requireNumber, requireString } from './api'
import type {
  AccountType,
  AuditEvent,
  Invitation,
  InvitationPage,
  InvitationStatus,
} from './api-models'

function isAccountType(value: unknown): value is AccountType {
  return value === 'super_admin' || value === 'staff' || value === 'student'
}

function isInvitationStatus(value: unknown): value is InvitationStatus {
  return value === 'pending' || value === 'accepted' || value === 'expired' || value === 'revoked'
}

export interface Overview {
  students: number
  staff: number
  accountsByStatus: Record<string, number>
}

export interface InvitationFilters {
  status?: InvitationStatus
  accountType?: AccountType
  email?: string
  page: number
  limit: number
}

function parseInvitation(value: unknown): Invitation {
  if (!isRecord(value) ||
      !isInvitationStatus(value.status) ||
      !isAccountType(value.accountType) ||
      !(value.acceptedAt === null || typeof value.acceptedAt === 'string') ||
      !(value.revokedAt === null || typeof value.revokedAt === 'string')) {
    throw new Error('The invitation list returned by the server is invalid.')
  }
  let creator: Invitation['creator'] = null
  if (value.creator !== null) {
    if (!isRecord(value.creator)) throw new Error('The invitation list returned by the server is invalid.')
    creator = {
      id: requireNumber(value.creator.id, 'The invitation list returned by the server is invalid.'),
      email: requireString(value.creator.email, 'The invitation list returned by the server is invalid.'),
    }
  }
  return {
    id: requireNumber(value.id, 'The invitation list returned by the server is invalid.'),
    email: requireString(value.email, 'The invitation list returned by the server is invalid.'),
    accountType: value.accountType,
    purpose: requireString(value.purpose, 'The invitation list returned by the server is invalid.'),
    createdAt: requireString(value.createdAt, 'The invitation list returned by the server is invalid.'),
    expiresAt: requireString(value.expiresAt, 'The invitation list returned by the server is invalid.'),
    acceptedAt: value.acceptedAt,
    revokedAt: value.revokedAt,
    status: value.status,
    creator,
  }
}

export async function getOverview(): Promise<Overview> {
  const value = await apiRequest('/dashboard/overview')
  if (!isRecord(value) || !isRecord(value.accountsByStatus)) {
    throw new Error('The dashboard data returned by the server is invalid.')
  }
  const accountsByStatus: Record<string, number> = {}
  for (const [status, count] of Object.entries(value.accountsByStatus)) {
    if (typeof count !== 'number' || !Number.isFinite(count)) {
      throw new Error('The dashboard data returned by the server is invalid.')
    }
    accountsByStatus[status] = count
  }
  return {
    students: requireNumber(value.students, 'The dashboard data returned by the server is invalid.'),
    staff: requireNumber(value.staff, 'The dashboard data returned by the server is invalid.'),
    accountsByStatus,
  }
}

export async function getInvitations(filters: InvitationFilters): Promise<InvitationPage> {
  const query = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
  })
  if (filters.status) query.set('status', filters.status)
  if (filters.accountType) query.set('accountType', filters.accountType)
  if (filters.email?.trim()) query.set('email', filters.email.trim())
  const value = await apiRequest(`/invitations?${query}`)
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error('The invitation list returned by the server is invalid.')
  }
  return {
    items: value.items.map(parseInvitation),
    total: requireNumber(value.total, 'The invitation list returned by the server is invalid.'),
    page: requireNumber(value.page, 'The invitation list returned by the server is invalid.'),
    limit: requireNumber(value.limit, 'The invitation list returned by the server is invalid.'),
    totalPages: requireNumber(value.totalPages, 'The invitation list returned by the server is invalid.'),
  }
}

export async function revokeInvitation(id: number): Promise<void> {
  const value = await apiRequest(`/invitations/${encodeURIComponent(id)}/revoke`, { method: 'POST' })
  if (!isRecord(value) || value.id !== id || value.status !== 'revoked') {
    throw new Error('The server returned an invalid invitation revocation response.')
  }
}

export async function resendInvitation(id: number): Promise<{ id: number; expiresAt: string }> {
  const value = await apiRequest(`/invitations/${encodeURIComponent(id)}/resend`, { method: 'POST' })
  if (!isRecord(value) || value.status !== 'pending_delivery') {
    throw new Error('The server returned an invalid invitation resend response.')
  }
  return {
    id: requireNumber(value.id, 'The server returned an invalid invitation resend response.'),
    expiresAt: requireString(value.expiresAt, 'The server returned an invalid invitation resend response.'),
  }
}

export async function acceptInvitation(token: string, password: string): Promise<void> {
  const value = await apiRequest('/invitations/accept', {
    method: 'POST',
    authenticated: false,
    body: JSON.stringify({ token, password }),
  })
  if (!isRecord(value) || !isAccountType(value.accountType)) {
    throw new Error('The server returned an invalid invitation acceptance response.')
  }
}

function parseAuditEvent(value: unknown): AuditEvent {
  if (!isRecord(value) ||
      !(value.actorUserId === null || typeof value.actorUserId === 'number') ||
      !(value.targetId === null || typeof value.targetId === 'number') ||
      !(value.reason === null || typeof value.reason === 'string') ||
      !(value.changes === null || isRecord(value.changes))) {
    throw new Error('The audit history returned by the server is invalid.')
  }
  return {
    id: requireNumber(value.id, 'The audit history returned by the server is invalid.'),
    actorUserId: value.actorUserId,
    action: requireString(value.action, 'The audit history returned by the server is invalid.'),
    targetType: requireString(value.targetType, 'The audit history returned by the server is invalid.'),
    targetId: value.targetId,
    reason: value.reason,
    changes: value.changes,
    occurredAt: requireString(value.occurredAt, 'The audit history returned by the server is invalid.'),
  }
}

export async function getAuditEvents(limit = 100, beforeId?: number): Promise<AuditEvent[]> {
  const query = new URLSearchParams({ limit: String(limit) })
  if (beforeId !== undefined) query.set('beforeId', String(beforeId))
  const value = await apiRequest(`/audit-events?${query}`)
  if (!Array.isArray(value)) throw new Error('The audit history returned by the server is invalid.')
  return value.map(parseAuditEvent)
}
