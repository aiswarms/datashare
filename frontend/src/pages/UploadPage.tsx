import { useEffect, useRef, useState } from 'react'
import { Box, VStack, HStack, Text, Input, Button } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { uploadFile } from '../api/files'

const MAX_SIZE = 1_073_741_824
const FORBIDDEN_EXTS = ['exe', 'bat', 'cmd', 'com', 'pif', 'vbs', 'ps1', 'msi', 'dll', 'sys', 'scr', 'sh']

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

export default function UploadPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [sizeError, setSizeError] = useState(false)
  const [extError, setExtError] = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('token')) navigate('/login')
  }, [navigate])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setSizeError(false)
    setExtError(false)
    setError('')
    if (!f) return
    setFile(f)
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    setSizeError(f.size > MAX_SIZE)
    setExtError(FORBIDDEN_EXTS.includes(ext))
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setPassword(val)
    setPasswordError(val.length > 0 && val.length < 6)
  }

  async function handleSubmit() {
    if (!file || sizeError || extError || passwordError) return
    setLoading(true)
    setError('')
    const pendingTag = tagInput.trim()
    const finalTags = pendingTag && !tags.includes(pendingTag) && pendingTag.length <= 30
      ? [...tags, pendingTag]
      : tags
    const { ok, status, data } = await uploadFile(file, expiresInDays, password || undefined, finalTags.length ? finalTags : undefined)
    setLoading(false)
    if (status === 401) {
      localStorage.removeItem('token')
      navigate('/login')
      return
    }
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
          <Text fontWeight="bold" fontSize="xl" textAlign="center">Ajouter un fichier</Text>

          {/* File row */}
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
            <Text fontSize="sm" color="red.500">
              Ce fichier dépasse la limite de 1 Go. Choisissez un fichier plus petit.
            </Text>
          )}
          {extError && (
            <Text fontSize="sm" color="red.500">
              Ce type de fichier est interdit (.exe, .bat, .sh, etc.). Choisissez un autre fichier.
            </Text>
          )}

          {success ? (
            <>
              <Text fontSize="sm" color="gray.700" textAlign="center">
                Félicitations, ton fichier sera conservé chez nous pendant {expiryLabel(expiresInDays)} !
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
                <Text fontSize="sm" color="gray.600">Tags</Text>
                <HStack gap={2}>
                  <Input
                    placeholder="Ajouter un tag…"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && tagInput.trim() && !tags.includes(tagInput.trim()) && tagInput.trim().length <= 30) {
                        setTags(prev => [...prev, tagInput.trim()])
                        setTagInput('')
                      }
                    }}
                    borderColor="gray.200"
                    size="sm"
                  />
                  <Button
                    size="sm"
                    bg="#D4675A"
                    color="white"
                    borderRadius="md"
                    px={3}
                    flexShrink={0}
                    _hover={{ bg: '#c25a4e' }}
                    disabled={!tagInput.trim() || tags.includes(tagInput.trim()) || tagInput.trim().length > 30}
                    onClick={() => {
                      if (tagInput.trim() && !tags.includes(tagInput.trim()) && tagInput.trim().length <= 30) {
                        setTags(prev => [...prev, tagInput.trim()])
                        setTagInput('')
                      }
                    }}
                  >
                    +
                  </Button>
                </HStack>
                {tags.length > 0 && (
                  <HStack gap={2} flexWrap="wrap" mt={1}>
                    {tags.map(tag => (
                      <Box
                        key={tag}
                        display="inline-flex"
                        alignItems="center"
                        gap="4px"
                        px={2}
                        py={0.5}
                        borderRadius="full"
                        bg="#fdf2f0"
                        border="1px solid"
                        borderColor="#D4675A"
                        fontSize="xs"
                        color="#D4675A"
                      >
                        {tag}
                        <Box
                          as="button"
                          lineHeight={1}
                          onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                          _hover={{ opacity: 0.7 }}
                        >
                          ×
                        </Box>
                      </Box>
                    ))}
                  </HStack>
                )}
              </VStack>

              <VStack gap={1} align="stretch">
                <Text fontSize="sm" color="gray.600">Mot de passe</Text>
                <Input
                  type="password"
                  placeholder="Optionnel"
                  value={password}
                  onChange={handlePasswordChange}
                  borderColor={passwordError ? 'red.400' : 'gray.200'}
                  size="sm"
                />
                {passwordError && (
                  <Text fontSize="sm" color="red.500">Le mot de passe doit contenir au moins 6 caractères</Text>
                )}
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
                disabled={!file || sizeError || extError || passwordError}
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
