import { useEffect, useRef, useState } from 'react'
import { Box, VStack, HStack, Text, Input, Button } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { uploadAnonymous } from '../api/files'

const MAX_SIZE = 1_073_741_824

const EXPIRY_OPTIONS = [
  { value: 1, label: 'Une journée' },
  { value: 2, label: '2 jours' },
  { value: 3, label: '3 jours' },
  { value: 4, label: '4 jours' },
  { value: 5, label: '5 jours' },
  { value: 6, label: '6 jours' },
  { value: 7, label: 'Une semaine' },
]

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} Go`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} Mo`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} Ko`
  return `${bytes} o`
}

function expiryLabel(days: number): string {
  if (days === 1) return 'une journée'
  if (days === 7) return 'une semaine'
  return `${days} jours`
}

const FileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#718096" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

export default function HomePage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [sizeError, setSizeError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('token')) navigate('/upload')
  }, [navigate])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setSizeError(false)
    setError('')
    if (!f) return
    setFile(f)
    setSizeError(f.size > MAX_SIZE)
  }

  async function handleSubmit() {
    if (!file || sizeError) return
    setLoading(true)
    setError('')
    const { ok, data } = await uploadAnonymous(file, expiresInDays, password || undefined)
    setLoading(false)
    if (ok) {
      setDownloadUrl(`${window.location.origin}/download/${data.token}`)
    } else {
      setError(data.message ?? 'Une erreur est survenue')
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(downloadUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const success = downloadUrl !== ''

  return (
    <AppShell>
      <Box bg="white" borderRadius="2xl" p={8} w={{ base: '90%', sm: '400px' }} shadow="md">
        <VStack gap={4} align="stretch">
          <Text fontWeight="bold" fontSize="xl" textAlign="center">Partager un fichier</Text>

          <Box border="1px solid" borderColor="gray.200" borderRadius="md" p={3}>
            {file ? (
              <HStack justify="space-between">
                <HStack gap={2} overflow="hidden" flex="1">
                  <FileIcon />
                  <VStack gap={0} align="start" overflow="hidden">
                    <Text
                      fontSize="sm"
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}
                    >
                      {file.name}
                    </Text>
                    <Text fontSize="xs" color="gray.500">{formatSize(file.size)}</Text>
                  </VStack>
                </HStack>
                {!success && (
                  <Button
                    size="xs"
                    bg="#D4675A"
                    color="white"
                    borderRadius="full"
                    flexShrink={0}
                    _hover={{ bg: '#c25a4e' }}
                    onClick={() => inputRef.current?.click()}
                  >
                    Changer
                  </Button>
                )}
              </HStack>
            ) : (
              <Button variant="ghost" w="full" color="gray.400" onClick={() => inputRef.current?.click()}>
                Choisir un fichier
              </Button>
            )}
          </Box>

          <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />

          {sizeError && (
            <Text fontSize="sm" color="red.500">La taille des fichiers est limitée à 1 Go</Text>
          )}

          {success ? (
            <>
              <Text fontSize="sm" color="gray.700" textAlign="center">
                Ton fichier sera conservé pendant {expiryLabel(expiresInDays)} !
              </Text>
              <Text
                fontSize="sm"
                color="#D4675A"
                textAlign="center"
                style={{ wordBreak: 'break-all', cursor: 'pointer' }}
                onClick={() => window.open(downloadUrl, '_blank')}
              >
                {downloadUrl}
              </Text>
              <Button
                w="full"
                size="sm"
                bg="#D4675A"
                color="white"
                borderRadius="full"
                _hover={{ bg: '#c25a4e' }}
                onClick={handleCopy}
              >
                {copied ? 'Copié !' : 'Copier le lien'}
              </Button>
            </>
          ) : (
            <>
              <VStack gap={1} align="stretch">
                <Text fontSize="sm" color="gray.600">Mot de passe</Text>
                <Input
                  type="password"
                  placeholder="Optionnel"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  borderColor="gray.200"
                  size="sm"
                />
              </VStack>

              <VStack gap={1} align="stretch">
                <Text fontSize="sm" color="gray.600">Expiration</Text>
                <select
                  value={expiresInDays}
                  onChange={e => setExpiresInDays(Number(e.target.value))}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontSize: '14px',
                    backgroundColor: 'white',
                    color: '#1A202C',
                    width: '100%',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {EXPIRY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </VStack>

              {error && (
                <Text fontSize="sm" color="red.500" textAlign="center">{error}</Text>
              )}

              <Button
                w="full"
                size="sm"
                bg="gray.900"
                color="white"
                borderRadius="full"
                loading={loading}
                disabled={!file || sizeError}
                _hover={{ bg: 'gray.700' }}
                onClick={handleSubmit}
              >
                Téléverser
              </Button>
            </>
          )}
        </VStack>
      </Box>
    </AppShell>
  )
}
