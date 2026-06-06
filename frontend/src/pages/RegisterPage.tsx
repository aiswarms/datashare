import { useState } from 'react'
import { Box, VStack, Text, Input, Button } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { register } from '../api/auth'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    const { ok, data } = await register(email, password)
    setLoading(false)
    if (ok) {
      navigate('/login')
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
              Créer un compte
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

            <VStack gap={1} align="stretch">
              <Text fontSize="sm" color="gray.600">Vérification du mot de passe</Text>
              <Input
                type="password"
                placeholder="Saisissez-le à nouveau..."
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
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
              onClick={() => navigate('/login')}
            >
              J'ai déjà un compte
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
              Créer mon compte
            </Button>
          </VStack>
        </form>
      </Box>
    </AppShell>
  )
}
