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

function getUserIdentifier(): string {
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

const ArrowRightIcon = ({ color = CORAL }: { color?: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
      if (ok) setFiles(data.data)
      setLoading(false)
    })
  }, [navigate])

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/')
  }

  const filtered = files.filter(f =>
    tab === 'active' ? !f.is_expired : tab === 'expired' ? f.is_expired : true
  )

  return (
    <Box minH="100vh" bg={BG} display="flex" flexDirection="column">
      {/* Header */}
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

        {/* Desktop actions */}
        <HStack gap={3} display={{ base: 'none', md: 'flex' }}>
          <Button
            size="sm"
            bg="gray.900"
            color="white"
            borderRadius="lg"
            px={5}
            _hover={{ bg: 'gray.700' }}
            onClick={() => navigate('/upload')}
          >
            Ajouter des fichiers
          </Button>
          <Button
            size="sm"
            bg="transparent"
            color={CORAL}
            border="1px solid"
            borderColor={CORAL}
            borderRadius="lg"
            px={4}
            _hover={{ bg: '#fdf2f0' }}
            onClick={handleLogout}
            data-testid="logout-button"
          >
            <HStack gap={1.5}>
              <LogoutIcon />
              <span>Déconnexion</span>
            </HStack>
          </Button>
        </HStack>

        {/* Mobile hamburger */}
        <Box
          cursor="pointer"
          display={{ base: 'block', md: 'none' }}
          onClick={() => setMobileMenuOpen(true)}
          data-testid="hamburger-button"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </Box>
      </Flex>

      <Flex flex="1">
        {/* Sidebar — desktop */}
        <Box
          display={{ base: 'none', md: 'block' }}
          w="200px"
          flexShrink={0}
          p={4}
          style={{ background: SIDEBAR_GRADIENT }}
        >
          <Box
            px={4}
            py={2}
            style={{ background: 'rgba(255,255,255,0.25)' }}
            color="white"
            borderRadius="full"
            fontSize="sm"
            fontWeight="medium"
            textAlign="center"
          >
            Mes fichiers
          </Box>
        </Box>

        {/* Main content */}
        <Box flex="1" p={{ base: 4, md: 8 }}>
          <Text fontSize="2xl" fontWeight="bold" mb={6}>
            Mes fichiers
          </Text>

          {/* Tabs — segmented control */}
          <Box
            display="inline-flex"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="md"
            overflow="hidden"
            mb={6}
          >
            {TABS.map(({ key, label }, i) => (
              <Box
                key={key}
                as="button"
                px={5}
                py={1.5}
                fontSize="sm"
                fontWeight={tab === key ? 'semibold' : 'normal'}
                cursor="pointer"
                bg={tab === key ? CORAL : 'transparent'}
                color={tab === key ? 'white' : 'gray.700'}
                borderLeft={i > 0 ? '1px solid' : 'none'}
                borderColor="gray.200"
                onClick={() => setTab(key)}
                data-testid={`tab-${key}`}
                _hover={{ bg: tab === key ? '#c25a4e' : 'gray.50' }}
                transition="background 0.15s"
              >
                {label}
              </Box>
            ))}
          </Box>

          {/* File list */}
          {loading ? (
            <Text color="gray.400" data-testid="loading">Chargement…</Text>
          ) : filtered.length === 0 ? (
            <Text color="gray.400" data-testid="empty">Aucun fichier.</Text>
          ) : (
            <VStack gap={2} align="stretch">
              {filtered.map(file => (
                <FileRow
                  key={file.id}
                  file={file}
                  onDelete={() => setFiles(prev => prev.filter(f => f.id !== file.id))}
                />
              ))}
            </VStack>
          )}
        </Box>
      </Flex>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <>
          <Box
            position="fixed"
            inset={0}
            bg="blackAlpha.500"
            zIndex={10}
            onClick={() => setMobileMenuOpen(false)}
            data-testid="menu-overlay"
          />
          <Box
            position="fixed"
            top={0}
            left={0}
            bottom={0}
            w="240px"
            zIndex={20}
            p={4}
            style={{ background: SIDEBAR_GRADIENT }}
          >
            <Flex justify="space-between" align="center" mb={6}>
              <Text fontWeight="bold" fontSize="md" color="white">DataShare</Text>
              <Box
                cursor="pointer"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="close-menu-button"
                color="white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Box>
            </Flex>
            <Box
              px={4} py={2}
              style={{ background: 'rgba(255,255,255,0.25)' }}
              color="white"
              borderRadius="full"
              fontSize="sm"
              fontWeight="medium"
              textAlign="center"
              mb={4}
            >
              Mes fichiers
            </Box>
            <Button
              w="full"
              size="sm"
              bg="transparent"
              color="white"
              justifyContent="flex-start"
              onClick={handleLogout}
            >
              <HStack gap={1.5}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Déconnexion</span>
              </HStack>
            </Button>
          </Box>
        </>
      )}

      <Text textAlign="center" color="gray.400" fontSize="xs" py={4}>
        Copyright DataShare® 2025
      </Text>
    </Box>
  )
}

