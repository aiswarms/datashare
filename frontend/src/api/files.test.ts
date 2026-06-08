import { uploadFile, getFiles, deleteFile } from './files'

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

describe('getFiles', () => {
  it('calls GET /api/files with auth header', async () => {
    localStorage.setItem('token', 'jwt-token')
    const body = { data: [] }
    mockFetch.mockResolvedValue(mockResponse(true, 200, body))

    const result = await getFiles()

    expect(mockFetch).toHaveBeenCalledWith('/api/files', {
      headers: { Authorization: 'Bearer jwt-token' },
    })
    expect(result).toEqual({ ok: true, status: 200, data: body })
  })

  it('returns ok: false on 401', async () => {
    localStorage.setItem('token', 'expired-token')
    mockFetch.mockResolvedValue(mockResponse(false, 401, { message: 'Unauthorized' }))

    const result = await getFiles()

    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
  })
})

describe('deleteFile', () => {
  it('sends DELETE /api/files/{id} with auth header', async () => {
    localStorage.setItem('token', 'jwt-token')
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    const result = await deleteFile(42)

    expect(mockFetch).toHaveBeenCalledWith('/api/files/42', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer jwt-token' },
    })
    expect(result).toEqual({ ok: true, status: 204 })
  })

  it('returns ok: false on 403', async () => {
    localStorage.setItem('token', 'jwt-token')
    mockFetch.mockResolvedValue({ ok: false, status: 403 })

    const result = await deleteFile(42)

    expect(result.ok).toBe(false)
    expect(result.status).toBe(403)
  })
})
