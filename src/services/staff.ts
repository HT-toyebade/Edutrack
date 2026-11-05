import { apiRequest, isRecord, requireNumber, requireString } from './api'
import type { AccountStatus, StaffCreation, StaffMember } from './api-models'

export type { StaffMember } from './api-models'

export interface CreateStaffInput {
  email: string
  firstName: string
  lastName: string
  phoneNumber: string
  department: string
  designation: string
}

export type UpdateStaffInput = Partial<CreateStaffInput>

export interface StatusUpdateResult {
  id: number
  userId: number
  status: AccountStatus
}

export class StaffNotFoundError extends Error {
  constructor() {
    super('This staff profile could not be found.')
    this.name = 'StaffNotFoundError'
  }
}

function isAccountStatus(value: unknown): value is AccountStatus {
  return value === 'pending' || value === 'active' || value === 'inactive' || value === 'suspended'
}

export function parseStaff(value: unknown): StaffMember {
  if (!isRecord(value) || !isAccountStatus(value.status)) {
    throw new Error('The staff data returned by the server is invalid.')
  }
  return {
    id: requireNumber(value.id, 'The staff data returned by the server is invalid.'),
    userId: requireNumber(value.userId, 'The staff data returned by the server is invalid.'),
    email: requireString(value.email, 'The staff data returned by the server is invalid.'),
    firstName: requireString(value.firstName, 'The staff data returned by the server is invalid.'),
    lastName: requireString(value.lastName, 'The staff data returned by the server is invalid.'),
    phoneNumber: requireString(value.phoneNumber, 'The staff data returned by the server is invalid.'),
    department: requireString(value.department, 'The staff data returned by the server is invalid.'),
    designation: requireString(value.designation, 'The staff data returned by the server is invalid.'),
    status: value.status,
  }
}

function parseCreation(value: unknown): StaffCreation {
  if (!isRecord(value) || !isRecord(value.invitation) ||
      value.invitation.status !== 'pending_delivery' ||
      typeof value.invitation.expiresAt !== 'string') {
    throw new Error('The server returned invalid staff invitation details.')
  }
  return {
    ...parseStaff(value),
    invitation: {
      id: requireNumber(value.invitation.id, 'The server returned invalid invitation details.'),
      expiresAt: value.invitation.expiresAt,
      status: 'pending_delivery',
    },
  }
}

export async function getStaff(): Promise<StaffMember[]> {
  const result = await apiRequest('/staff')
  if (!Array.isArray(result)) throw new Error('The staff list returned by the server is invalid.')
  return result.map(parseStaff)
}

export async function getMyStaffProfile(): Promise<StaffMember> {
  return parseStaff(await apiRequest('/staff/me'))
}

export async function getStaffById(id: number): Promise<StaffMember> {
  try {
    return parseStaff(await apiRequest(`/staff/${encodeURIComponent(id)}`))
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 404) {
      throw new StaffNotFoundError()
    }
    throw error
  }
}

export async function createStaff(input: CreateStaffInput): Promise<StaffCreation> {
  return parseCreation(await apiRequest('/staff', {
    method: 'POST',
    body: JSON.stringify(input),
  }))
}

export async function updateStaff(id: number, input: UpdateStaffInput): Promise<StaffMember> {
  if (Object.keys(input).length === 0) throw new Error('Change at least one staff field before saving.')
  return parseStaff(await apiRequest(`/staff/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }))
}

export async function updateStaffStatus(
  id: number,
  status: AccountStatus,
  reason?: string,
): Promise<StatusUpdateResult> {
  const result = await apiRequest(`/staff/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
  })
  if (!isRecord(result) || !isAccountStatus(result.status)) {
    throw new Error('The server returned an invalid account status response.')
  }
  return {
    id: requireNumber(result.id, 'The server returned an invalid account status response.'),
    userId: requireNumber(result.userId, 'The server returned an invalid account status response.'),
    status: result.status,
  }
}
