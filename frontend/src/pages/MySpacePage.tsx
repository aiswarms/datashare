import { useEffect, useState } from 'react'
import { Box, Flex, Text, Button, HStack, VStack } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { getFiles, deleteFile, type FileRecord } from '../api/files'

const CORAL = '#D4675A'
const BG = '#FAF7F4'
const SIDEBAR_GRADIENT = 'linear-gradient(160deg, #D4675A 0%, #F0A882 100%)'

function formatExpiry(file: FileRecord): string {
  if (file.is_expired) return 'Expiré'
  const daysLeft = Math.ceil((new Date(file.expires_at).getTime() - Date.now()) / 86_400_000)
  if (daysLeft <= 0) return 'Expiré'
  if (daysLeft === 1) return 'Expire demain'
  return `Expire dans ${daysLeft} jours`
}

function getUserEmail(): string {
  const token = localStorage.getItem('token')
  if (!token) return ''
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.username ?? payload.email ?? ''
  } catch {
    return ''
  }
}

const FileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#718096" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
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

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const DotsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={CORAL} strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="5" r="1" fill={CORAL} />
    <circle cx="12" cy="12" r="1" fill={CORAL} />
    <circle cx="12" cy="19" r="1" fill={CORAL} />
  </svg>
)

type Tab = 'all' | 'active' | 'expired'
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'expired', label: 'Expiré' },
]

