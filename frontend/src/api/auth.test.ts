import { register, login } from './auth'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(ok: boolean, status: number, body: object) {
  return { ok, status, json: async () => body }
}

describe('register', () => {
  it('posts to /api/auth/register and returns ok response', async () => {
    const body = { id: 1, email: 'a@b.com', created_at: '2026-01-01' }
    mockFetch.mockResolvedValue(mockResponse(true, 201, body))

    const result = await register('a@b.com', 'password1')

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'password1' }),
    })
    expect(result).toEqual({ ok: true, status: 201, data: body })
  })

  it('returns ok: false when server rejects', async () => {
    const body = { error: 'EMAIL_TAKEN', message: 'Email already taken' }
    mockFetch.mockResolvedValue(mockResponse(false, 409, body))

    const result = await register('taken@b.com', 'password1')

    expect(result).toEqual({ ok: false, status: 409, data: body })
  })
})

describe('login', () => {
  it('posts to /api/auth/login and returns token', async () => {
    const body = { token: 'jwt', expires_in: 3600 }
    mockFetch.mockResolvedValue(mockResponse(true, 200, body))

    const result = await login('a@b.com', 'password1')

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'password1' }),
    })
    expect(result).toEqual({ ok: true, status: 200, data: body })
  })

  it('returns ok: false on invalid credentials', async () => {
    const body = { error: 'INVALID_CREDENTIALS', message: 'Wrong email or password' }
    mockFetch.mockResolvedValue(mockResponse(false, 401, body))

    const result = await login('a@b.com', 'wrong')

    expect(result).toEqual({ ok: false, status: 401, data: body })
  })
})
