import { useState } from 'react'
import { Box, VStack, Text, Input, Button } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { login } from '../api/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { ok, data } = await login(email, password)
    setLoading(false)
    if (ok) {
      localStorage.setItem('token', data.token)
      navigate('/')
    } else {
      setError(data.message ?? 'Une erreur est survenue')
    }
  }

  return (
    <AppShell>
      <Box
        bg="white"
        borderRadius="2xl"
        p={8}
        w={{ base: '90%', sm: '360px' }}
        shadow="md"
      >
        <form onSubmit={handleSubmit}>
          <VStack gap={4} align="stretch">
            <Text fontWeight="bold" fontSize="xl" textAlign="center">
              Connexion
            </Text>

            <VStack gap={1} align="stretch">
              <Text fontSize="sm" color="gray.600">Email</Text>
              <Input
                type="email"
                placeholder="Saisissez votre email..."
                value={email}
                onChange={e => setEmail(e.target.value)}
                borderColor="gray.200"
                size="sm"
              />
            </VStack>

            <VStack gap={1} align="stretch">
              <Text fontSize="sm" color="gray.600">Mot de passe</Text>
              <Input
                type="password"
                placeholder="Saisissez votre mot de passe..."
                value={password}
                onChange={e => setPassword(e.target.value)}
                borderColor="gray.200"
                size="sm"
              />
            </VStack>

            {error && (
              <Text fontSize="sm" color="red.500" textAlign="center">{error}</Text>
            )}

            <Text
              fontSize="sm"
              color="#D4675A"
              textAlign="center"
              cursor="pointer"
              _hover={{ textDecoration: 'underline' }}
              onClick={() => navigate('/register')}
            >
              Créer un compte
            </Text>

            <Button
              type="submit"
              w="full"
              size="sm"
              bg="#D4675A"
              color="white"
              borderRadius="full"
              loading={loading}
              _hover={{ bg: '#c25a4e' }}
            >
              Connexion
            </Button>
          </VStack>
        </form>
      </Box>
    </AppShell>
  )
}
