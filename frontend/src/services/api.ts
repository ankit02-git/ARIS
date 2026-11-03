const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001'

function authHeaders(token: string | null): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(
  path: string,
  options: RequestInit,
  token: string | null,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(token), ...(options.headers ?? {}) },
  })
  const contentType = res.headers.get('content-type')
  const hasBody = res.status !== 204 && contentType && contentType.includes('application/json')
  const data = hasBody ? await res.json() : null
  if (!res.ok) throw new Error((data && data.detail) || `Request failed (${res.status})`)
  return data as T
}

export const api = {
  base: API_BASE,

  get: <T>(path: string, token: string | null) =>
    request<T>(path, { method: 'GET' }, token),

  post: <T>(path: string, body: unknown, token: string | null) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }, token),

  delete: <T>(path: string, token: string | null) =>
    request<T>(path, { method: 'DELETE' }, token),

  upload: async <T>(path: string, formData: FormData, token: string | null): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    const contentType = res.headers.get('content-type')
    const hasBody = res.status !== 204 && contentType && contentType.includes('application/json')
    const data = hasBody ? await res.json() : null
    if (!res.ok) throw new Error((data && data.detail) || 'Upload failed')
    return data as T
  },
}
