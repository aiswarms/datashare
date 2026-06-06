import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../test/utils'
import LoginPage from './LoginPage'
import * as auth from '../api/auth'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../api/auth')

beforeEach(() => {
  mockNavigate.mockClear()
  vi.mocked(auth.login).mockClear()
  localStorage.clear()
})

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('Saisissez votre email...'), {
    target: { value: email },
  })
  fireEvent.change(screen.getByPlaceholderText('Saisissez votre mot de passe...'), {
    target: { value: password },
  })
  fireEvent.submit(screen.getByRole('button', { name: 'Connexion' }).closest('form')!)
}

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByPlaceholderText('Saisissez votre email...')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Saisissez votre mot de passe...')).toBeInTheDocument()
  })

  it('shows Créer un compte link', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByText('Créer un compte')).toBeInTheDocument()
  })

  it('clicking Créer un compte navigates to /register', () => {
    renderWithProviders(<LoginPage />)
    fireEvent.click(screen.getByText('Créer un compte'))
    expect(mockNavigate).toHaveBeenCalledWith('/register')
  })

  it('on success stores token and navigates to /', async () => {
    vi.mocked(auth.login).mockResolvedValue({ ok: true, status: 200, data: { token: 'jwt-token' } })
    renderWithProviders(<LoginPage />)

    fillAndSubmit('user@test.com', 'password1')

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
    expect(localStorage.getItem('token')).toBe('jwt-token')
  })

  it('on failure shows error message', async () => {
    vi.mocked(auth.login).mockResolvedValue({
      ok: false,
      status: 401,
      data: { message: 'Wrong email or password' },
    })
    renderWithProviders(<LoginPage />)

    fillAndSubmit('user@test.com', 'badpass')

    await waitFor(() => expect(screen.getByText('Wrong email or password')).toBeInTheDocument())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('on failure with no message shows fallback error', async () => {
    vi.mocked(auth.login).mockResolvedValue({ ok: false, status: 500, data: {} })
    renderWithProviders(<LoginPage />)

    fillAndSubmit('user@test.com', 'badpass')

    await waitFor(() => expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument())
  })
})
