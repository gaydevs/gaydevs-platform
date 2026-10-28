import type { MouseEvent } from 'react'
import { ApiError } from './auth/api'
import type { Poll, PollAuditEvent, PollListResponse } from './pollsApi'

export function pollsBase(): string {
  const marker = '/polls'
  const index = window.location.pathname.indexOf(marker)
  return index >= 0 ? window.location.pathname.slice(0, index) + marker : marker
}

export function followInternalLink(event: MouseEvent<HTMLAnchorElement>, path: string, onNavigate: (path: string) => void): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  onNavigate(path)
}

export function pollElapsedTime(poll: Poll): string {
  return elapsedPollTime(poll.started_at, poll.started_on, 'iniciada')
}

export function pollClosedElapsedTime(poll: Poll): string {
  return elapsedPollTime(poll.closed_at, null, 'encerrada')
}

function elapsedPollTime(timestamp: string | null, dateOnly: string | null, prefix: 'iniciada' | 'encerrada'): string {
  const moment = dateOnly ? new Date(`${dateOnly}T00:00:00Z`) : timestamp ? new Date(timestamp) : null
  if (!moment || Number.isNaN(moment.getTime())) return `${prefix} recentemente`
  const elapsedMs = Math.max(0, Date.now() - moment.getTime())
  const hours = Math.floor(elapsedMs / 3_600_000)
  if (hours < 1) return `${prefix} agora`
  if (hours < 24) return `${prefix} há ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  const days = Math.floor(elapsedMs / 86_400_000)
  if (days < 7) return `${prefix} há ${days} ${days === 1 ? 'dia' : 'dias'}`
  const weeks = Math.floor(days / 7)
  if (days < 30) return `${prefix} há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
  const months = Math.floor(days / 30)
  if (months < 12) return `${prefix} há ${months} ${months === 1 ? 'mês' : 'meses'}`
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (remainingMonths === 0) return `${prefix} há ${years} ${years === 1 ? 'ano' : 'anos'}`
  return `${prefix} há ${years} ${years === 1 ? 'ano' : 'anos'} e ${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'}`
}

export function translatePollCreateApiMessage(message: string, field: string): string {
  if (/[áéíóúãõç]/i.test(message) || /^(a|o|as|os|informe|adicione|escolha|não|nao)\b/i.test(message.trim())) return message
  const normalized = message.toLowerCase()
  const optionMatch = field.match(/^options?[.]([0-9]+)$/)
  const fieldLabel = optionMatch ? `A opção ${Number(optionMatch[1]) + 1}` : field === 'question' ? 'A pergunta' : 'Este campo'
  if (normalized.includes('duplicate value')) return `${fieldLabel} está repetida.`
  if (normalized.includes('required')) return `${fieldLabel} é obrigatória.`
  if (normalized.includes('at least') && normalized.includes('character')) return `${fieldLabel} precisa ter pelo menos 10 caracteres.`
  if (normalized.includes('at least') && normalized.includes('item')) return 'A enquete precisa ter mais de uma opção.'
  if (normalized.includes('format') || normalized.includes('regex')) return 'A pergunta precisa ter pelo menos 2 palavras.'
  if (normalized.includes('string')) return `${fieldLabel} precisa ser um texto.`
  if (normalized.includes('array')) return 'As opções precisam ser informadas em uma lista.'
  if (normalized.includes('maximum') || normalized.includes('max')) return `${fieldLabel} excedeu o limite de caracteres.`
  return optionMatch || field === 'question' ? `Não foi possível validar ${field === 'question' ? 'a pergunta' : 'esta opção'}.` : 'Não foi possível validar os dados da enquete.'
}

