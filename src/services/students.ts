import { apiRequest, isRecord, requireNumber, requireString } from './api'
import type { AccountStatus, Student, StudentCreation } from './api-models'

export type { Student } from './api-models'

export interface StudentListResponse {
  all: Student[]
}

export interface CreateStudentInput {
  email: string
  firstName: string
  lastName: string
}

export type UpdateStudentInput = Partial<CreateStudentInput>

export interface StatusUpdateResult {
  id: number
  userId: number
  status: AccountStatus
}

export class StudentNotFoundError extends Error {
  constructor() {
    super('This student could not be found.')
    this.name = 'StudentNotFoundError'
  }
}

function isAccountStatus(value: unknown): value is AccountStatus {
  return value === 'pending' || value === 'active' || value === 'inactive' || value === 'suspended'
}

export function parseStudent(value: unknown): Student {
  if (!isRecord(value)) throw new Error('The student data returned by the server is invalid.')
  const userId = value.userId
  const status = value.status
  if ((userId !== null && typeof userId !== 'number') ||
      (status !== null && !isAccountStatus(status))) {
    throw new Error('The student data returned by the server is invalid.')
  }
  return {
    id: requireNumber(value.id, 'The student data returned by the server is invalid.'),
    userId,
    firstName: requireString(value.firstName, 'The student data returned by the server is invalid.'),
    lastName: requireString(value.lastName, 'The student data returned by the server is invalid.'),
    email: requireString(value.email, 'The student data returned by the server is invalid.'),
    status,
  }
}

function parseCreation(value: unknown): StudentCreation {
  if (!isRecord(value) || !isRecord(value.invitation)) {
    throw new Error('The server returned an invalid student registration response.')
  }
  const student = parseStudent(value)
  const invitation = value.invitation
  if (invitation.status !== 'pending_delivery' ||
      typeof invitation.expiresAt !== 'string') {
    throw new Error('The server returned invalid invitation details.')
  }
  return {
    ...student,
    invitation: {
      id: requireNumber(invitation.id, 'The server returned invalid invitation details.'),
      expiresAt: invitation.expiresAt,
      status: 'pending_delivery',
    },
  }
}

export async function getStudents(): Promise<StudentListResponse> {
  const result = await apiRequest('/students')
  if (!isRecord(result) || !Array.isArray(result.all)) {
    throw new Error('The student list returned by the server is invalid.')
  }
  return { all: result.all.map(parseStudent) }
}

export async function getStudentById(id: number): Promise<Student> {
  try {
    return parseStudent(await apiRequest(`/students/${encodeURIComponent(id)}`))
  } catch (error) {
    if (error instanceof Error && 'status' in error && error.status === 404) {
      throw new StudentNotFoundError()
    }
    throw error
  }
}

export async function getMyStudentProfile(): Promise<Student> {
  return parseStudent(await apiRequest('/students/me'))
}

export async function createStudent(input: CreateStudentInput): Promise<StudentCreation> {
  return parseCreation(await apiRequest('/students', {
    method: 'POST',
    body: JSON.stringify(input),
  }))
}

export async function updateStudent(id: number, input: UpdateStudentInput): Promise<Student> {
  if (Object.keys(input).length === 0) throw new Error('Change at least one student field before saving.')
  return parseStudent(await apiRequest(`/students/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  }))
}

export async function updateStudentStatus(
  id: number,
  status: AccountStatus,
  reason?: string,
): Promise<StatusUpdateResult> {
  const result = await apiRequest(`/students/${encodeURIComponent(id)}/status`, {
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