export default function MySpacePage() {
  const navigate = useNavigate()
  const [files, setFiles] = useState<FileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const userEmail = getUserEmail()

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login')
      return
    }
    getFiles().then(({ ok, status, data }) => {
      if (status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }
      if (ok) {
        setFiles(data.data)
        setAllTags([...new Set(data.data.flatMap(f => f.tags))].sort())
      }
      setLoading(false)
    })
  }, [navigate])

  async function handleTagFilter(tag: string | null) {
    setSelectedTag(tag)
    const { ok, status, data } = await getFiles(tag ?? undefined)
    if (status === 401) {
      localStorage.removeItem('token')
      navigate('/login')
      return
    }
    if (ok) setFiles(data.data)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/')
  }

  const filtered = files.filter(f =>
    tab === 'active' ? !f.is_expired : tab === 'expired' ? f.is_expired : true
  )

  return (
    <Box minH="100vh" display="flex" bg={BG}>

      {/* ── SIDEBAR desktop ── */}
      <Box
        display={{ base: 'none', md: 'flex' }}
        w="220px"
        flexShrink={0}
        style={{ background: SIDEBAR_GRADIENT }}
        flexDirection="column"
        minH="100vh"
      >
        <Text fontWeight="bold" fontSize="xl" color="white" px={5} pt={6} pb={6} cursor="pointer" onClick={() => navigate('/')}>
          DataShare
        </Text>
        <Box px={3}>
          <Box px={4} py={2} style={{ background: 'rgba(255,255,255,0.25)' }} color="white" borderRadius="full" fontSize="sm" fontWeight="medium" textAlign="center" cursor="pointer">
            Mes fichiers
          </Box>
        </Box>
        <Box flex="1" />
        <Text color="whiteAlpha.700" fontSize="xs" px={5} pb={5}>Copyright DataShare® 2025</Text>
      </Box>

      {/* ── MOBILE DRAWER ── */}
      {drawerOpen && (
        <>
          <Box position="fixed" inset={0} bg="blackAlpha.500" zIndex={10} onClick={() => setDrawerOpen(false)} data-testid="menu-overlay" />
          <Box position="fixed" top={0} left={0} bottom={0} w="220px" zIndex={20} style={{ background: SIDEBAR_GRADIENT }} display="flex" flexDirection="column">
            <Flex align="center" px={4} pt={5} pb={6} gap={3}>
              <Box as="button" color="white" onClick={() => setDrawerOpen(false)} data-testid="close-menu-button" lineHeight={1}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Box>
              <Text fontWeight="bold" fontSize="lg" color="white">DataShare</Text>
            </Flex>
            <Box px={3}>
              <Box px={4} py={2} style={{ background: 'rgba(255,255,255,0.25)' }} color="white" borderRadius="full" fontSize="sm" fontWeight="medium" textAlign="center">
                Mes fichiers
              </Box>
            </Box>
            <Box flex="1" />
            <Text color="whiteAlpha.700" fontSize="xs" px={5} pb={5}>Copyright DataShare® 2025</Text>
          </Box>
        </>
      )}

      {/* ── MAIN AREA ── */}
      <Box flex="1" display="flex" flexDirection="column">

        {/* Top bar — desktop */}
        <Flex display={{ base: 'none', md: 'flex' }} px={8} py={4} justify="flex-end" align="center" gap={4} bg={BG}>
          <Button size="sm" bg="gray.900" color="white" borderRadius="lg" px={5} _hover={{ bg: 'gray.700' }} onClick={() => navigate('/upload')}>
            Ajouter des fichiers
          </Button>
          <Box as="button" display="flex" alignItems="center" gap="6px" color={CORAL} fontSize="sm" fontWeight="medium" cursor="pointer" onClick={handleLogout} data-testid="logout-button">
            <LogoutIcon />
            <span>Déconnexion</span>
          </Box>
        </Flex>

        {/* Top bar — mobile */}
        <Flex display={{ base: 'flex', md: 'none' }} px={4} py={3} align="center" justify="space-between" bg={BG} borderBottom="1px solid" borderColor="gray.200">
          <Box as="button" cursor="pointer" onClick={() => setDrawerOpen(true)} data-testid="hamburger-button">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </Box>
          <Flex align="center" gap={2}>
            <Box w="30px" h="30px" borderRadius="full" bg={CORAL} display="flex" alignItems="center" justifyContent="center">
              <Text color="white" fontSize="xs" fontWeight="bold">{userEmail.charAt(0).toUpperCase()}</Text>
            </Box>
            <Text fontSize="sm" fontWeight="medium">{userEmail}</Text>
          </Flex>
        </Flex>

        {/* Content */}
        <Box px={{ base: 4, md: 8 }} pb={8} pt={{ base: 4, md: 0 }} flex="1">
          <Text fontSize="2xl" fontWeight="bold" mb={5}>Mes fichiers</Text>

          {/* Tabs */}
          <Box
            display="inline-flex"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="full"
            overflow="hidden"
            mb={6}
            bg="white"
          >
            {TABS.map(({ key, label }) => (
              <Box
                key={key}
                as="button"
                px={5}
                py={1.5}
                fontSize="sm"
                fontWeight={tab === key ? 'semibold' : 'normal'}
                cursor="pointer"
                borderRadius="full"
                bg={tab === key ? CORAL : 'transparent'}
                color={tab === key ? 'white' : 'gray.700'}
                onClick={() => setTab(key)}
                data-testid={`tab-${key}`}
                transition="background 0.15s"
              >
                {label}
              </Box>
            ))}
          </Box>

          {/* Tag filter chips */}
          {allTags.length > 0 && (
            <HStack gap={2} mb={4} flexWrap="wrap">
              {allTags.map(tag => (
                <Box key={tag} as="button" px={3} py={1} fontSize="xs" borderRadius="full" border="1px solid" borderColor={selectedTag === tag ? CORAL : 'gray.300'} bg={selectedTag === tag ? CORAL : 'white'} color={selectedTag === tag ? 'white' : 'gray.600'} cursor="pointer" onClick={() => handleTagFilter(selectedTag === tag ? null : tag)} data-testid={`tag-chip-${tag}`}>
                  {tag}
                </Box>
              ))}
              {selectedTag && (
                <Box as="button" px={3} py={1} fontSize="xs" borderRadius="full" border="1px solid" borderColor="gray.200" bg="white" color="gray.400" cursor="pointer" onClick={() => handleTagFilter(null)} data-testid="clear-tag-filter">
                  Effacer
                </Box>
              )}
            </HStack>
          )}

          {/* File list */}
          {loading ? (
            <Text color="gray.400" data-testid="loading">Chargement…</Text>
          ) : filtered.length === 0 ? (
            <Text color="gray.400" data-testid="empty">Aucun fichier.</Text>
          ) : (
            <VStack gap={2} align="stretch">
              {filtered.map(file => (
                <FileRow key={file.id} file={file} onDelete={() => setFiles(prev => prev.filter(f => f.id !== file.id))} />
              ))}
            </VStack>
          )}
        </Box>
      </Box>
    </Box>
  )
}

