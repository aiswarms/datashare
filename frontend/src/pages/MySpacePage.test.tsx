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
  vi.mocked(files.deleteFile).mockClear()
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

  it('redirects to /login and clears token when getFiles returns 401', async () => {
    localStorage.setItem('token', 'expired-jwt')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: false, status: 401, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('redirects to /login when deleteFile returns 401', async () => {
    localStorage.setItem('token', 'expired-jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ id: 1 })] },
    })
    vi.mocked(files.deleteFile).mockResolvedValue({ ok: false, status: 401 })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('delete-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('delete-button'))
    fireEvent.click(screen.getByTestId('confirm-delete-button'))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
    expect(localStorage.getItem('token')).toBeNull()
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

  it('navigates to download page when Accéder is clicked', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ token: 'abc-123', password_protected: false })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('access-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('access-button'))

    expect(mockNavigate).toHaveBeenCalledWith('/download/abc-123')
  })

  it('navigates to download page for password-protected file', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ token: 'abc-123', password_protected: true })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('access-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('access-button'))

    expect(mockNavigate).toHaveBeenCalledWith('/download/abc-123')
  })

  it('clicking Supprimer shows confirmation, not delete immediately', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ id: 1, original_name: 'to-delete.pdf' })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('delete-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('delete-button'))

    expect(screen.getByTestId('confirm-delete-button')).toBeInTheDocument()
    expect(screen.getByTestId('cancel-delete-button')).toBeInTheDocument()
    expect(files.deleteFile).not.toHaveBeenCalled()
  })

  it('confirming delete removes the file from the list', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ id: 1, original_name: 'to-delete.pdf' })] },
    })
    vi.mocked(files.deleteFile).mockResolvedValue({ ok: true, status: 204 })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('delete-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('delete-button'))
    fireEvent.click(screen.getByTestId('confirm-delete-button'))

    await waitFor(() => expect(screen.queryByText('to-delete.pdf')).not.toBeInTheDocument())
    expect(files.deleteFile).toHaveBeenCalledWith(1)
  })

  it('cancelling delete keeps the file in the list', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ id: 1, original_name: 'keep.pdf' })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('delete-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('delete-button'))
    fireEvent.click(screen.getByTestId('cancel-delete-button'))

    expect(screen.queryByTestId('confirm-delete-button')).not.toBeInTheDocument()
    expect(screen.getByText('keep.pdf')).toBeInTheDocument()
    expect(files.deleteFile).not.toHaveBeenCalled()
  })

  it('keeps the file in the list when delete fails', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ id: 1, original_name: 'keep.pdf' })] },
    })
    vi.mocked(files.deleteFile).mockResolvedValue({ ok: false, status: 403 })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('delete-button')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('delete-button'))
    fireEvent.click(screen.getByTestId('confirm-delete-button'))

    await waitFor(() => expect(files.deleteFile).toHaveBeenCalled())
    expect(screen.getByText('keep.pdf')).toBeInTheDocument()
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

  it('opens mobile menu on hamburger click', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('hamburger-button'))
    expect(screen.getByTestId('menu-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('close-menu-button')).toBeInTheDocument()
  })

  it('closes mobile menu on overlay click', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('hamburger-button'))
    expect(screen.getByTestId('menu-overlay')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('menu-overlay'))
    await waitFor(() => expect(screen.queryByTestId('menu-overlay')).not.toBeInTheDocument())
  })

  it('closes mobile menu on close button click', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('hamburger-button'))
    expect(screen.getByTestId('menu-overlay')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('close-menu-button'))
    await waitFor(() => expect(screen.queryByTestId('menu-overlay')).not.toBeInTheDocument())
  })

  it('renders correctly with a valid JWT token', async () => {
    localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIn0.signature')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())
  })

  it('shows upload button and navigates to /upload', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())

    const uploadButton = screen.getByText('Ajouter des fichiers')
    fireEvent.click(uploadButton)
    expect(mockNavigate).toHaveBeenCalledWith('/upload')
  })

  it('navigates to / when DataShare title is clicked', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())

    const title = screen.getByText('DataShare')
    fireEvent.click(title)
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })


  it('shows lock icon for password protected files', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ password_protected: true })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => {
      const fileRow = screen.getByTestId('file-row')
      // Lock icon should be present in the file row
      expect(fileRow.querySelectorAll('svg')).toHaveLength(4) // FileIcon + LockIcon + TrashIcon + ArrowIcon
    })
  })

  it('does not show lock icon for non-password protected files', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ password_protected: false })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => {
      const fileRow = screen.getByTestId('file-row')
      // FileIcon + TrashIcon + ArrowIcon (no LockIcon for non-protected files)
      expect(fileRow.querySelectorAll('svg')).toHaveLength(3)
    })
  })

  it('does not show lock icon for expired password protected files', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ password_protected: true, is_expired: true })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => {
      const fileRow = screen.getByTestId('file-row')
      // Only FileIcon should be present (no LockIcon for expired)
      expect(fileRow.querySelectorAll('svg')).toHaveLength(1)
    })
  })

  it('shows expiry message for expired files with "Expire demain" for 1 day', async () => {
    localStorage.setItem('token', 'jwt')
    const tomorrowAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ expires_at: tomorrowAt })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByText('Expire demain')).toBeInTheDocument())
  })

  it('shows "Expiré" when file expiry date is in the past', async () => {
    localStorage.setItem('token', 'jwt')
    const pastDate = new Date(Date.now() - 1000).toISOString()

    vi.mocked(files.getFiles).mockResolvedValue({
      ok: true, status: 200,
      data: { data: [makeFile({ expires_at: pastDate, is_expired: false })] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByText('Expiré')).toBeInTheDocument())
  })

  it('shows correct tab button when "Tout" is selected', async () => {
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

    // Click on Tous tab (should already be selected by default)
    const toutsTab = screen.getByTestId('tab-all')
    expect(toutsTab).toBeInTheDocument()

    // Both files should be visible
    expect(screen.getByText('active.pdf')).toBeInTheDocument()
    expect(screen.getByText('expired.pdf')).toBeInTheDocument()
  })

  it('handles invalid token gracefully (catch block in getUserIdentifier)', async () => {
    // Set an invalid token that will fail to parse
    localStorage.setItem('token', 'invalid.token.format')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())
    // Should render without crashing, empty state should be shown
    expect(screen.getByTestId('empty')).toBeInTheDocument()
  })

  it('handles getFiles with ok: false', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.getFiles).mockResolvedValue({
      ok: false,
      status: 500,
      data: { data: [] },
    })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())
    // Should show empty state even when ok is false (since files remain empty)
    expect(screen.getByTestId('empty')).toBeInTheDocument()
  })

  it('renders correctly with an email-only JWT token', async () => {
    localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.signature')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())
  })

  it('falls back to empty string when token has neither username nor email', async () => {
    // Create a JWT with neither username nor email
    localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature')
    vi.mocked(files.getFiles).mockResolvedValue({ ok: true, status: 200, data: { data: [] } })
    renderWithProviders(<MySpacePage />)

    await waitFor(() => expect(screen.getByTestId('empty')).toBeInTheDocument())
    // Should render without the user email in the mobile header
    expect(screen.queryByText('1234567890')).not.toBeInTheDocument()
  })

})
