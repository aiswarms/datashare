import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/utils'
import RegisterPage from './RegisterPage'
import * as auth from '../api/auth'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../api/auth')

beforeEach(() => {
  mockNavigate.mockClear()
  vi.mocked(auth.register).mockClear()
})

function fillAndSubmit(email: string, password: string, confirm: string) {
  fireEvent.change(screen.getByPlaceholderText('Saisissez votre email...'), {
    target: { value: email },
  })
  fireEvent.change(screen.getByPlaceholderText('Saisissez votre mot de passe...'), {
    target: { value: password },
  })
  fireEvent.change(screen.getByPlaceholderText('Saisissez-le à nouveau...'), {
    target: { value: confirm },
  })
  fireEvent.submit(screen.getByRole('button', { name: 'Créer mon compte' }).closest('form')!)
}

describe('RegisterPage', () => {
  it('renders email, password and confirm fields', () => {
    renderWithProviders(<RegisterPage />)
    expect(screen.getByPlaceholderText('Saisissez votre email...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Saisissez votre mot de passe...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Saisissez-le à nouveau...')).toBeInTheDocument()
  })

  it('shows J\'ai déjà un compte link', () => {
    renderWithProviders(<RegisterPage />)
    expect(screen.getByText("J'ai déjà un compte")).toBeInTheDocument()
  })

  it('clicking J\'ai déjà un compte navigates to /login', () => {
    renderWithProviders(<RegisterPage />)
    fireEvent.click(screen.getByText("J'ai déjà un compte"))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('shows error and does not call API when passwords do not match', () => {
    renderWithProviders(<RegisterPage />)

    fillAndSubmit('user@test.com', 'password1', 'different')

    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    expect(auth.register).not.toHaveBeenCalled()
  })

  it('on success navigates to /login', async () => {
    vi.mocked(auth.register).mockResolvedValue({
      ok: true,
      status: 201,
      data: { id: 1, email: 'user@test.com' },
    })
    renderWithProviders(<RegisterPage />)

    fillAndSubmit('user@test.com', 'password1', 'password1')

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
  })

  it('on failure shows error message', async () => {
    vi.mocked(auth.register).mockResolvedValue({
      ok: false,
      status: 409,
      data: { message: 'Email already taken' },
    })
    renderWithProviders(<RegisterPage />)

    fillAndSubmit('taken@test.com', 'password1', 'password1')

    await waitFor(() => expect(screen.getByText('Email already taken')).toBeInTheDocument())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('on failure with no message shows fallback error', async () => {
    vi.mocked(auth.register).mockResolvedValue({ ok: false, status: 500, data: {} })
    renderWithProviders(<RegisterPage />)

    fillAndSubmit('user@test.com', 'password1', 'password1')

    await waitFor(() => expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument())
  })
})
