import { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { MemoryRouter } from 'react-router-dom'

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={defaultSystem}>
      <MemoryRouter>{children}</MemoryRouter>
    </ChakraProvider>
  )
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Providers, ...options })
}
