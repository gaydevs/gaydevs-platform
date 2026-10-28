import { ApiError, messageForApiError, resolveApiBase } from './auth/api'

export interface PollVoter { id: string; name: string }
export interface PollOption { id: string; label: string; created_at?: string; votes: number; percentage: number; creator?: PollVoter; voters?: PollVoter[]; anonymous_votes?: number }
export interface Poll { id: string; slug: string; question: string; created_at?: string | null; creator: PollVoter; started_at: string | null; started_on: string | null; allow_multiple: boolean; allow_new_options: boolean; closed: boolean; closed_at: string | null; has_votes: boolean; total_votes: number; message: string | null; selected_options?: string[]; options: PollOption[] }
export interface PollSuggestion { id: string; slug: string; question: string; started_at: string | null; started_on: string | null; options_count: number; total_votes: number }
export interface PollSubmissionResponse { poll: Poll; suggested_polls: PollSuggestion[] }
export type PollAuditEventType = 'poll_created' | 'option_added' | 'option_hidden' | 'vote_recorded' | 'vote_canceled' | 'poll_closed'
export interface PollAuditEvent { id: string; type: PollAuditEventType; vote_id?: number; option_id?: string; option_label?: string; actor: PollVoter | null; at: string | null; cancellation_reason?: string | null }
export interface PollAudit { poll: Pick<Poll, 'id' | 'slug' | 'question'> & { creator: PollVoter; created_at: string | null; closed_at: string | null }; events: PollAuditEvent[] }
interface PollResponse { poll: Poll }
export interface PollListResponse { polls: Poll[]; next_cursor: string | null; has_more: boolean; synced_at: string }
interface PollAuditResponse { audit: PollAudit }
interface ErrorResponse { message?: string; errors?: Record<string, string[]> }

const apiBase = resolveApiBase(import.meta.env.BASE_URL)

function xsrfToken(): string | undefined { const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN=')); return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : undefined }
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (init.method && init.method !== 'GET') { const csrf = await fetch(new URL('sanctum/csrf-cookie', apiBase), { credentials: 'include', headers: { Accept: 'application/json' } }); if (!csrf.ok) throw new ApiError('Não foi possível iniciar uma conexão segura.', csrf.status) }
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')
  const token = xsrfToken(); if (token) headers.set('X-XSRF-TOKEN', token)
  const response = await fetch(new URL(path, apiBase), { ...init, credentials: 'include', headers })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ErrorResponse
    throw new ApiError(body.message ?? 'Não foi possível carregar as enquetes.', response.status, undefined, undefined, body.errors)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export interface PollListParams { limit?: number; cursor?: string; since?: string }
export async function listPolls(params: PollListParams = {}): Promise<PollListResponse> {
  const query = new URLSearchParams()
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.cursor) query.set('cursor', params.cursor)
  if (params.since) query.set('since', params.since)
  const suffix = query.toString()
  return request<PollListResponse>(`polls${suffix ? `?${suffix}` : ''}`)
}
export async function getPoll(identifier: string): Promise<Poll> { return (await request<PollResponse>(`polls/${encodeURIComponent(identifier)}`)).poll }
export async function getPollAudit(identifier: string): Promise<PollAudit> { return (await request<PollAuditResponse>(`polls/${encodeURIComponent(identifier)}/audit`)).audit }
export async function createPoll(data: { question: string; options: string[]; allow_multiple: boolean; allow_new_options: boolean }): Promise<Poll> { return (await request<PollResponse>('polls', { method: 'POST', body: JSON.stringify(data) })).poll }
export async function closePoll(identifier: string): Promise<Poll> { return (await request<PollResponse>(`polls/${encodeURIComponent(identifier)}/close`, { method: 'POST' })).poll }
export async function submitPoll(identifier: string, addedOptions: string[], removedOptions: string[]): Promise<PollSubmissionResponse> { return request<PollSubmissionResponse>(`polls/${encodeURIComponent(identifier)}/responses`, { method: 'POST', body: JSON.stringify({ added_options: addedOptions, removed_options: removedOptions }) }) }
export async function addPollOption(identifier: string, label: string): Promise<void> { await request(`polls/${encodeURIComponent(identifier)}/options`, { method: 'POST', body: JSON.stringify({ label }) }) }
export async function hidePollOption(identifier: string, optionId: string): Promise<Poll> { return (await request<PollResponse>(`polls/${encodeURIComponent(identifier)}/options/${encodeURIComponent(optionId)}/hide`, { method: 'POST' })).poll }
export function pollErrorMessage(error: unknown): string { return error instanceof ApiError ? messageForApiError(error) : 'Não foi possível carregar a enquete.' }
