import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/utils'
import UploadPage from './UploadPage'
import * as files from '../api/files'

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
})
