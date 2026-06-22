import { uploadFile, uploadAnonymous, getFiles, deleteFile, getFileMeta } from './files'

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

  it('uses empty string when token is not set', async () => {
    mockFetch.mockResolvedValue(mockResponse(true, 201, {}))

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    await uploadFile(file, 7)

    expect(mockFetch).toHaveBeenCalledWith('/api/files', expect.objectContaining({
      headers: { Authorization: 'Bearer ' },
    }))
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

  it('includes tags in form when provided', async () => {
    localStorage.setItem('token', 'jwt-token')
    mockFetch.mockResolvedValue(mockResponse(true, 201, {}))

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    await uploadFile(file, 7, 'secret', ['important', 'backup'])

    const formData: FormData = mockFetch.mock.calls[0][1].body
    expect(formData.getAll('tags[]')).toEqual(['important', 'backup'])
  })

  it('omits tags from form when not provided', async () => {
    localStorage.setItem('token', 'jwt-token')
    mockFetch.mockResolvedValue(mockResponse(true, 201, {}))

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    await uploadFile(file, 7)

    const formData: FormData = mockFetch.mock.calls[0][1].body
    expect(formData.getAll('tags[]')).toEqual([])
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

describe('uploadAnonymous', () => {
  it('posts multipart form to /api/files without auth header', async () => {
    const body = { id: 1, token: 'abc', download_url: '/api/files/abc/download' }
    mockFetch.mockResolvedValue(mockResponse(true, 201, body))

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    const result = await uploadAnonymous(file, 7)

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/files')
    expect(options.method).toBe('POST')
    expect(options.headers).toBeUndefined()
    expect(result).toEqual({ ok: true, status: 201, data: body })
  })

  it('includes password when provided', async () => {
    mockFetch.mockResolvedValue(mockResponse(true, 201, {}))

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    await uploadAnonymous(file, 3, 'secret')

    const formData: FormData = mockFetch.mock.calls[0][1].body
    expect(formData.get('password')).toBe('secret')
    expect(formData.get('expires_in_days')).toBe('3')
  })

  it('omits password when not provided', async () => {
    mockFetch.mockResolvedValue(mockResponse(true, 201, {}))

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    await uploadAnonymous(file, 7)

    const formData: FormData = mockFetch.mock.calls[0][1].body
    expect(formData.get('password')).toBeNull()
  })
})

describe('getFileMeta', () => {
  it('calls GET /api/files/{token} and returns file metadata', async () => {
    const body = {
      token: 'abc123',
      original_name: 'document.pdf',
      mime_type: 'application/pdf',
      size: 1024000,
      expires_at: '2025-12-31T23:59:59Z',
      is_expired: false,
      password_protected: true,
      download_url: '/api/files/abc123/download'
    }
    mockFetch.mockResolvedValue(mockResponse(true, 200, body))

    const result = await getFileMeta('abc123')

    expect(mockFetch).toHaveBeenCalledWith('/api/files/abc123')
    expect(result).toEqual({ ok: true, status: 200, data: body })
  })

  it('returns ok: false on 404', async () => {
    mockFetch.mockResolvedValue(mockResponse(false, 404, { message: 'Not found' }))

    const result = await getFileMeta('nonexistent')

    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
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

  it('uses empty string when token is not set', async () => {
    const body = { data: [] }
    mockFetch.mockResolvedValue(mockResponse(true, 200, body))

    await getFiles()

    expect(mockFetch).toHaveBeenCalledWith('/api/files', {
      headers: { Authorization: 'Bearer ' },
    })
  })

  it('includes tag filter in URL when provided', async () => {
    localStorage.setItem('token', 'jwt-token')
    const body = { data: [] }
    mockFetch.mockResolvedValue(mockResponse(true, 200, body))

    const result = await getFiles('backup')

    expect(mockFetch).toHaveBeenCalledWith('/api/files?tag=backup', {
      headers: { Authorization: 'Bearer jwt-token' },
    })
    expect(result).toEqual({ ok: true, status: 200, data: body })
  })

  it('URL-encodes tag parameter', async () => {
    localStorage.setItem('token', 'jwt-token')
    const body = { data: [] }
    mockFetch.mockResolvedValue(mockResponse(true, 200, body))

    await getFiles('important & urgent')

    expect(mockFetch).toHaveBeenCalledWith('/api/files?tag=important%20%26%20urgent', {
      headers: { Authorization: 'Bearer jwt-token' },
    })
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

  it('uses empty string when token is not set', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 })

    await deleteFile(42)

    expect(mockFetch).toHaveBeenCalledWith('/api/files/42', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' },
    })
  })

  it('returns ok: false on 403', async () => {
    localStorage.setItem('token', 'jwt-token')
    mockFetch.mockResolvedValue({ ok: false, status: 403 })

    const result = await deleteFile(42)

    expect(result.ok).toBe(false)
    expect(result.status).toBe(403)
  })
})
