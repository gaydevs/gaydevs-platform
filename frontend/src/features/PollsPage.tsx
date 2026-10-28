import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { LinkifiedText } from '../components/LinkifiedText'
import { ModalHeader } from '../components/ModalHeader'
import { OverflowMenu } from '../components/OverflowMenu'
import { PollsBrand } from '../components/PollsBrand'
import { SectionSubmenuBar } from '../components/SectionSubmenuBar'
import { useSectionBrandVisibility } from '../components/useSectionBrandVisibility'
import { FieldActionButton } from '../components/FieldActionButton'
import { FieldControl } from '../components/FieldControl'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PollSuggestionsDialog, PollSuggestionsToast } from './PollSuggestions'
import { PollCard } from './PollCard'
import { ApiError, type AuthenticatedUser } from './auth/api'
import { dismissPollSuggestion, snoozePollSuggestions } from './userPreferencesApi'
import { addPollOption, closePoll, createPoll, getPoll, getPollAudit, hidePollOption, listPolls, pollErrorMessage, submitPoll, type Poll, type PollAudit, type PollAuditEvent, type PollListResponse, type PollOption, type PollSuggestion } from './pollsApi'
import { animatePollCardReorder, animatePollOptionReorder, elapsedPollTime, pollWithSelection, pollVoterSummary, voteLabel } from './pollPresentation'

export { PollCard } from './PollCard'

interface Props { identifier: string | null; user: AuthenticatedUser | null; onLogin: () => void; onNavigate: (path: string) => void; onAudit?: (poll: Poll) => void; onError?: (message: string) => void; onBrandVisibilityChange?: (visible: boolean) => void; create?: boolean; sessionRestoring?: boolean }
function pollsBase(): string { const marker = '/polls'; const index = window.location.pathname.indexOf(marker); return index >= 0 ? window.location.pathname.slice(0, index) + marker : marker }
function followInternalLink(event: MouseEvent<HTMLAnchorElement>, path: string, onNavigate: (path: string) => void) { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onNavigate(path) }
function pollElapsedTime(poll: Poll): string {
  return elapsedPollTime(poll.started_at, poll.started_on, 'iniciada')
}

function pollClosedElapsedTime(poll: Poll): string {
  return elapsedPollTime(poll.closed_at, null, 'encerrada')
}

