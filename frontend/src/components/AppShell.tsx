import { Box, Flex, Text, Button } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

interface AppShellProps {
  children: React.ReactNode
  showLoginButton?: boolean
}

export default function AppShell({ children, showLoginButton = true }: AppShellProps) {
  const navigate = useNavigate()

  return (
    <Box
      minH="100vh"
      style={{ background: 'linear-gradient(160deg, #D4675A 0%, #F0A882 100%)' }}
      display="flex"
      flexDirection="column"
    >
      {/* Navbar */}
      <Flex
        px={6}
        py={4}
        justify="space-between"
        align="center"
        bg="white"
        boxShadow="sm"
      >
        <Text
          fontWeight="bold"
          fontSize="lg"
          color="gray.800"
          cursor="pointer"
          onClick={() => navigate('/')}
        >
          DataShare
        </Text>
        {showLoginButton && (
          localStorage.getItem('token') ? (
            <Button
              size="sm"
              bg="gray.900"
              color="white"
              borderRadius="full"
              px={5}
              _hover={{ bg: 'gray.700' }}
              onClick={() => navigate('/my-space')}
            >
              Mon espace
            </Button>
          ) : (
            <Button
              size="sm"
              bg="gray.900"
              color="white"
              borderRadius="full"
              px={5}
              _hover={{ bg: 'gray.700' }}
              onClick={() => navigate('/login')}
            >
              Se connecter
            </Button>
          )
        )}
      </Flex>

      {/* Content */}
      <Box flex="1" display="flex" alignItems="center" justifyContent="center">
        {children}
      </Box>

      {/* Footer */}
      <Text textAlign="center" color="whiteAlpha.700" fontSize="xs" pb={4}>
        Copyright DataShare® 2025
      </Text>
    </Box>
  )
}
