import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/utils'
import HomePage from './HomePage'
import * as files from '../api/files'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../api/files')

beforeEach(() => {
  mockNavigate.mockClear()
  vi.mocked(files.uploadAnonymous).mockClear()
  localStorage.clear()
})

function makeFile(name = 'doc.txt', size = 1024) {
  const file = new File(['x'], name, { type: 'text/plain' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('HomePage', () => {
  it('redirects to /upload when authenticated', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<HomePage />)
    expect(mockNavigate).toHaveBeenCalledWith('/upload')
  })

  it('does not redirect when not authenticated', () => {
    renderWithProviders(<HomePage />)
    expect(mockNavigate).not.toHaveBeenCalledWith('/upload')
    expect(mockNavigate).not.toHaveBeenCalledWith('/login')
  })

  it('shows the upload card title', () => {
    renderWithProviders(<HomePage />)
    expect(screen.getByText('Partager un fichier')).toBeInTheDocument()
  })

  it('submit button is disabled when no file selected', () => {
    renderWithProviders(<HomePage />)
    expect(screen.getByRole('button', { name: 'Téléverser' })).toBeDisabled()
  })

  it('shows file name after selection', () => {
    renderWithProviders(<HomePage />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('rapport.pdf', 2_500_000)] } })
    expect(screen.getByText('rapport.pdf')).toBeInTheDocument()
    expect(screen.getByText('2.5 Mo')).toBeInTheDocument()
  })

  it('shows size error when file exceeds 1 GB', () => {
    renderWithProviders(<HomePage />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('huge.iso', 1_073_741_825)] } })
    expect(screen.getByText('La taille des fichiers est limitée à 1 Go')).toBeInTheDocument()
  })

  it('on success shows download URL and copy button', async () => {
    vi.mocked(files.uploadAnonymous).mockResolvedValue({
      ok: true,
      status: 201,
      data: { token: 'abc123', download_url: '/api/files/abc123/download' },
    })
    renderWithProviders(<HomePage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.getByText('Copier le lien')).toBeInTheDocument())
    expect(screen.getByText(/conservé pendant/)).toBeInTheDocument()
  })

  it('on failure shows error message', async () => {
    vi.mocked(files.uploadAnonymous).mockResolvedValue({
      ok: false,
      status: 422,
      data: { message: 'File type not allowed' },
    })
    renderWithProviders(<HomePage />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Téléverser' }))

    await waitFor(() => expect(screen.getByText('File type not allowed')).toBeInTheDocument())
  })
})
