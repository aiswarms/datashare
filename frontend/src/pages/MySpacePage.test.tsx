import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/utils'
import MySpacePage from './MySpacePage'
import * as files from '../api/files'
import type { FileRecord } from '../api/files'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../api/files')

beforeEach(() => {
  mockNavigate.mockClear()
  vi.mocked(files.getFiles).mockClear()
  localStorage.clear()
})

function makeFile(overrides: Partial<FileRecord> = {}): FileRecord {
  return {
    id: 1,
    token: 'abc-123',
    original_name: 'rapport.pdf',
    mime_type: 'application/pdf',
    size: 1024,
    expires_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    uploaded_at: new Date().toISOString(),
    is_expired: false,
    password_protected: false,
    download_url: '/api/files/abc-123/download',
    tags: [],
    ...overrides,
  }
}

describe('MySpacePage', () => {
  it('redirects to /login when not authenticated', () => {
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('does not redirect when authenticated', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)
    expect(mockNavigate).not.toHaveBeenCalledWith('/login')
  })

  it('shows loading then empty state', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    expect(screen.getByTestId('loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())
  })

  it('renders file rows after loading', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ original_name: 'doc.pdf' }), makeFile({ id: 2, original_name: 'photo.jpg' })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getAllByTestId('file-row')).toHaveLength(2))
    expect(screen.getByText('doc.pdf')).toBeInTheDocument()
    expect(screen.getByText('photo.jpg')).toBeInTheDocument()
  })

  it('shows expiry info for active file', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile()] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByText('Expire dans 2 jours')).toBeInTheDocument())
  })

  it('shows Expiré for expired file', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ is_expired: true })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByText('Expiré')).toBeInTheDocument())
  })

  it('shows expired file message instead of action buttons', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ is_expired: true })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.queryByTestId('delete-button')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByTestId('access-button')).not.toBeInTheDocument())
  })

  it('shows Accéder and Supprimer buttons for active file', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile()] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('access-button')).toBeInTheDocument())
    expect(screen.getByTestId('delete-button')).toBeInTheDocument()
  })

  it('filters active files when Actifs tab is selected', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: {
        data: [
          makeFile({ id: 1, original_name: 'active.pdf', is_expired: false }),
          makeFile({ id: 2, original_name: 'expired.pdf', is_expired: true }),
        ],
      },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getAllByTestId('file-row')).toHaveLength(2))

    fireEvent.click(screen.getByTestId('tab-active'))

    expect(screen.getByText('active.pdf')).toBeInTheDocument()
    expect(screen.queryByText('expired.pdf')).not.toBeInTheDocument()
  })

  it('filters expired files when Expiré tab is selected', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: {
        data: [
          makeFile({ id: 1, original_name: 'active.pdf', is_expired: false }),
          makeFile({ id: 2, original_name: 'expired.pdf', is_expired: true }),
        ],
      },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getAllByTestId('file-row')).toHaveLength(2))

    fireEvent.click(screen.getByTestId('tab-expired'))

    expect(screen.queryByText('active.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('expired.pdf')).toBeInTheDocument()
  })

  it('logout clears token and navigates to /', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('logout-button'))

    expect(localStorage.getItem('token')).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
