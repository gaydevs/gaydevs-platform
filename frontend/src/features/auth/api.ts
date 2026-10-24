export interface MaskedUser { id: string; name: string; email: string }
export interface AuthenticatedUser { id: string; name: string }
export interface OtpRequest { otp_request_id: string; expires_at: string }

interface SessionResponse { user: AuthenticatedUser }
interface ErrorResponse { message?: string; reason?: string; reference?: string }

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly reason?: string, public readonly reference?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Converte um erro da API em mensagem segura para exibição ao usuário. */
export function messageForApiError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Não foi possível concluir a solicitação.'
  return error.status >= 500 && error.reference ? `${error.message} Referência: ${error.reference}` : error.message
}

/** Calcula a base da API a partir da base pública do frontend. */
export function resolveApiBase(
  baseUrl: string,
  origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
): URL {
  // A API fica um nível acima da base do frontend: /gaydevs/platform/ -> /gaydevs/api/.
  return new URL('../api/', new URL(baseUrl, origin))
}

const apiBase = resolveApiBase(import.meta.env.BASE_URL)

/** Lê o token CSRF que o Laravel Sanctum colocou no cookie. */
function xsrfToken(): string | undefined {
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : undefined
}

/** Inicializa o cookie CSRF antes de uma requisição que altera estado. */
async function csrf(): Promise<void> {
  // Laravel Sanctum exige o cookie CSRF antes de qualquer POST stateful.
  const response = await fetch(new URL('sanctum/csrf-cookie', apiBase), { credentials: 'include', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new ApiError('Não foi possível iniciar uma conexão segura.', response.status)
}

/** Centraliza headers, cookies, CSRF e conversão de respostas de erro. */
async function request<T>(path: string, init: RequestInit = {}, stateChanging = false): Promise<T> {
  if (stateChanging) await csrf()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  const token = stateChanging ? xsrfToken() : undefined
  if (token) headers.set('X-XSRF-TOKEN', token)
  const response = await fetch(new URL(path, apiBase), { ...init, credentials: 'include', headers })
  if (!response.ok) {
    // A API já filtra a mensagem pública; a referência permite correlacionar o log.
    const error = await response.json().catch((): ErrorResponse => ({})) as ErrorResponse
    throw new ApiError(error.message ?? 'Não foi possível concluir a solicitação.', response.status, error.reason, error.reference)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/** Busca resultados já mascarados para o autocomplete. */
export function searchUsers(query: string, signal?: AbortSignal): Promise<MaskedUser[]> {
  return request<MaskedUser[]>(`users?${new URLSearchParams({ q: query })}`, { signal })
}

/** Solicita ao backend um OTP para o UUID selecionado. */
export function requestOtp(userId: string): Promise<OtpRequest> {
  return request<OtpRequest>('auth/otp', { method: 'POST', body: JSON.stringify({ user_id: userId }) }, true)
}

/** Confirma o código e deixa o backend criar a sessão autenticada. */
export function verifyOtp(otpRequestId: string, code: string): Promise<void> {
  return request<void>('auth/verify', { method: 'POST', body: JSON.stringify({ otp_request_id: otpRequestId, code }) }, true)
}

/** Recupera a sessão atual; 401 significa que a pessoa é visitante. */
export async function currentSession(): Promise<AuthenticatedUser | null> {
  try { return (await request<SessionResponse>('auth/session')).user } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/** Encerra a sessão stateful no backend. */
export function logout(): Promise<void> { return request<void>('auth/logout', { method: 'POST' }, true) }
