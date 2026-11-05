export const API_URL = '/api'
export const SESSION_EXPIRED_EVENT = 'edutrack:session-expired'

export class ApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface ApiRequestOptions extends RequestInit {
  authenticated?: boolean
}

function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem('accessToken')
  } catch {
    return null
  }
}

function notifySessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
}

function getMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = body.message
    if (typeof message === 'string') return message
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message.join(' ')
    }
  }
  return `Request failed (${status}). Please try again.`
}

export async function apiRequest(
  path: string,
  options: ApiRequestOptions = {},
): Promise<unknown> {
  const { authenticated = true, ...requestOptions } = options
  const headers = new Headers(requestOptions.headers)
  const token = authenticated ? getStoredToken() : null

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (requestOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, { ...requestOptions, headers })
  } catch {
    throw new Error('The EduTrack API is unavailable. Check your connection and try again.')
  }

  if (!response.ok) {
    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = null
    }
    if (response.status === 401 && token) notifySessionExpired()
    throw new ApiError(getMessage(body, response.status), response.status)
  }

  if (response.status === 204) return null
  try {
    return await response.json()
  } catch {
    throw new Error('The server returned an invalid JSON response.')
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(message)
  return value
}

export function requireNumber(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(message)
  return value
}

export function requireString(value: unknown, message: string): string {
  if (typeof value !== 'string') throw new Error(message)
  return value
}
