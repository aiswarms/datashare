const BASE = '/api'

export interface FileMeta {
  token: string
  original_name: string
  mime_type: string
  size: number
  expires_at: string
  is_expired: boolean
  password_protected: boolean
  download_url: string
}

export async function getFileMeta(token: string) {
  const res = await fetch(`${BASE}/files/${token}`)
  return { ok: res.ok, status: res.status, data: await res.json() as FileMeta }
}

export interface FileRecord {
  id: number
  token: string
  original_name: string
  mime_type: string
  size: number
  expires_at: string
  uploaded_at: string
  is_expired: boolean
  password_protected: boolean
  download_url: string
  tags: string[]
}

export async function getFiles(tag?: string) {
  const token = localStorage.getItem('token')
  const url = tag ? `${BASE}/files?tag=${encodeURIComponent(tag)}` : `${BASE}/files`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  return { ok: res.ok, status: res.status, data: await res.json() as { data: FileRecord[] } }
}

export async function deleteFile(id: number) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE}/files/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token ?? ''}` },
  })
  return { ok: res.ok, status: res.status }
}

export async function uploadFile(file: File, expiresInDays: number, password?: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('expires_in_days', String(expiresInDays))
  if (password) form.append('password', password)

  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token ?? ''}` },
    body: form,
  })
  return { ok: res.ok, status: res.status, data: await res.json() }
}

export async function uploadAnonymous(file: File, expiresInDays: number, password?: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('expires_in_days', String(expiresInDays))
  if (password) form.append('password', password)

  const res = await fetch(`${BASE}/files`, { method: 'POST', body: form })
  return { ok: res.ok, status: res.status, data: await res.json() }
}