function FileRow({ file, onDelete }: { file: FileRecord; onDelete: () => void }) {
  const navigate = useNavigate()
  const expiry = formatExpiry(file)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    <Box
      bg="white"
      borderRadius="md"
      border="1px solid"
      borderColor="gray.150"
      data-testid="file-row"
    >
      <Flex align="center" px={4} py={3} gap={3}>
        <FileIcon />

        <Box flex="1" minW={0}>
          <Text
            fontSize="sm"
            fontWeight="semibold"
            style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {file.original_name}
          </Text>
          <Text fontSize="xs" color={file.is_expired ? CORAL : 'gray.500'} fontWeight={file.is_expired ? 'semibold' : 'normal'}>
            {expiry}
          </Text>
        </Box>

        {file.password_protected && !file.is_expired && (
          <Box flexShrink={0}>
            <LockIcon />
          </Box>
        )}

        {file.is_expired ? (
          <Text fontSize="sm" color="gray.400" display={{ base: 'none', md: 'block' }}>
            Ce fichier à expiré, il n'est plus stocké chez nous
          </Text>
        ) : (
          <HStack gap={2} flexShrink={0}>
            <Button
              size="xs"
              bg="white"
              color={CORAL}
              border="1px solid"
              borderColor={CORAL}
              borderRadius="md"
              px={3}
              _hover={{ bg: '#fdf2f0' }}
              onClick={() => setConfirmDelete(true)}
              data-testid="delete-button"
            >
              <HStack gap={1}>
                <TrashIcon />
                <span>Supprimer</span>
              </HStack>
            </Button>
            <Button
              size="xs"
              bg="white"
              color={CORAL}
              border="1px solid"
              borderColor={CORAL}
              borderRadius="md"
              px={3}
              _hover={{ bg: '#fdf2f0' }}
              onClick={() => navigate(`/download/${file.token}`)}
              data-testid="access-button"
            >
              <HStack gap={1}>
                <span>Accéder</span>
                <ArrowRightIcon />
              </HStack>
            </Button>
          </HStack>
        )}
      </Flex>

      {confirmDelete && (
        <HStack px={4} pb={3} gap={2} align="center">
          <Text fontSize="sm" color="gray.600" flex="1">
            Confirmer la suppression ?
          </Text>
          <Button
            size="sm"
            bg="white"
            color={CORAL}
            border="1px solid"
            borderColor={CORAL}
            borderRadius="md"
            flexShrink={0}
            _hover={{ bg: '#fdf2f0' }}
            loading={deleting}
            onClick={handleDeleteConfirmed}
            data-testid="confirm-delete-button"
          >
            Supprimer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="gray.500"
            flexShrink={0}
            onClick={() => setConfirmDelete(false)}
            data-testid="cancel-delete-button"
          >
            Annuler
          </Button>
        </HStack>
      )}

    </Box>
  )
}
