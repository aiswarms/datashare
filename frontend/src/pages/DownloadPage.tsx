import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Flex, Text, Button, HStack, VStack, Input } from '@chakra-ui/react'
import { getFileMeta, type FileMeta } from '../api/files'

const CORAL = '#D4675A'
const BG = '#FAF7F4'

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} Go`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} Mo`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} Ko`
  return `${bytes} o`
}

function formatExpiry(expiresAt: string): string {
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
  if (daysLeft <= 0) return 'Expiré'
  if (daysLeft === 1) return 'Expire demain'
  return `Expire dans ${daysLeft} jours`
}

const FileIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#718096" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

type PageState = 'loading' | 'not_found' | 'expired' | 'ready'

export default function DownloadPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [state, setState] = useState<PageState>('loading')
  const [meta, setMeta] = useState<FileMeta | null>(null)
  const [password, setPassword] = useState('')
  const [wrongPassword, setWrongPassword] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!token) { setState('not_found'); return }
    getFileMeta(token).then(({ ok, data }) => {
      if (!ok) { setState('not_found'); return }
      setMeta(data)
      setState(data.is_expired ? 'expired' : 'ready')
    })
  }, [token])

  async function handleDownload() {
    if (!meta) return
    const url = meta.password_protected
      ? `${meta.download_url}?password=${encodeURIComponent(password)}`
      : meta.download_url

    const res = await fetch(url)
    if (res.status === 401) {
      setWrongPassword(true)
      setTimeout(() => inputRef.current?.focus(), 0)
      return
    }
    setWrongPassword(false)
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = meta.original_name
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const isLoggedIn = !!localStorage.getItem('token')

  return (
    <Box minH="100vh" bg={BG} display="flex" flexDirection="column">
      <Flex
        px={6}
        py={3}
        align="center"
        justify="space-between"
        bg={BG}
        borderBottom="1px solid"
        borderColor="gray.200"
      >
        <Text fontWeight="bold" fontSize="lg" cursor="pointer" onClick={() => navigate('/')}>
          DataShare
        </Text>
        {isLoggedIn && (
          <Button
            size="sm"
            bg="transparent"
            color={CORAL}
            border="1px solid"
            borderColor={CORAL}
            borderRadius="lg"
            px={4}
            _hover={{ bg: '#fdf2f0' }}
            onClick={() => navigate('/my-space')}
            data-testid="my-space-link"
          >
            Mon espace
          </Button>
        )}
      </Flex>

      <Flex flex="1" align="center" justify="center" p={4}>
        <Box bg="white" borderRadius="2xl" p={8} w={{ base: '90%', sm: '420px' }} shadow="md">

          {state === 'loading' && (
            <Text color="gray.400" textAlign="center" data-testid="loading">Chargement…</Text>
          )}

          {state === 'not_found' && (
            <VStack gap={3}>
              <Text fontWeight="bold" fontSize="lg" textAlign="center" data-testid="not-found">
                Lien invalide
              </Text>
              <Text color="gray.500" fontSize="sm" textAlign="center">
                Ce lien n'existe pas ou a été supprimé.
              </Text>
            </VStack>
          )}

          {state === 'expired' && meta && (
            <VStack gap={3}>
              <FileIcon />
              <Text fontWeight="semibold" fontSize="md" textAlign="center" data-testid="expired-title">
                {meta.original_name}
              </Text>
              <Text color={CORAL} fontWeight="semibold" fontSize="sm" data-testid="expired-message">
                Ce fichier a expiré et n'est plus disponible.
              </Text>
            </VStack>
          )}

          {state === 'ready' && meta && (
            <VStack gap={5} align="stretch">
              <VStack gap={2} align="center">
                <FileIcon />
                <Text
                  fontWeight="bold"
                  fontSize="md"
                  textAlign="center"
                  style={{ wordBreak: 'break-all' }}
                  data-testid="file-name"
                >
                  {meta.original_name}
                </Text>
              </VStack>

              <Box bg="gray.50" borderRadius="md" px={4} py={3}>
                <VStack gap={1} align="stretch">
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">Taille</Text>
                    <Text fontSize="sm" fontWeight="medium" data-testid="file-size">{formatSize(meta.size)}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">Type</Text>
                    <Text fontSize="sm" fontWeight="medium" data-testid="file-type">{meta.mime_type}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="gray.500">Expiration</Text>
                    <Text fontSize="sm" fontWeight="medium" data-testid="file-expiry">{formatExpiry(meta.expires_at)}</Text>
                  </HStack>
                </VStack>
              </Box>

              {meta.password_protected && (
                <VStack gap={1} align="stretch">
                  <HStack gap={1.5}>
                    <LockIcon />
                    <Text fontSize="sm" color="gray.600">Ce fichier est protégé par un mot de passe</Text>
                  </HStack>
                  <Input
                    ref={inputRef}
                    type="password"
                    placeholder="Mot de passe"
                    size="sm"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setWrongPassword(false) }}
                    onKeyDown={e => e.key === 'Enter' && handleDownload()}
                    borderColor={wrongPassword ? 'red.400' : 'gray.200'}
                    data-testid="password-input"
                  />
                  {wrongPassword && (
                    <Text fontSize="xs" color="red.500" data-testid="wrong-password">
                      Mot de passe incorrect
                    </Text>
                  )}
                </VStack>
              )}

              <Button
                w="full"
                bg={CORAL}
                color="white"
                borderRadius="full"
                _hover={{ bg: '#c25a4e' }}
                onClick={handleDownload}
                disabled={meta.password_protected && password === ''}
                data-testid="download-button"
              >
                Télécharger
              </Button>
            </VStack>
          )}
        </Box>
      </Flex>

      <Text textAlign="center" color="gray.400" fontSize="xs" py={4}>
        Copyright DataShare® 2025
      </Text>
    </Box>
  )
}
