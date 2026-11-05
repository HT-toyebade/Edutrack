const API_URL = 'http://localhost:3000'

export interface LoginResponse {
  accessToken: string
  tokenType: string
  id: number
  email: string
  accountType: string
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<LoginResponse>
}
