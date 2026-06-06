import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test/utils'
import HomePage from './HomePage'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(() => {
  mockNavigate.mockClear()
  localStorage.clear()
})

describe('HomePage', () => {
  it('shows upload prompt', () => {
    renderWithProviders(<HomePage />)
    expect(screen.getByText('Tu veux partager un fichier ?')).toBeInTheDocument()
  })

  it('clicking upload button navigates to /login when not authenticated', () => {
    renderWithProviders(<HomePage />)
    fireEvent.click(screen.getByTestId('upload-button'))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('clicking upload button navigates to /upload when authenticated', () => {
    localStorage.setItem('token', 'jwt')
    renderWithProviders(<HomePage />)
    fireEvent.click(screen.getByTestId('upload-button'))
    expect(mockNavigate).toHaveBeenCalledWith('/upload')
  })
})
