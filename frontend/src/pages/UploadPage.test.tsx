import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/utils'
import UploadPage from './UploadPage'
import * as files from '../api/files'

// Test helper functions that are not exported but we can test through UI
// formatSize and expiryLabel are tested indirectly through component rendering

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../api/files')

beforeEach(() => {
  mockNavigate.mockClear()
  vi.mocked(files.uploadFile).mockClear()
  localStorage.clear()
})

function makeFile(name = 'photo.jpg', size = 1024 * 1024) {
  const file = new File(['x'], name, { type: 'image/jpeg' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('UploadPage', () => {
  it('redirects to /login when not authenticated', () => {
    renderWithProviders(<UploadPage />)
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('does not redirect when authenticated', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)
    expect(mockNavigate).not.toHaveBeenCalledWith('/login')
  })

  it('shows the upload card title', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)
    expect(screen.getByText('Ajouter un fichier')).toBeInTheDocument()
  })

  it('shows file name and size after file selection', async () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('rapport.pdf', 2_500_000)] } })

    expect(screen.getByText('rapport.pdf')).toBeInTheDocument()
    expect(screen.getByText('2.5 Mo')).toBeInTheDocument()
  })

  it('shows size error when file exceeds 1 GB', async () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('huge.iso', 1_073_741_825)] } })

    expect(screen.getByText('La taille des fichiers est limitée à 1 Go')).toBeInTheDocument()
  })

  it('disables submit when no file selected', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)
    const btn = screen.getByRole('button', { name: 'Téléverser' })
    expect(btn).toBeDisabled()
  })

  it('on success shows download URL and copy button', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'abc123', download_url: '/api/files/abc123/download' },
    })
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.getByText('Copier le lien')).toBeInTheDocument())
    expect(screen.getByText(/Félicitations/)).toBeInTheDocument()
  })

  it('on failure shows error message', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: false,
      status: 422,
      data: { message: 'File type not allowed' },
    })
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.getByText('File type not allowed')).toBeInTheDocument())
  })

  it('redirects to /login and clears token when upload returns 401', async () => {
    localStorage.setItem('token', 'expired-jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: false,
      status: 401,
      data: { message: 'Unauthorized' },
    })
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('clears size error and error when selecting a file', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    // First create a size error
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('huge.iso', 1_073_741_825)] } })
    expect(screen.getByText('La taille des fichiers est limitée à 1 Go')).toBeInTheDocument()

    // Select a valid file to clear error
    fireEvent.change(input, { target: { files: [makeFile('valid.pdf', 1024)] } })
    expect(screen.queryByText('La taille des fichiers est limitée à 1 Go')).not.toBeInTheDocument()
  })

  it('does not set file when no file is selected in input', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [] } })
    expect(screen.getByRole('button', { name: 'Téléverser' })).toBeDisabled()
  })

  it('shows "Changer" button after file selection and before success', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('photo.jpg')] } })
    expect(screen.getByRole('button', { name: 'Changer' })).toBeInTheDocument()
  })

  it('formats file size in Ko correctly', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    // 1.5 Ko = 1536 bytes (should show as "1.5 Ko")
    fireEvent.change(input, { target: { files: [makeFile('small.txt', 1500)] } })
    expect(screen.getByText('1.5 Ko')).toBeInTheDocument()
  })

  it('formats file size in bytes correctly', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    // 500 bytes (should show as "500 o")
    fireEvent.change(input, { target: { files: [makeFile('tiny.txt', 500)] } })
    expect(screen.getByText('500 o')).toBeInTheDocument()
  })

  it('shows expiry label with default case for 2 days', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'abc123', download_url: '/api/files/abc123/download' },
    })
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })

    // Select 2 days from dropdown
    const select = document.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '2' } })

    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.getByText(/2 jours/)).toBeInTheDocument(), { timeout: 10000 })
  })

  it('hides "Changer" button after successful upload', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'abc123', download_url: '/api/files/abc123/download' },
    })
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Changer' })).not.toBeInTheDocument())
  })

  it('copies download URL to clipboard on click', async () => {
    localStorage.setItem('token', 'jwt')
    const clipboardSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)

    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'abc123', download_url: '/api/files/abc123/download' },
    })
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.getByText('Copier le lien')).toBeInTheDocument(), { timeout: 10000 })
    fireEvent.click(screen.getByRole('button', { name: 'Copier le lien' }))

    expect(clipboardSpy).toHaveBeenCalledWith(expect.stringContaining('/download/abc123'))
    expect(screen.getByText('Copié !')).toBeInTheDocument()

    clipboardSpy.mockRestore()
  })

  it('changes expiry days when selecting from dropdown', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'abc123', download_url: '/api/files/abc123/download' },
    })
    renderWithProviders(<UploadPage />)

    const select = document.querySelector('select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: '3' } })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })

    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    // The expiry label should be in the success message
    await waitFor(() => {
      expect(vi.mocked(files.uploadFile)).toHaveBeenCalledWith(expect.anything(), 3, undefined, undefined)
    })
  })

  it('renders success screen with download URL and congratulations message', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'test-token', download_url: '/api/files/test-token/download' },
    })
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('document.pdf')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    // Wait for success state
    await waitFor(() => {
      expect(screen.getByText(/Félicitations/)).toBeInTheDocument()
      expect(screen.getByText(/Copier le lien/)).toBeInTheDocument()
      expect(screen.getByText(/test-token/)).toBeInTheDocument()
    }, { timeout: 10000 })
  })

  it('shows password input and expiry dropdown before upload', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    expect(screen.getByPlaceholderText('Optionnel')).toBeInTheDocument()
    expect(document.querySelector('select')).toBeInTheDocument()
  })

  it('does not render success section before upload', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    expect(screen.queryByText(/Félicitations/)).not.toBeInTheDocument()
  })

  it('renders file icon when file is selected', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('photo.jpg')] } })

    // SVG icon should exist
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('shows "Choisir un fichier" button when no file selected', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    expect(screen.getByRole('button', { name: 'Choisir un fichier' })).toBeInTheDocument()
  })

  it('does not show "Changer" button when no file selected', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    expect(screen.queryByRole('button', { name: 'Changer' })).not.toBeInTheDocument()
  })

  it('allows changing file by clicking "Changer" button', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('first.pdf', 1024)] } })
    expect(screen.getByText('first.pdf')).toBeInTheDocument()

    // Click Changer button
    fireEvent.click(screen.getByRole('button', { name: 'Changer' }))

    // Select a different file
    fireEvent.change(input, { target: { files: [makeFile('second.pdf', 2048)] } })
    expect(screen.getByText('second.pdf')).toBeInTheDocument()
  })

  it('sets password correctly when entered', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const passwordInput = screen.getByPlaceholderText('Optionnel') as HTMLInputElement
    fireEvent.change(passwordInput, { target: { value: 'secret123' } })

    expect(passwordInput.value).toBe('secret123')
  })

  it('passes password to uploadFile when set', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'abc123', download_url: '/api/files/abc123/download' },
    })
    renderWithProviders(<UploadPage />)

    const passwordInput = screen.getByPlaceholderText('Optionnel') as HTMLInputElement
    fireEvent.change(passwordInput, { target: { value: 'mypassword' } })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })

    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.getByText(/Félicitations/)).toBeInTheDocument())
    const calls = vi.mocked(files.uploadFile).mock.calls
    expect(calls[0][2]).toBe('mypassword')
  })

  it('passes undefined password to uploadFile when empty', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'abc123', download_url: '/api/files/abc123/download' },
    })
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })

    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.getByText(/Félicitations/)).toBeInTheDocument())
    const calls = vi.mocked(files.uploadFile).mock.calls
    expect(calls[0][2]).toBeUndefined()
  })

  it('passes undefined for tags when no tags are added', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'abc123', download_url: '/api/files/abc123/download' },
    })
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })

    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.getByText(/Félicitations/)).toBeInTheDocument())
    const calls = vi.mocked(files.uploadFile).mock.calls
    expect(calls[0][3]).toBeUndefined()
  })

  it('adds a tag by pressing Enter and shows it as a chip', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const tagInput = screen.getByPlaceholderText('Ajouter un tag…')
    fireEvent.change(tagInput, { target: { value: 'design' } })
    fireEvent.keyDown(tagInput, { key: 'Enter' })

    expect(screen.getByText('design')).toBeInTheDocument()
    expect((tagInput as HTMLInputElement).value).toBe('')
  })

  it('adds a tag by clicking the + button', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const tagInput = screen.getByPlaceholderText('Ajouter un tag…')
    fireEvent.change(tagInput, { target: { value: 'frontend' } })
    fireEvent.click(screen.getByRole('button', { name: '+' }))

    expect(screen.getByText('frontend')).toBeInTheDocument()
  })

  it('does not add duplicate tags', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const tagInput = screen.getByPlaceholderText('Ajouter un tag…')
    fireEvent.change(tagInput, { target: { value: 'dup' } })
    fireEvent.keyDown(tagInput, { key: 'Enter' })
    fireEvent.change(tagInput, { target: { value: 'dup' } })
    fireEvent.keyDown(tagInput, { key: 'Enter' })

    expect(screen.getAllByText('dup')).toHaveLength(1)
  })

  it('does not add tags longer than 30 characters', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const tagInput = screen.getByPlaceholderText('Ajouter un tag…')
    const longTag = 'a'.repeat(31)
    fireEvent.change(tagInput, { target: { value: longTag } })
    fireEvent.keyDown(tagInput, { key: 'Enter' })

    expect(screen.queryByText(longTag)).not.toBeInTheDocument()
  })

  it('removes a tag chip when × is clicked', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const tagInput = screen.getByPlaceholderText('Ajouter un tag…')
    fireEvent.change(tagInput, { target: { value: 'remove-me' } })
    fireEvent.keyDown(tagInput, { key: 'Enter' })

    expect(screen.getByText('remove-me')).toBeInTheDocument()
    fireEvent.click(screen.getByText('×'))
    expect(screen.queryByText('remove-me')).not.toBeInTheDocument()
  })

  it('passes tags array to uploadFile when tags are added', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'abc123', download_url: '/api/files/abc123/download' },
    })
    renderWithProviders(<UploadPage />)

    const tagInput = screen.getByPlaceholderText('Ajouter un tag…')
    fireEvent.change(tagInput, { target: { value: 'alpha' } })
    fireEvent.keyDown(tagInput, { key: 'Enter' })
    fireEvent.change(tagInput, { target: { value: 'beta' } })
    fireEvent.keyDown(tagInput, { key: 'Enter' })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.getByText(/Félicitations/)).toBeInTheDocument())
    const calls = vi.mocked(files.uploadFile).mock.calls
    expect(calls[0][3]).toEqual(['alpha', 'beta'])
  })

  it('disables submit button when size error exists', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('huge.iso', 1_073_741_825)] } })

    const submitBtn = screen.getByRole('button', { name: 'Téléverser' })
    expect(submitBtn).toBeDisabled()
  })

  it('shows error message when upload fails with no error data message', async () => {
    localStorage.setItem('token', 'jwt')
    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: false,
      status: 500,
      data: { message: undefined },
    })
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument())
  })

  it('handles formatSize for Go correctly', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('large.iso', 1_500_000_000)] } })

    expect(screen.getByText('1.5 Go')).toBeInTheDocument()
  })

  it('opens file picker when clicking "Choisir un fichier" button', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<UploadPage />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    fireEvent.click(screen.getByRole('button', { name: 'Choisir un fichier' }))

    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('opens download URL when clicking on it', async () => {
    localStorage.setItem('token', 'jwt')
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null)

    vi.mocked(files.uploadFile).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'test-token-abc', download_url: '/api/files/test-token-abc/download' },
    })
    renderWithProviders(<UploadPage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('document.pdf')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => {
      expect(screen.getByText(/test-token-abc/)).toBeInTheDocument()
    })

    // Click on the download URL
    const downloadLink = screen.getByText(/test-token-abc/)
    fireEvent.click(downloadLink)

    expect(windowOpenSpy).toHaveBeenCalledWith(expect.stringContaining('/download/test-token-abc'), '_blank')
    windowOpenSpy.mockRestore()
  })
})
