import { uploadFile } from './files'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(ok: boolean, status: number, body: object) {
  return { ok, status, json: async () => body }
}

beforeEach(() => {
  mockFetch.mockClear()
  localStorage.clear()
})

describe('uploadFile', () => {
  it('posts multipart form to /api/files with auth header', async () => {
    localStorage.setItem('token', 'jwt-token')
    const body = { id: 1, token: 'abc', download_url: '/api/files/abc/download' }
    mockFetch.mockResolvedValue(mockResponse(true, 201, body))

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    const result = await uploadFile(file, 7)

    expect(mockFetch).toHaveBeenCalledWith('/api/files', expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer jwt-token' },
    }))
    expect(result).toEqual({ ok: true, status: 201, data: body })
  })

  it('includes password in form when provided', async () => {
    localStorage.setItem('token', 'jwt-token')
    mockFetch.mockResolvedValue(mockResponse(true, 201, {}))

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    await uploadFile(file, 3, 'secret')

    const formData: FormData = mockFetch.mock.calls[0][1].body
    expect(formData.get('password')).toBe('secret')
    expect(formData.get('expires_in_days')).toBe('3')
  })

  it('omits password from form when not provided', async () => {
    localStorage.setItem('token', 'jwt-token')
    mockFetch.mockResolvedValue(mockResponse(true, 201, {}))

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    await uploadFile(file, 7)

    const formData: FormData = mockFetch.mock.calls[0][1].body
    expect(formData.get('password')).toBeNull()
  })

  it('returns ok: false on error response', async () => {
    localStorage.setItem('token', 'jwt-token')
    const body = { error: 'FILE_TOO_LARGE', message: 'File exceeds 1 GB' }
    mockFetch.mockResolvedValue(mockResponse(false, 413, body))

    const file = new File(['content'], 'big.txt', { type: 'text/plain' })
    const result = await uploadFile(file, 7)

    expect(result.ok).toBe(false)
    expect(result.status).toBe(413)
  })
})