function translatePollCreateApiMessage(message: string, field: string): string {
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

function pollCreateApiFieldErrors(reason: unknown): { fields: Set<string>; messages: Record<string, string>; generalMessage?: string } | null {
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

const POLL_REFRESH_INTERVAL_MS = 15_000
const POLL_PAGE_SIZE = 3
const LOGIN_PROMPT_SHAKE_MS = 420

function normalizePollList(value: PollListResponse | Poll[]): PollListResponse {
  if (Array.isArray(value)) {
    return { polls: value, next_cursor: null, has_more: false, synced_at: new Date().toISOString() }
  }
  return value
}

function comparePolls(left: Poll, right: Poll): number {
  if (left.closed !== right.closed) return left.closed ? 1 : -1
  const leftCreatedAt = left.created_at ? Date.parse(left.created_at) : Number.NaN
  const rightCreatedAt = right.created_at ? Date.parse(right.created_at) : Number.NaN
  if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) return rightCreatedAt - leftCreatedAt
  return right.id.localeCompare(left.id)
}

function mergePolls(current: Poll[], incoming: Poll[]): Poll[] {
  const merged = new Map(current.map((poll) => [poll.id, poll]))
  incoming.forEach((poll) => merged.set(poll.id, poll))
  return [...merged.values()].sort(comparePolls)
}

interface VoteMutation { optionId: string; changedOptionIds: string[] }

function togglePollSelection(selection: string[], optionId: string, allowMultiple: boolean): string[] {
  return allowMultiple
    ? (selection.includes(optionId) ? selection.filter((value) => value !== optionId) : [...selection, optionId])
    : (selection.includes(optionId) ? [] : [optionId])
}

function changedOptionIds(previous: string[], next: string[]): string[] {
  return [...new Set([...previous, ...next])].filter((optionId) => previous.includes(optionId) !== next.includes(optionId))
}

function selectionDiff(previous: string[], next: string[]): { addedOptions: string[]; removedOptions: string[] } {
  return {
    addedOptions: next.filter((optionId) => !previous.includes(optionId)),
    removedOptions: previous.filter((optionId) => !next.includes(optionId)),
  }
}

function formatAuditDate(value: string | null): string {
  if (!value) return 'sem data'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function auditCancellationReason(reason: string | null): string {
  return ({
    replaced: 'substituído por outro voto',
    withdrawn: 'voto retirado',
    option_removed: 'opção removida',
    option_hidden: 'opção ocultada',
  } as Record<string, string>)[reason ?? ''] ?? 'voto cancelado'
}

function auditEventTitle(event: PollAuditEvent): string {
  if (event.type === 'poll_created') return 'Enquete adicionada'
  if (event.type === 'option_added') return `Opção adicionada: ${event.option_label ?? 'Opção removida'}`
  if (event.type === 'option_hidden') return `Opção ocultada: ${event.option_label ?? 'Opção removida'}`
  if (event.type === 'vote_recorded') return `Voto registrado: ${event.option_label ?? 'Opção removida'}`
  if (event.type === 'vote_canceled') return `Voto cancelado: ${event.option_label ?? 'Opção removida'}`
  return 'Enquete encerrada'
}

function auditEventActor(event: PollAuditEvent): string | null {
  if (event.actor) return `por ${event.actor.name}`
  if (event.type === 'vote_recorded' || event.type === 'vote_canceled') return 'voto sem identificação'
  return null
}

export function PollLoading() {
  return <section className="polls-page container poll-loading" aria-busy="true" aria-live="polite">
    <div className="section-heading" aria-hidden="true"><h1 className="polls-hero-title"><PollsBrand className="polls-hero-brand" linked={false} /></h1></div>
    <div className="poll-list" aria-hidden="true">{[0, 1, 2].map((index) => <div className="poll-card poll-loading-card" key={index}><span className="poll-loading__status poll-loading__shine" /><span className="poll-loading__card-title poll-loading__shine" /><span className="poll-loading__card-date poll-loading__shine" /><span className="poll-loading__card-meta poll-loading__shine" /></div>)}</div>
    <span className="sr-only">Carregando enquete…</span>
  </section>
}

function PollListBatchLoading() {
  return <div className="poll-list poll-list--batch-loading" aria-hidden="true">{[0, 1, 2].map((index) => <div className="poll-card poll-loading-card" key={index}><span className="poll-loading__status poll-loading__shine" /><span className="poll-loading__card-title poll-loading__shine" /><span className="poll-loading__card-date poll-loading__shine" /><span className="poll-loading__card-meta poll-loading__shine" /></div>)}</div>
}

export function PollDetailLoading() {
  return <section className="polls-page container poll-detail-loading" aria-busy="true" aria-live="polite">
    <div className="section-heading" aria-hidden="true">
      <span className="poll-loading__eyebrow poll-loading__shine" />
      <span className="poll-loading__detail-title poll-loading__shine" />
      <div className="poll-loading__tags">
        <span className="poll-loading__tag poll-loading__shine" />
        <span className="poll-loading__tag poll-loading__shine" />
        <span className="poll-loading__tag poll-loading__shine" />
      </div>
      <span className="poll-loading__detail-date poll-loading__shine" />
    </div>
    <div className="poll-options" aria-hidden="true">{[0, 1, 2, 3].map((index) => <div className="poll-option poll-loading-option" key={index}>
      <span className="poll-loading__option-check poll-loading__shine" />
      <span className="poll-loading__option-content"><span className="poll-loading__option-title poll-loading__shine" /><span className="poll-loading__option-meta poll-loading__shine" /></span>
      <span className="poll-loading__option-meter"><span className="poll-loading__shine" /></span>
    </div>)}</div>
    <span className="sr-only">Carregando enquete…</span>
  </section>
}

function PollsLandingPreview({ polls, showCreate }: { polls: Poll[]; showCreate: boolean }) {
  const base = pollsBase()
  return <section className="polls-page polls-page--landing container poll-route-transition__outgoing" aria-hidden="true">
    <div className="section-heading polls-landing-heading"><h1 className="polls-hero-title"><PollsBrand className="polls-hero-brand" linked={false} /></h1>{showCreate && <span className="poll-create-button" aria-hidden="true">+</span>}</div>
    {polls.length > 0 && <div className="poll-list">{polls.map((item) => <PollCard item={item} path={`${base}/${item.slug}`} onNavigate={() => undefined} key={item.id} />)}</div>}
  </section>
}

export function PollsPage({ identifier, user, onLogin, onNavigate, onAudit, onError, onBrandVisibilityChange, create = false, sessionRestoring = false }: Props) {
  const [polls, setPolls] = useState<Poll[]>([]); const [poll, setPoll] = useState<Poll | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const [listPage, setListPage] = useState({ next_cursor: null as string | null, has_more: false }); const [loadingMore, setLoadingMore] = useState(false); const [listLoadError, setListLoadError] = useState('')
  const brandIcon = useRef<HTMLImageElement>(null)
  const hasDisplayedLanding = useRef(false)
  const hasPromptedLandingLogin = useRef(false)
  const userRequestKey = identifier ? user?.id ?? '' : ''
  const requestKey = `${identifier ?? 'list'}:${userRequestKey}`
  const waitingForSession = Boolean(!create && sessionRestoring)
  const unauthenticatedLanding = !identifier && !create && !sessionRestoring && !user
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null)
  const [transitioningToDetail, setTransitioningToDetail] = useState(false)
  const pollCardNodes = useRef(new Map<string, HTMLElement>())
  const pollCardPositionsBeforeUpdate = useRef<Map<string, DOMRect> | null>(null)
  const pollListSentinel = useRef<HTMLDivElement | null>(null)
  const listPageRef = useRef(listPage)
  const listSyncAt = useRef<string | null>(null)
  const listVersion = useRef(0)
  const loadingMoreRef = useRef(false)
  const listRefreshInFlight = useRef(false)
  const capturePollCardPositions = useCallback(() => {
    pollCardPositionsBeforeUpdate.current = new Map([...pollCardNodes.current.entries()].map(([id, node]) => [id, node.getBoundingClientRect()]))
  }, [])
  useLayoutEffect(() => {
    const previousPositions = pollCardPositionsBeforeUpdate.current
    pollCardPositionsBeforeUpdate.current = null
    animatePollCardReorder(previousPositions, pollCardNodes.current)
  }, [polls])
  useEffect(() => {
    if (!identifier || !hasDisplayedLanding.current) return
    setTransitioningToDetail(true)
    const timeout = window.setTimeout(() => setTransitioningToDetail(false), 280)
    return () => window.clearTimeout(timeout)
  }, [identifier])

  const loadMorePolls = useCallback(async () => {
    const page = listPageRef.current
    if (identifier || create || !page.has_more || !page.next_cursor || loadingMoreRef.current) return
    const version = listVersion.current
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const latest = normalizePollList(await listPolls({ limit: POLL_PAGE_SIZE, cursor: page.next_cursor }))
      if (version !== listVersion.current) return
      capturePollCardPositions()
      setPolls((current) => mergePolls(current, latest.polls))
      listPageRef.current = { next_cursor: latest.next_cursor, has_more: latest.has_more }
      setListPage(listPageRef.current)
      setListLoadError('')
    } catch (reason) {
      if (version === listVersion.current) setListLoadError(pollErrorMessage(reason))
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [capturePollCardPositions, create, identifier])

  useEffect(() => {
    let active = true
    if (create || waitingForSession || unauthenticatedLanding) return () => { active = false }
    const version = ++listVersion.current
    if (!identifier) {
      listSyncAt.current = null
    }
    const load = identifier ? getPoll(identifier) : listPolls({ limit: POLL_PAGE_SIZE })
    Promise.resolve(load).then((value) => {
      if (!active || version !== listVersion.current) return
      setError('')
      setListLoadError('')
      if (Array.isArray(value)) {
        setPolls(value)
        listPageRef.current = { next_cursor: null, has_more: false }
        setListPage(listPageRef.current)
        listSyncAt.current = new Date().toISOString()
      } else if (identifier) {
        setPoll(value as Poll)
      } else {
        const page = normalizePollList(value as PollListResponse | Poll[])
        setPolls(page.polls)
        listPageRef.current = { next_cursor: page.next_cursor, has_more: page.has_more }
        setListPage(listPageRef.current)
        listSyncAt.current = page.synced_at
      }
    }).catch((reason) => { if (active && version === listVersion.current) setError(pollErrorMessage(reason)) }).finally(() => { if (active && version === listVersion.current) { setLoading(false); setLoadedRequestKey(requestKey) } })
    return () => { active = false }
  }, [identifier, create, requestKey, unauthenticatedLanding, waitingForSession])
  const routeLoading = waitingForSession || loading || loadedRequestKey !== requestKey

  useEffect(() => {
    if (identifier || create || waitingForSession || routeLoading || !listPage.has_more) return
    const sentinel = pollListSentinel.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMorePolls()
    }, { rootMargin: '480px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [create, identifier, listPage.has_more, loadMorePolls, loadingMore, routeLoading, waitingForSession])

  useEffect(() => {
    if (identifier || create || waitingForSession || routeLoading) return
    let active = true
    const refresh = () => {
      const since = listSyncAt.current
      if (!active || !since || document.visibilityState === 'hidden' || listRefreshInFlight.current) return
      listRefreshInFlight.current = true
      void listPolls({ since }).then((response) => {
        if (!active) return
        const latest = normalizePollList(response)
        if (latest.polls.length > 0) {
          capturePollCardPositions()
          setError('')
          setPolls((current) => mergePolls(current, latest.polls))
        }
        listSyncAt.current = latest.synced_at
      }).catch(() => undefined).finally(() => { listRefreshInFlight.current = false })
    }
    const interval = window.setInterval(refresh, POLL_REFRESH_INTERVAL_MS)
    return () => { active = false; window.clearInterval(interval) }
  }, [capturePollCardPositions, create, identifier, routeLoading, waitingForSession])
  useEffect(() => {
    if (!identifier && !routeLoading && !error) hasDisplayedLanding.current = true
  }, [identifier, routeLoading, error])
  useEffect(() => {
    if (identifier || create) {
      hasPromptedLandingLogin.current = false
      return
    }
    if (sessionRestoring) return
    if (user) {
      hasPromptedLandingLogin.current = false
      return
    }
    if (hasPromptedLandingLogin.current) return
    hasPromptedLandingLogin.current = true
    onLogin()
  }, [create, identifier, onLogin, sessionRestoring, user])
  useSectionBrandVisibility({
    brandRef: brandIcon,
    enabled: !identifier && !create && !loading && !routeLoading,
    onVisibilityChange: onBrandVisibilityChange,
  })
  if (create) return <PollCreate user={user} onNavigate={onNavigate} />
  if (unauthenticatedLanding) return <PollLoading />
  if (routeLoading) {
    if (identifier) return <div className="poll-route-transition">{transitioningToDetail && <PollsLandingPreview polls={polls} showCreate={user?.member_type === 'admin'} />}<PollDetailLoading /></div>
    return <PollLoading />
  }
  if (error) return <section className="polls-page container"><p className="poll-error">{error}</p></section>
  if (identifier && poll?.slug === identifier) return <PollDetail poll={poll} user={user} onLogin={onLogin} onAudit={() => onAudit?.(poll)} onError={onError} onNavigate={onNavigate} onUpdated={setPoll} />
  const base = pollsBase()
  const canCreate = user?.member_type === 'admin'
  return <section className="polls-page polls-page--landing container" aria-labelledby="polls-title">
    <div className="section-heading polls-landing-heading"><h1 className="polls-hero-title" id="polls-title"><PollsBrand className="polls-hero-brand" linked={false} iconRef={brandIcon} /></h1>{canCreate && <button className="poll-create-button" type="button" aria-label="Nova enquete" title="Nova enquete" onClick={() => onNavigate(`${base}/new`)}>+</button>}</div>
    {polls.length === 0 ? <p className="poll-empty">Ainda não há enquetes.</p> : <>
      <div className="poll-list">{polls.map((item) => <PollCard item={item} path={`${base}/${item.slug}`} onNavigate={onNavigate} cardRef={(node) => { if (node) pollCardNodes.current.set(item.id, node); else pollCardNodes.current.delete(item.id) }} key={item.id} />)}</div>
      {listPage.has_more && <div className="poll-list-loader" ref={pollListSentinel} aria-busy={loadingMore}>
        {loadingMore && <PollListBatchLoading />}
        {listLoadError && <p className="poll-error poll-list-loader__error" role="alert">{listLoadError}</p>}
      </div>}
    </>}
  </section>
}

export function PollsSectionBar({ visible, path, onNavigate }: { visible: boolean; path: string; onNavigate: (path: string) => void }) {
  return <SectionSubmenuBar visible={visible} className="polls-section-bar"><PollsBrand href={path} onClick={(event) => followInternalLink(event, path, onNavigate)} /></SectionSubmenuBar>
}

function PollAuditLoading() {
  return <div className="poll-audit-list poll-audit-loading" role="status" aria-busy="true" aria-label="Carregando auditoria">
    {[0, 1, 2, 3].map((index) => <div className="poll-audit-entry poll-audit-loading__entry" key={index} aria-hidden="true">
      <span className="poll-audit-loading__title poll-loading__shine" />
      <span className="poll-audit-loading__actor poll-loading__shine" />
      <span className="poll-audit-loading__date poll-loading__shine" />
    </div>)}
  </div>
}

export function PollErrorDialog({ message, onClose }: { message: string; onClose: () => void }) {
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const closeDialog = useCallback(() => {
    if (closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 220)
  }, [closing, onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDialog() }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [closeDialog])

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeDialog()
  }

  return <div className={`login-overlay${closing ? ' login-overlay--closing' : ''}`} role="presentation" onMouseDown={closeFromBackdrop}>
    <section className={`login-dialog poll-error-dialog${closing ? ' login-dialog--closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="poll-error-title">
      <ModalHeader closeLabel="fechar erro" onClose={closeDialog}>
        <PollsBrand wordmark="/gdevs/polls/error" linked={false} />
      </ModalHeader>
      <div className="poll-error-dialog__body">
        <p className="login-dialog__eyebrow">ERRO NA ENQUETE</p>
        <h2 id="poll-error-title">Não foi possível atualizar seu voto</h2>
        <p className="login-error" role="alert">{message}</p>
        <button className="action-link poll-error-dialog__action" type="button" onClick={closeDialog}>Entendi</button>
      </div>
    </section>
  </div>
}

export function PollCloseDialog({ poll, onClose, onClosed }: { poll: Poll; onClose: () => void; onClosed: (poll: Poll) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const closeDialog = useCallback((force = false) => {
    if (closing || (busy && !force)) return
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 220)
  }, [busy, closing, onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDialog() }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [closeDialog])

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeDialog()
  }

  const confirmClose = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const updatedPoll = await closePoll(poll.slug)
      onClosed(updatedPoll)
      closeDialog(true)
    } catch (reason) {
      setError(pollErrorMessage(reason))
      setBusy(false)
    }
  }

  return <div className={`login-overlay${closing ? ' login-overlay--closing' : ''}`} role="presentation" onMouseDown={closeFromBackdrop}>
    <section className={`login-dialog poll-close-dialog${closing ? ' login-dialog--closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="poll-close-title">
      <ModalHeader closeLabel="fechar confirmação" onClose={() => closeDialog()}>
        <PollsBrand wordmark="/gdevs/polls/close" linked={false} />
      </ModalHeader>
      <div className="poll-close-dialog__body">
        <p className="login-dialog__eyebrow">ENCERRAR</p>
        <h2 id="poll-close-title">Encerrar esta enquete?</h2>
        <p className="poll-close-dialog__question">{poll.question}</p>
        <p className="poll-close-dialog__description">Depois de encerrada, não será possível votar ou adicionar novas opções.</p>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="poll-close-dialog__actions">
          <button className="action-link action-link--secondary" type="button" disabled={busy} onClick={() => closeDialog()}>Cancelar</button>
          <button className="action-link poll-close-dialog__confirm" type="button" disabled={busy} aria-busy={busy} onClick={() => void confirmClose()}><span>Encerrar</span>{busy && <LoadingSpinner />}</button>
        </div>
      </div>
    </section>
  </div>
}

export function PollHideOptionDialog({ poll, option, onClose, onHidden }: { poll: Poll; option: PollOption; onClose: () => void; onHidden: (poll: Poll) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const closeDialog = useCallback((force = false) => {
    if (closing || (busy && !force)) return
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 220)
  }, [busy, closing, onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDialog() }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [closeDialog])

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeDialog()
  }

  const confirmHide = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const updatedPoll = await hidePollOption(poll.slug, option.id)
      onHidden(updatedPoll)
      closeDialog(true)
    } catch (reason) {
      setError(pollErrorMessage(reason))
      setBusy(false)
    }
  }

  return <div className={`login-overlay${closing ? ' login-overlay--closing' : ''}`} role="presentation" onMouseDown={closeFromBackdrop}>
    <section className={`login-dialog poll-close-dialog${closing ? ' login-dialog--closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="poll-hide-option-title">
      <ModalHeader closeLabel="fechar confirmação" onClose={() => closeDialog()}>
        <PollsBrand wordmark="/gdevs/polls/hide-option" linked={false} />
      </ModalHeader>
      <div className="poll-close-dialog__body">
        <p className="login-dialog__eyebrow">OCULTAR</p>
        <h2 id="poll-hide-option-title">Ocultar esta opção?</h2>
        <p className="poll-close-dialog__question">{option.label}</p>
        <p className="poll-close-dialog__description">Os votos serão cancelados, mas continuarão registrados na auditoria.</p>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="poll-close-dialog__actions">
          <button className="action-link action-link--secondary" type="button" disabled={busy} onClick={() => closeDialog()}>Cancelar</button>
          <button className="action-link poll-close-dialog__confirm" type="button" disabled={busy} aria-busy={busy} onClick={() => void confirmHide()}><span>ocultar</span>{busy && <LoadingSpinner />}</button>
        </div>
      </div>
    </section>
  </div>
}

export function PollAuditDialog({ poll, onClose }: { poll: Poll; onClose: () => void }) {
  const [audit, setAudit] = useState<PollAudit | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [auditFilter, setAuditFilter] = useState('all')
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const closeDialog = useCallback(() => {
    if (closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 220)
  }, [closing, onClose])

  useEffect(() => {
    let active = true
    void getPollAudit(poll.slug).then((value) => {
      if (active) setAudit(value)
    }).catch((reason) => {
      if (active) setError(pollErrorMessage(reason))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [poll.slug])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDialog() }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [closeDialog])

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeDialog()
  }

  const auditOptions = useMemo(() => {
    const options = new Map<string, string>()
    audit?.events.forEach((event) => {
      if ((event.type === 'vote_recorded' || event.type === 'vote_canceled') && event.option_id) {
        options.set(event.option_id, event.option_label ?? 'Opção removida')
      }
    })
    return [...options.entries()]
  }, [audit])
  const auditUsers = useMemo(() => {
    const users = new Map<string, string>()
    audit?.events.forEach((event) => {
      if (event.actor) users.set(event.actor.id, event.actor.name)
    })
    return [...users.entries()]
  }, [audit])
  const filteredAuditEvents = useMemo(() => {
    if (!audit || auditFilter === 'all') return audit?.events ?? []
    if (auditFilter.startsWith('option:')) {
      const optionId = auditFilter.slice('option:'.length)
      return audit.events.filter((event) => (event.type === 'vote_recorded' || event.type === 'vote_canceled') && event.option_id === optionId)
    }
    const userId = auditFilter.slice('user:'.length)
    return audit.events.filter((event) => event.actor?.id === userId)
  }, [audit, auditFilter])

  return <div className={`login-overlay${closing ? ' login-overlay--closing' : ''}`} role="presentation" onMouseDown={closeFromBackdrop}>
    <section className={`login-dialog poll-audit-dialog${closing ? ' login-dialog--closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="poll-audit-title">
      <ModalHeader closeLabel="fechar auditoria" onClose={closeDialog}>
        <PollsBrand wordmark="/gdevs/polls/audit" linked={false} />
      </ModalHeader>
      <div className="poll-audit-dialog__body">
        <p className="login-dialog__eyebrow">AUDITORIA DA ENQUETE</p>
        <h2 id="poll-audit-title">{poll.question}</h2>
        <p className="poll-audit-dialog__description">Registro completo dos votos, alterações e cancelamentos.</p>
        {loading && <PollAuditLoading />}
        {error && <p className="login-error" role="alert">{error}</p>}
        {audit && audit.events.length === 0 && <p className="poll-audit-dialog__state">Ainda não há registros de auditoria.</p>}
        {audit && audit.events.length > 0 && <>
          <label className="poll-audit-filter">
            <select aria-label="filtrar auditoria" value={auditFilter} onChange={(event) => setAuditFilter(event.target.value)}>
              <option value="all">Todos os eventos</option>
              {auditOptions.length > 0 && <optgroup label="Por opção de voto">{auditOptions.map(([id, label]) => <option value={`option:${id}`} key={id}>{label}</option>)}</optgroup>}
              {auditUsers.length > 0 && <optgroup label="Por gdev">{auditUsers.map(([id, name]) => <option value={`user:${id}`} key={id}>{name}</option>)}</optgroup>}
            </select>
          </label>
          {filteredAuditEvents.length === 0
            ? <p className="poll-audit-dialog__state">Nenhum evento corresponde a esse filtro.</p>
            : <ol className="poll-audit-list">{filteredAuditEvents.map((event) => <li className={`poll-audit-entry poll-audit-entry--${event.type}`} key={event.id}>
              <div className="poll-audit-entry__heading"><strong>{auditEventTitle(event)}</strong>{auditEventActor(event) && <span>{auditEventActor(event)}</span>}</div>
              <small>{event.type === 'poll_created' ? 'adicionada' : event.type === 'option_added' ? 'adicionada em' : event.type === 'option_hidden' ? 'ocultada em' : event.type === 'poll_closed' ? 'encerrada em' : event.type === 'vote_canceled' ? 'cancelado em' : 'registrado em'} {formatAuditDate(event.at)}</small>
              {event.type === 'vote_canceled' && <small className="poll-audit-entry__canceled">motivo: {auditCancellationReason(event.cancellation_reason ?? null)}</small>}
            </li>)}</ol>}
        </>}
      </div>
    </section>
  </div>
}

function PollCreate({ user, onNavigate }: { user: AuthenticatedUser | null; onNavigate: (path: string) => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [multiple, setMultiple] = useState(false)
  const [allowNewOptions, setAllowNewOptions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newOptionIndex, setNewOptionIndex] = useState<number | null>(null)
  const [addingOption, setAddingOption] = useState(false)
  const [validationErrorFields, setValidationErrorFields] = useState<Set<string>>(new Set())
  const [validationErrorMessages, setValidationErrorMessages] = useState<Record<string, string>>({})
  if (user?.member_type !== 'admin') return <section className="polls-page container"><p className="poll-error">Apenas admins podem criar enquetes.</p></section>
  const updateOption = (index: number, value: string) => setOptions((current) => current.map((option, currentIndex) => currentIndex === index ? value : option))
  const updateAllowNewOptions = (enabled: boolean) => {
    setAllowNewOptions(enabled)
    if (!enabled) setOptions((current) => current.length >= 2 ? current : [...current, ''])
  }
  const addOption = () => {
    if (busy) return
    setNewOptionIndex(options.length)
    setAddingOption(true)
    setOptions((current) => [...current, ''])
  }
  const clearValidationError = (field: string) => {
    setValidationErrorFields((current) => {
      if (!current.has(field)) return current
      const next = new Set(current)
      next.delete(field)
      return next
    })
    setValidationErrorMessages((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setError('')
  }
  const clearValidationPopups = () => {
    setValidationErrorFields(new Set())
    setValidationErrorMessages({})
    setError('')
  }
  const submit = async () => {
    setValidationErrorFields(new Set())
    setValidationErrorMessages({})
    setBusy(true); setError('')
    try { const poll = await createPoll({ question, options, allow_multiple: multiple, allow_new_options: allowNewOptions }); onNavigate(`${pollsBase()}/${poll.slug}`) } catch (reason) { const fieldErrors = pollCreateApiFieldErrors(reason); if (fieldErrors) { setValidationErrorFields(fieldErrors.fields); setValidationErrorMessages(fieldErrors.messages); setError(fieldErrors.generalMessage ?? '') } else setError(pollErrorMessage(reason)) } finally { setBusy(false) }
  }

  return <section className="polls-page container" aria-labelledby="new-poll-title" onPointerDownCapture={clearValidationPopups}>
    <h1 id="new-poll-title" className="poll-create-title">Nova enquete</h1>
    <div className={`poll-form${busy ? ' poll-form--busy' : ''}`} aria-busy={busy}>
      <FieldControl shellClassName={`poll-form__question${validationErrorFields.has('question') ? ' poll-form__field--invalid' : ''}`} error={validationErrorMessages.question} aria-label="Pergunta" placeholder="Pergunta" value={question} disabled={busy} onChange={(event) => { setQuestion(event.target.value); clearValidationError('question') }} />
      <div className="poll-form__options">
        {options.map((option, index) => {
          const removable = index > 0 && (allowNewOptions || index > 1)
          return <FieldControl shellClassName={`poll-form__option-row${removable ? ' poll-form__option-row--removable' : ''}${newOptionIndex === index ? ' poll-form__option-row--new' : ''}${validationErrorFields.has(`option-${index}`) ? ' poll-form__field--invalid' : ''}`} error={validationErrorMessages[`option-${index}`]} aria-label={`Opção ${index + 1}`} value={option} disabled={busy} placeholder={`Opção ${index + 1}`} onChange={(event) => { updateOption(index, event.target.value); clearValidationError(`option-${index}`) }} after={removable ? <FieldActionButton variant="remove" aria-label={`Remover opção ${index + 1}`} title={`Remover opção ${index + 1}`} disabled={busy} onClick={() => setOptions((current) => current.filter((_, currentIndex) => currentIndex !== index))} /> : undefined} key={index} />
        })}
        <button type="button" className={`action-link action-link--secondary poll-form__add-option${addingOption ? ' poll-form__add-option--moving' : ''}`} disabled={busy} onAnimationEnd={() => setAddingOption(false)} onClick={addOption}>Adicionar opção</button>
      </div>
      <label className="poll-switch"><input type="checkbox" checked={multiple} disabled={busy} onChange={(event) => setMultiple(event.target.checked)} /><span className="poll-switch__track" aria-hidden="true" /><span>Permitir selecionar múltiplas opções</span></label>
      <label className="poll-switch"><input type="checkbox" checked={allowNewOptions} disabled={busy} onChange={(event) => updateAllowNewOptions(event.target.checked)} /><span className="poll-switch__track" aria-hidden="true" /><span>Permitir adicionar novas opções depois</span></label>
      <div className="poll-form__submit-area">
        {error && <p className="poll-form__error" role="alert">{error}</p>}
        <button className={`action-link poll-submit-button${busy ? ' poll-submit-button--busy' : ''}`} type="button" aria-busy={busy} disabled={busy} onClick={() => void submit()}><span className="poll-submit-button__label">Criar enquete</span>{busy && <LoadingSpinner className="poll-submit-button__spinner" />}</button>
      </div>
    </div>
  </section>
}

function PollOptionAdminMenu({ option, onHide }: { option: PollOption; onHide: () => void }) {
  return <OverflowMenu label={`Ações da opção ${option.label}`} className="poll-option-admin-menu">
    {(close) => <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); close(); onHide() }}>ocultar</button>}
  </OverflowMenu>
}

function PollOptionCard({ poll, option, barWidth, isNewOption, needsLogin, votePending, voteError, isSelected, optionRef, onToggle, onAnimationEnd, onHide }: { poll: Poll; option: PollOption; barWidth: number; isNewOption: boolean; needsLogin: boolean; votePending: boolean; voteError: boolean; isSelected: boolean; optionRef: (node: HTMLLabelElement | null) => void; onToggle: () => void; onAnimationEnd: () => void; onHide?: () => void }) {
  return <div className="poll-option-shell">
    <label className={`poll-option${isNewOption ? ' poll-option--new' : ''}${needsLogin ? ' poll-option--login-required' : ''}${votePending ? ' poll-option--vote-pending' : ''}${voteError ? ' poll-option--vote-error' : ''}`} ref={optionRef} aria-busy={votePending || undefined} onAnimationEnd={onAnimationEnd}><input type={poll.allow_multiple ? 'checkbox' : 'radio'} name="poll-option" checked={isSelected} disabled={poll.closed} onClick={(event) => { if (!poll.allow_multiple && isSelected) { event.preventDefault(); onToggle() } }} onChange={onToggle} /><span className="poll-option__content"><strong><LinkifiedText text={option.label} stopPropagation /></strong>{option.creator && <em> adicionada por {option.creator.name}</em>}<small>{option.percentage.toFixed(2)}% · {voteLabel(option.votes)}{option.voters ? pollVoterSummary(option) : ''}{option.anonymous_votes ? ` · ${option.anonymous_votes} voto(s) sem identificação` : ''}</small></span><span className="poll-option__meter" aria-hidden="true"><span style={{ width: `${barWidth}%` }} /></span>{votePending && <span className="poll-option__pending" role="status" aria-label="Salvando voto" />}</label>
    {onHide && <PollOptionAdminMenu option={option} onHide={onHide} />}
  </div>
}

export function PollDetail({ poll, user, onLogin, onAudit, onError, onNavigate = () => undefined, onUpdated }: { poll: Poll; user: AuthenticatedUser | null; onLogin: () => void; onAudit?: () => void; onError?: (message: string) => void; onNavigate?: (path: string) => void; onUpdated: (poll: Poll) => void }) {
  const [optionLabel, setOptionLabel] = useState('')
  const [pendingSelection, setPendingSelection] = useState<string[] | null>(null)
  const [addOptionBusy, setAddOptionBusy] = useState(false)
  const [votePendingOptionIds, setVotePendingOptionIds] = useState<Set<string>>(new Set())
  const [voteErrorOptionIds, setVoteErrorOptionIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [addOptionFailed, setAddOptionFailed] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [optionToHide, setOptionToHide] = useState<PollOption | null>(null)
  const [revealingOptionId, setRevealingOptionId] = useState<string | null>(null)
  const [loginPromptOptionId, setLoginPromptOptionId] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<PollSuggestion[]>([])
  const [suggestionsDialogOpen, setSuggestionsDialogOpen] = useState(false)
  const loginPromptTimer = useRef<number | null>(null)
  const voteQueue = useRef<VoteMutation[]>([])
  const voteProcessing = useRef(false)
  const voteServerPoll = useRef(poll)
  const voteServerSelection = useRef(poll.selected_options ?? [])
  const voteOptimisticSelection = useRef(poll.selected_options ?? [])
  const identifier = poll.slug
  const selected = pendingSelection ?? poll.selected_options ?? []
  const selectedSet = new Set(selected)
  const maxPercentage = useMemo(() => Math.max(0, ...poll.options.map((option) => option.percentage)), [poll.options])
  const optionNodes = useRef(new Map<string, HTMLLabelElement>())
  const positionsBeforeUpdate = useRef<Map<string, DOMRect> | null>(null)

  const captureOptionPositions = useCallback(() => {
    positionsBeforeUpdate.current = new Map([...optionNodes.current.entries()].map(([id, node]) => [id, node.getBoundingClientRect()]))
  }, [])

  useLayoutEffect(() => {
    const previousPositions = positionsBeforeUpdate.current
    positionsBeforeUpdate.current = null
    animatePollOptionReorder(previousPositions, optionNodes.current)
  }, [poll.options])

  useEffect(() => {
    if (votePendingOptionIds.size > 0 || poll.closed) return
    let active = true
    const refresh = () => {
      if (!active || votePendingOptionIds.size > 0 || pendingSelection || document.visibilityState === 'hidden') return
      void getPoll(identifier).then((latest) => {
        if (!active) return
        captureOptionPositions()
        onUpdated(latest)
      }).catch(() => undefined)
    }
    const interval = window.setInterval(refresh, POLL_REFRESH_INTERVAL_MS)
    return () => { active = false; window.clearInterval(interval) }
  }, [captureOptionPositions, identifier, onUpdated, pendingSelection, poll.closed, votePendingOptionIds.size])

  useEffect(() => () => {
    if (loginPromptTimer.current !== null) window.clearTimeout(loginPromptTimer.current)
  }, [])

  useEffect(() => {
    if (voteQueue.current.length === 0 && !voteProcessing.current && pendingSelection === null) {
      voteServerPoll.current = poll
      voteServerSelection.current = poll.selected_options ?? []
      voteOptimisticSelection.current = poll.selected_options ?? []
    }
  }, [pendingSelection, poll])

  const updatePendingVoteIds = () => {
    setVotePendingOptionIds(new Set(voteQueue.current.flatMap((mutation) => mutation.changedOptionIds)))
  }

  const processVoteQueue = useCallback(async () => {
    if (voteProcessing.current || !user) return
    voteProcessing.current = true
    while (voteQueue.current.length > 0) {
      const mutation = voteQueue.current[0]
      const previousSelection = voteServerSelection.current
      const nextSelection = togglePollSelection(previousSelection, mutation.optionId, poll.allow_multiple)
      const { addedOptions, removedOptions } = selectionDiff(previousSelection, nextSelection)

      try {
        const result = await submitPoll(identifier, addedOptions, removedOptions)
        const latest = result.poll
        voteServerPoll.current = latest
        voteServerSelection.current = latest.selected_options ?? nextSelection
        voteQueue.current.shift()
        updatePendingVoteIds()
        captureOptionPositions()
        if (voteQueue.current.length === 0) {
          setPendingSelection(null)
          onUpdated(latest)
          if (result.suggested_polls.length > 0) {
            setSuggestions(result.suggested_polls)
            setSuggestionsDialogOpen(false)
          }
        } else {
          const optimisticSelection = voteOptimisticSelection.current
          setPendingSelection(optimisticSelection)
          onUpdated(pollWithSelection(latest, user, optimisticSelection))
        }
      } catch (reason) {
        voteQueue.current.shift()
        const optimisticSelection = voteQueue.current.reduce(
          (selection, queuedMutation) => togglePollSelection(selection, queuedMutation.optionId, poll.allow_multiple),
          [...voteServerSelection.current],
        )
        voteOptimisticSelection.current = optimisticSelection
        setPendingSelection(voteQueue.current.length > 0 ? optimisticSelection : null)
        setVoteErrorOptionIds((current) => new Set([...current, ...mutation.changedOptionIds]))
        const message = pollErrorMessage(reason)
        if (onError) onError(message)
        else setError(message)
        updatePendingVoteIds()
        captureOptionPositions()
        if (voteQueue.current.length === 0) onUpdated(voteServerPoll.current)
        else onUpdated(pollWithSelection(voteServerPoll.current, user, optimisticSelection))
      }
    }
    voteProcessing.current = false
    updatePendingVoteIds()
  }, [captureOptionPositions, identifier, onError, onUpdated, poll.allow_multiple, user])

  const toggle = (id: string) => {
    if (!user) {
      if (loginPromptTimer.current !== null) window.clearTimeout(loginPromptTimer.current)
      setLoginPromptOptionId(id)
      loginPromptTimer.current = window.setTimeout(() => {
        loginPromptTimer.current = null
        setLoginPromptOptionId(null)
        onLogin()
      }, LOGIN_PROMPT_SHAKE_MS)
      return
    }
    const previousSelection = voteOptimisticSelection.current
    const next = togglePollSelection(previousSelection, id, poll.allow_multiple)
    voteOptimisticSelection.current = next
    voteQueue.current.push({ optionId: id, changedOptionIds: changedOptionIds(previousSelection, next) })
    updatePendingVoteIds()
    captureOptionPositions()
    setPendingSelection(next)
    setError('')
    onUpdated(pollWithSelection(poll, user, next))
    void processVoteQueue()
  }

  const addOption = async () => {
    const label = optionLabel
    if (!label.trim() || addOptionBusy) return
    setAddOptionBusy(true)
    setError('')
    setAddOptionFailed(false)
    captureOptionPositions()
    try {
      await addPollOption(identifier, label)
      const latest = await getPoll(identifier)
      const newOption = latest.options.find((item) => !poll.options.some((current) => current.id === item.id))
      if (newOption) setRevealingOptionId(newOption.id)
      onUpdated(latest)
      setOptionLabel('')
    } catch (reason) {
      setAddOptionFailed(true)
      setError(pollErrorMessage(reason))
    } finally {
      setAddOptionBusy(false)
    }
  }

  const resetFailedOption = () => {
    setAddOptionFailed(false)
    setOptionLabel('')
    setError('')
  }
  const minimumOptions = poll.allow_new_options ? 1 : 2
  const canHideOption = user?.member_type === 'admin' && !poll.closed && poll.options.length > minimumOptions

  const snoozeSuggestions = async () => {
    await snoozePollSuggestions(24)
  }
  const dismissSuggestion = async (pollId: string) => {
    try {
      await dismissPollSuggestion(pollId)
      setSuggestions((current) => current.filter((suggestion) => suggestion.id !== pollId))
    } catch (reason) {
      const message = pollErrorMessage(reason)
      onError?.(message)
    }
  }
  const showSuggestionError = (message: string) => onError?.(message)
  const suggestionsBasePath = pollsBase()

  return <>
  <section className="polls-page container" aria-labelledby="poll-title">
    <div className="section-heading"><p className={`poll-card__status${poll.closed ? ' poll-card__status--closed' : ' poll-card__status--open'}`}>{poll.closed ? 'encerrada' : 'aberta'}</p><h1 id="poll-title"><LinkifiedText text={poll.question} /></h1><div className="poll-detail__tags" aria-label="informações da enquete">{poll.allow_multiple ? <span className="poll-tag">múltipla escolha</span> : <span className="poll-tag">única escolha</span>}{poll.allow_new_options && <span className="poll-tag">opções abertas</span>}<span className="poll-tag poll-tag--creator">criado por {poll.creator.name}</span>{user?.member_type === 'admin' && !poll.closed && <button className="poll-tag poll-close-action" type="button" onClick={() => setCloseDialogOpen(true)}>encerrar</button>}</div><button className="poll-date-meta poll-status-trigger" type="button" aria-label={`ver auditoria da enquete ${poll.closed ? 'encerrada' : 'iniciada'}`} onClick={onAudit}>{poll.closed ? pollClosedElapsedTime(poll) : pollElapsedTime(poll)}</button></div>
    <div className="poll-options">{poll.options.map((option) => { const barWidth = maxPercentage > 0 ? Math.min(100, (option.percentage / maxPercentage) * 100) : 0; const isNewOption = option.id === revealingOptionId; const needsLogin = option.id === loginPromptOptionId; const votePending = votePendingOptionIds.has(option.id); const voteError = voteErrorOptionIds.has(option.id); const isSelected = selectedSet.has(option.id); return <PollOptionCard key={option.id} poll={poll} option={option} barWidth={barWidth} isNewOption={isNewOption} needsLogin={needsLogin} votePending={votePending} voteError={voteError} isSelected={isSelected} optionRef={(node) => { if (node) optionNodes.current.set(option.id, node); else optionNodes.current.delete(option.id) }} onToggle={() => toggle(option.id)} onAnimationEnd={() => { if (isNewOption) setRevealingOptionId(null); if (voteError) setVoteErrorOptionIds((current) => { const next = new Set(current); next.delete(option.id); return next }) }} onHide={canHideOption ? () => setOptionToHide(option) : undefined} /> })}{!poll.closed && poll.allow_new_options && user && <div className={`poll-option poll-new-option-card${addOptionFailed ? ' poll-new-option-card--error' : ''}`} aria-label="sugira uma nova opção"><span className={`poll-new-option-card__indicator${poll.allow_multiple ? ' poll-new-option-card__indicator--checkbox' : ' poll-new-option-card__indicator--radio'}`} aria-hidden="true" /><div className="poll-new-option-card__body"><label className="sr-only" htmlFor="new-option">sugira uma nova opção</label><FieldControl variant="compact" shellClassName="poll-new-option-card__field" id="new-option" value={optionLabel} disabled={addOptionBusy || addOptionFailed} aria-invalid={addOptionFailed} placeholder="sugira uma nova opção" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); if (!addOptionBusy && !addOptionFailed) void addOption() } }} onChange={(event) => { setOptionLabel(event.target.value); setAddOptionFailed(false); setError('') }} after={<FieldActionButton variant={addOptionFailed ? 'remove' : 'add'} compact aria-label={addOptionFailed ? 'Descartar sugestão' : 'Adicionar opção'} title={addOptionFailed ? 'Descartar sugestão' : 'Adicionar opção'} disabled={addOptionBusy || (!addOptionFailed && !optionLabel.trim())} onClick={() => { if (addOptionFailed) resetFailedOption(); else void addOption() }} />} />{addOptionFailed && error ? <p className="poll-new-option-card__error">{error}</p> : <span className="poll-new-option-card__vote-meta" aria-hidden="true" />}<span className="poll-option__meter poll-new-option-card__meter" aria-hidden="true" /></div></div>}</div>
    {error && !addOptionFailed && <p className="poll-error">{error}</p>}
    {closeDialogOpen && <PollCloseDialog poll={poll} onClose={() => setCloseDialogOpen(false)} onClosed={(updatedPoll) => onUpdated(updatedPoll)} />}
    {optionToHide && <PollHideOptionDialog poll={poll} option={optionToHide} onClose={() => setOptionToHide(null)} onHidden={(updatedPoll) => onUpdated(updatedPoll)} />}
  </section>
  {suggestions.length > 0 && !suggestionsDialogOpen && <PollSuggestionsToast suggestions={suggestions} onOpen={() => setSuggestionsDialogOpen(true)} onClose={() => setSuggestions([])} onSnooze={snoozeSuggestions} onError={showSuggestionError} />}
  {suggestions.length > 0 && suggestionsDialogOpen && <PollSuggestionsDialog suggestions={suggestions} basePath={suggestionsBasePath} onNavigate={onNavigate} onDismissSuggestion={dismissSuggestion} onSnooze={snoozeSuggestions} onError={showSuggestionError} onClose={() => { setSuggestionsDialogOpen(false); setSuggestions([]) }} />}
  </>
}
