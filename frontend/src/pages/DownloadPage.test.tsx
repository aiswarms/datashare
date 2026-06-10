import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/utils'
import DownloadPage from './DownloadPage'
import * as files from '../api/files'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ token: 'test-token-123' }) }
})
vi.mock('../api/files')

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockNavigate.mockClear()
  vi.mocked(files.getFileMeta).mockClear()
  mockFetch.mockClear()
  localStorage.clear()
})

function makeFileMeta(overrides: Partial<files.FileMeta> = {}): files.FileMeta {
  return {
    token: 'test-token-123',
    original_name: 'document.pdf',
    mime_type: 'application/pdf',
    size: 2_500_000,
    expires_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    is_expired: false,
    password_protected: false,
    download_url: '/api/files/test-token-123/download',
    ...overrides,
  }
}

describe('DownloadPage', () => {
  it('shows loading state initially', () => {
    vi.mocked(files.getFileMeta).mockReturnValue(new Promise(() => {}))
    renderWithProviders(<DownloadPage />)

    expect(screen.getByTestId('loading')).toBeInTheDocument()
  })

  it('shows file metadata when loaded', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({ ok: true, status: 200, data: makeFileMeta() })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('file-name')).toBeInTheDocument())
    expect(screen.getByTestId('file-name')).toHaveTextContent('document.pdf')
    expect(screen.getByTestId('file-size')).toHaveTextContent('2.5 Mo')
    expect(screen.getByTestId('file-type')).toHaveTextContent('application/pdf')
    expect(screen.getByTestId('file-expiry')).toHaveTextContent('Expire dans 3 jours')
  })

  it('shows not-found state for unknown token', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({ ok: false, status: 404, data: { error: 'FILE_NOT_FOUND' } as any })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('not-found')).toBeInTheDocument())
  })

  it('shows expired state for an expired file', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({
      ok: true,
      status: 200,
      data: makeFileMeta({ is_expired: true }),
    })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('expired-message')).toBeInTheDocument())
    expect(screen.getByTestId('expired-title')).toHaveTextContent('document.pdf')
    expect(screen.queryByTestId('download-button')).not.toBeInTheDocument()
  })

  it('shows download button for valid file', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({ ok: true, status: 200, data: makeFileMeta() })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('download-button')).toBeInTheDocument())
  })

  it('does not show password input for unprotected file', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({ ok: true, status: 200, data: makeFileMeta() })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('download-button')).toBeInTheDocument())
    expect(screen.queryByTestId('password-input')).not.toBeInTheDocument()
  })

  it('shows password input for password-protected file', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({
      ok: true,
      status: 200,
      data: makeFileMeta({ password_protected: true }),
    })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('password-input')).toBeInTheDocument())
  })

  it('disables download button when password field is empty', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({
      ok: true,
      status: 200,
      data: makeFileMeta({ password_protected: true }),
    })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('download-button')).toBeInTheDocument())
    expect(screen.getByTestId('download-button')).toBeDisabled()
  })

  it('enables download button when password is typed', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({
      ok: true,
      status: 200,
      data: makeFileMeta({ password_protected: true }),
    })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('password-input')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'secret' } })
    expect(screen.getByTestId('download-button')).not.toBeDisabled()
  })

  it('fetches the download URL on button click for unprotected file', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({ ok: true, status: 200, data: makeFileMeta() })
    const blob = new Blob(['content'], { type: 'application/pdf' })
    mockFetch.mockResolvedValue({ status: 200, blob: async () => blob })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })

    renderWithProviders(<DownloadPage />)
    await waitFor(() => expect(screen.getByTestId('download-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('download-button'))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/files/test-token-123/download'))
  })

  it('includes password in download URL when provided', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({
      ok: true,
      status: 200,
      data: makeFileMeta({ password_protected: true }),
    })
    const blob = new Blob(['content'])
    mockFetch.mockResolvedValue({ status: 200, blob: async () => blob })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
    vi.spyOn(document, 'createElement').mockImplementationOnce(() => {
      const a = document.createElement('a')
      a.click = vi.fn()
      return a
    })

    renderWithProviders(<DownloadPage />)
    await waitFor(() => expect(screen.getByTestId('password-input')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'mypass' } })
    fireEvent.click(screen.getByTestId('download-button'))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/files/test-token-123/download?password=mypass'
    ))
  })

  it('shows wrong-password error on 401', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({
      ok: true,
      status: 200,
      data: makeFileMeta({ password_protected: true }),
    })
    mockFetch.mockResolvedValue({ status: 401 })

    renderWithProviders(<DownloadPage />)
    await waitFor(() => expect(screen.getByTestId('password-input')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByTestId('download-button'))

    await waitFor(() => expect(screen.getByTestId('wrong-password')).toBeInTheDocument())
  })

  it('shows "Mon espace" link when user is logged in', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFileMeta).mockResolvedValue({ ok: true, status: 200, data: makeFileMeta() })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('my-space-link')).toBeInTheDocument())
  })

  it('hides "Mon espace" link when user is not logged in', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({ ok: true, status: 200, data: makeFileMeta() })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('file-name')).toBeInTheDocument())
    expect(screen.queryByTestId('my-space-link')).not.toBeInTheDocument()
  })

  it('navigates to /my-space when "Mon espace" is clicked', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFileMeta).mockResolvedValue({ ok: true, status: 200, data: makeFileMeta() })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('my-space-link')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('my-space-link'))
    expect(mockNavigate).toHaveBeenCalledWith('/my-space')
  })

  it('navigates home when DataShare logo is clicked', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({ ok: true, status: 200, data: makeFileMeta() })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('file-name')).toBeInTheDocument())
    fireEvent.click(screen.getByText('DataShare'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('shows expiry as "Expire demain" when 1 day left', async () => {
    vi.mocked(files.getFileMeta).mockResolvedValue({
      ok: true,
      status: 200,
      data: makeFileMeta({ expires_at: new Date(Date.now() + 86_400_000).toISOString() }),
    })
    renderWithProviders(<DownloadPage />)

    await waitFor(() => expect(screen.getByTestId('file-expiry')).toHaveTextContent('Expire demain'))
  })
})