function FileRow({ file, onDelete }: { file: FileRecord; onDelete: () => void }) {
  const navigate = useNavigate()
  const expiry = formatExpiry(file)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function handleDeleteConfirmed() {
    setDeleting(true)
    const { ok, status } = await deleteFile(file.id)
    if (status === 401) {
      localStorage.removeItem('token')
      navigate('/login')
      return
    }
    if (ok) {
      onDelete()
    } else {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <Box bg="white" borderRadius="md" border="1px solid" borderColor="gray.150" data-testid="file-row">
      <Flex align="center" px={4} py={3} gap={3}>
        <FileIcon />

        <Box flex="1" minW={0}>
          <Text fontSize="sm" fontWeight="semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.original_name}
          </Text>
          <Text fontSize="xs" color={file.is_expired ? CORAL : 'gray.500'} fontWeight={file.is_expired ? 'semibold' : 'normal'}>
            {expiry}
          </Text>
          {file.tags.length > 0 && (
            <HStack gap={1} mt={1} flexWrap="wrap">
              {file.tags.map(tag => (
                <Box
                  key={tag}
                  px={2}
                  py={0.5}
                  borderRadius="full"
                  bg="#fdf2f0"
                  border="1px solid"
                  borderColor={CORAL}
                  fontSize="10px"
                  color={CORAL}
                  lineHeight="1.4"
                >
                  {tag}
                </Box>
              ))}
            </HStack>
          )}
        </Box>

        {file.password_protected && (
          <Box flexShrink={0}><LockIcon /></Box>
        )}

        {/* Desktop actions */}
        {file.is_expired ? (
          <Text fontSize="sm" color="gray.400" display={{ base: 'none', md: 'block' }}>
            Ce fichier a expiré, il n'est plus stocké chez nous
          </Text>
        ) : (
          <HStack gap={2} flexShrink={0} display={{ base: 'none', md: 'flex' }}>
            <Button size="xs" bg="white" color={CORAL} border="1px solid" borderColor={CORAL} borderRadius="md" px={3} _hover={{ bg: '#fdf2f0' }} onClick={() => setConfirmDelete(true)} data-testid="delete-button">
              <HStack gap={1}><TrashIcon /><span>Supprimer</span></HStack>
            </Button>
            <Button size="xs" bg="white" color={CORAL} border="1px solid" borderColor={CORAL} borderRadius="md" px={3} _hover={{ bg: '#fdf2f0' }} onClick={() => navigate(`/download/${file.token}`)} data-testid="access-button">
              <HStack gap={1}><span>Accéder</span><ArrowRightIcon /></HStack>
            </Button>
          </HStack>
        )}

        {/* Mobile actions — three-dot menu */}
        {!file.is_expired && (
          <Box display={{ base: 'block', md: 'none' }} flexShrink={0} position="relative">
            <Box
              as="button"
              w="32px"
              h="32px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="md"
              border="1px solid"
              borderColor={CORAL}
              bg="white"
              cursor="pointer"
              onClick={() => setMobileMenuOpen(o => !o)}
              data-testid="dots-button"
            >
              <DotsIcon />
            </Box>
            {mobileMenuOpen && (
              <Box position="absolute" right={0} top="36px" bg="white" border="1px solid" borderColor="gray.200" borderRadius="md" boxShadow="md" zIndex={5} minW="140px" py={1}>
                <Box as="button" w="full" px={4} py={2} fontSize="sm" textAlign="left" color={CORAL} _hover={{ bg: '#fdf2f0' }} onClick={() => { setMobileMenuOpen(false); navigate(`/download/${file.token}`) }} data-testid="access-button">
                  Accéder →
                </Box>
                <Box as="button" w="full" px={4} py={2} fontSize="sm" textAlign="left" color={CORAL} _hover={{ bg: '#fdf2f0' }} onClick={() => { setMobileMenuOpen(false); setConfirmDelete(true) }} data-testid="delete-button">
                  Supprimer
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Flex>

      {confirmDelete && (
        <HStack px={4} pb={3} gap={2} align="center">
          <Text fontSize="sm" color="gray.600" flex="1">Confirmer la suppression ?</Text>
          <Button size="sm" bg="white" color={CORAL} border="1px solid" borderColor={CORAL} borderRadius="md" flexShrink={0} _hover={{ bg: '#fdf2f0' }} loading={deleting} onClick={handleDeleteConfirmed} data-testid="confirm-delete-button">
            Supprimer
          </Button>
          <Button size="sm" variant="ghost" color="gray.500" flexShrink={0} onClick={() => setConfirmDelete(false)} data-testid="cancel-delete-button">
            Annuler
          </Button>
        </HStack>
      )}
    </Box>
  )
}
