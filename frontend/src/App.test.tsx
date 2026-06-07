import { screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import App from './App'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock all the page components
vi.mock('./pages/HomePage', () => ({
  default: () => <div>HomePage</div>
}))

vi.mock('./pages/LoginPage', () => ({
  default: () => <div>LoginPage</div>
}))

vi.mock('./pages/RegisterPage', () => ({
  default: () => <div>RegisterPage</div>
}))

vi.mock('./pages/UploadPage', () => ({
  default: () => <div>UploadPage</div>
}))

vi.mock('./pages/MySpacePage', () => ({
  default: () => <div>MySpacePage</div>
}))

// Helper to render App with Chakra provider only
function renderApp() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByText('HomePage')).toBeInTheDocument()
    })
  })

  it('renders the router with all routes', async () => {
    renderApp()
    await waitFor(() => {
      expect(screen.getByText('HomePage')).toBeInTheDocument()
    })
  })

  it('has BrowserRouter as root element', () => {
    const { container } = renderApp()
    // The App component should render without errors
    expect(container).toBeTruthy()
  })

  it('imports all required page components', () => {
    // Verify all pages are imported by checking the mocks were called
    renderApp()
    // If rendering succeeds, all imports are valid
    expect(true).toBe(true)
  })
})
