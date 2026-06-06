import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test/utils'
import AppShell from './AppShell'

const mockNavigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

beforeEach(() => mockNavigate.mockClear())

describe('AppShell', () => {
  it('renders children', () => {
    renderWithProviders(<AppShell><span>hello</span></AppShell>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('shows DataShare brand', () => {
    renderWithProviders(<AppShell><span /></AppShell>)
    expect(screen.getByText('DataShare')).toBeInTheDocument()
  })

  it('shows Se connecter button', () => {
    renderWithProviders(<AppShell><span /></AppShell>)
    expect(screen.getByText('Se connecter')).toBeInTheDocument()
  })

  it('shows copyright footer', () => {
    renderWithProviders(<AppShell><span /></AppShell>)
    expect(screen.getByText(/Copyright DataShare/)).toBeInTheDocument()
  })

  it('clicking DataShare navigates to /', () => {
    renderWithProviders(<AppShell><span /></AppShell>)
    fireEvent.click(screen.getByText('DataShare'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('clicking Se connecter navigates to /login', () => {
    renderWithProviders(<AppShell><span /></AppShell>)
    fireEvent.click(screen.getByText('Se connecter'))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })
})
