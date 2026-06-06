import { VStack, Text, Box } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <AppShell>
      <VStack gap={6}>
        <Text color="white" fontSize="xl" fontWeight="medium">
          Tu veux partager un fichier ?
        </Text>
        <Box
          w="64px"
          h="64px"
          bg="gray.900"
          borderRadius="full"
          display="flex"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          _hover={{ bg: 'gray.700' }}
          onClick={() => navigate('/login')}
          data-testid="upload-button"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
        </Box>
      </VStack>
    </AppShell>
  )
}