export function pollCreateApiFieldErrors(reason: unknown): { fields: Set<string>; messages: Record<string, string>; generalMessage?: string } | null {
  if (!(reason instanceof ApiError)) return null
  const fields = new Set<string>()
  const messages: Record<string, string> = {}
  let generalMessage: string | undefined
  for (const [key, values] of Object.entries(reason.errors ?? {})) {
    const message = values[0]
    if (!message) continue
    if (key === 'question') {
      fields.add('question')
      messages.question = translatePollCreateApiMessage(message, key)
      continue
    }
    const optionMatch = key.match(/^options?[.]([0-9]+)$/)
    if (optionMatch) {
      const field = `option-${optionMatch[1]}`
      fields.add(field)
      messages[field] = translatePollCreateApiMessage(message, key)
      continue
    }
    generalMessage = translatePollCreateApiMessage(message, key)
  }
  return fields.size > 0 || generalMessage ? { fields, messages, generalMessage } : null
}

export const POLL_REFRESH_INTERVAL_MS = 15_000
export const POLL_PAGE_SIZE = 3
export const LOGIN_PROMPT_SHAKE_MS = 420

export function normalizePollList(value: PollListResponse | Poll[]): PollListResponse {
  if (Array.isArray(value)) return { polls: value, next_cursor: null, has_more: false, synced_at: new Date().toISOString() }
  return value
}

export function comparePolls(left: Poll, right: Poll): number {
  if (left.closed !== right.closed) return left.closed ? 1 : -1
  const leftCreatedAt = left.created_at ? Date.parse(left.created_at) : Number.NaN
  const rightCreatedAt = right.created_at ? Date.parse(right.created_at) : Number.NaN
  if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) return rightCreatedAt - leftCreatedAt
  return right.id.localeCompare(left.id)
}

export function mergePolls(current: Poll[], incoming: Poll[]): Poll[] {
  const merged = new Map(current.map((poll) => [poll.id, poll]))
  incoming.forEach((poll) => merged.set(poll.id, poll))
  return [...merged.values()].sort(comparePolls)
}

export interface VoteMutation { optionId: string; changedOptionIds: string[] }

export function togglePollSelection(selection: string[], optionId: string, allowMultiple: boolean): string[] {
  return allowMultiple
    ? (selection.includes(optionId) ? selection.filter((value) => value !== optionId) : [...selection, optionId])
    : (selection.includes(optionId) ? [] : [optionId])
}

export function changedOptionIds(previous: string[], next: string[]): string[] {
  return [...new Set([...previous, ...next])].filter((optionId) => previous.includes(optionId) !== next.includes(optionId))
}

export function selectionDiff(previous: string[], next: string[]): { addedOptions: string[]; removedOptions: string[] } {
  return {
    addedOptions: next.filter((optionId) => !previous.includes(optionId)),
    removedOptions: previous.filter((optionId) => !next.includes(optionId)),
  }
}

export function formatAuditDate(value: string | null): string {
  if (!value) return 'sem data'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function auditCancellationReason(reason: string | null): string {
  return ({
    replaced: 'substituído por outro voto',
    withdrawn: 'voto retirado',
    option_removed: 'opção removida',
    option_hidden: 'opção ocultada',
  } as Record<string, string>)[reason ?? ''] ?? 'voto cancelado'
}

export function auditEventTitle(event: PollAuditEvent): string {
  if (event.type === 'poll_created') return 'Enquete adicionada'
  if (event.type === 'option_added') return `Opção adicionada: ${event.option_label ?? 'Opção removida'}`
  if (event.type === 'option_hidden') return `Opção ocultada: ${event.option_label ?? 'Opção removida'}`
  if (event.type === 'vote_recorded') return `Voto registrado: ${event.option_label ?? 'Opção removida'}`
  if (event.type === 'vote_canceled') return `Voto cancelado: ${event.option_label ?? 'Opção removida'}`
  return 'Enquete encerrada'
}

export function auditEventActor(event: PollAuditEvent): string | null {
  if (event.actor) return `por ${event.actor.name}`
  if (event.type === 'vote_recorded' || event.type === 'vote_canceled') return 'voto sem identificação'
  return null
}
