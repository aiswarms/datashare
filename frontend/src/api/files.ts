const BASE = '/api'

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
