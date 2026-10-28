import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { ModalHeader } from '../components/ModalHeader'
import { PollsBrand } from '../components/PollsBrand'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { closePoll, getPollAudit, hidePollOption, pollErrorMessage, type Poll, type PollAudit, type PollOption } from './pollsApi'
import { auditCancellationReason, auditEventActor, auditEventTitle, formatAuditDate } from './pollRoutes'

export function PollAuditLoading() {
  return <div className="poll-audit-list poll-audit-loading" role="status" aria-busy="true" aria-label="Carregando auditoria">
    {[0, 1, 2, 3].map((index) => <div className="poll-audit-entry poll-audit-loading__entry" key={index} aria-hidden="true">
      <span className="poll-audit-loading__title poll-loading__shine" />
      <span className="poll-audit-loading__actor poll-loading__shine" />
      <span className="poll-audit-loading__date poll-loading__shine" />
    </div>)}
  </div>
}

function useDialogClose(onClose: () => void, busy = false) {
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

  return { closing, closeDialog }
}

export function PollErrorDialog({ message, onClose }: { message: string; onClose: () => void }) {
  const { closing, closeDialog } = useDialogClose(onClose)
  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) closeDialog() }

  return <div className={`login-overlay${closing ? ' login-overlay--closing' : ''}`} role="presentation" onMouseDown={closeFromBackdrop}>
    <section className={`login-dialog poll-error-dialog${closing ? ' login-dialog--closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="poll-error-title">
      <ModalHeader closeLabel="fechar erro" onClose={closeDialog}><PollsBrand wordmark="/gdevs/polls/error" linked={false} /></ModalHeader>
      <div className="poll-error-dialog__body">
        <p className="login-dialog__eyebrow">ERRO NA ENQUETE</p>
        <h2 id="poll-error-title">Não foi possível atualizar seu voto</h2>
        <p className="login-error" role="alert">{message}</p>
        <button className="action-link poll-error-dialog__action" type="button" onClick={() => closeDialog()}>Entendi</button>
      </div>
    </section>
  </div>
}

export function PollCloseDialog({ poll, onClose, onClosed }: { poll: Poll; onClose: () => void; onClosed: (poll: Poll) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { closing, closeDialog } = useDialogClose(onClose, busy)
  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) closeDialog() }

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
      <ModalHeader closeLabel="fechar confirmação" onClose={() => closeDialog()}><PollsBrand wordmark="/gdevs/polls/close" linked={false} /></ModalHeader>
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
  const { closing, closeDialog } = useDialogClose(onClose, busy)
  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) closeDialog() }

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
      <ModalHeader closeLabel="fechar confirmação" onClose={() => closeDialog()}><PollsBrand wordmark="/gdevs/polls/hide-option" linked={false} /></ModalHeader>
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
  const { closing, closeDialog } = useDialogClose(onClose)
  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) closeDialog() }

  useEffect(() => {
    let active = true
    void getPollAudit(poll.slug).then((value) => { if (active) setAudit(value) }).catch((reason) => { if (active) setError(pollErrorMessage(reason)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [poll.slug])

  const auditOptions = useMemo(() => {
    const options = new Map<string, string>()
    audit?.events.forEach((event) => {
      if ((event.type === 'vote_recorded' || event.type === 'vote_canceled') && event.option_id) options.set(event.option_id, event.option_label ?? 'Opção removida')
    })
    return [...options.entries()]
  }, [audit])
  const auditUsers = useMemo(() => {
    const users = new Map<string, string>()
    audit?.events.forEach((event) => { if (event.actor) users.set(event.actor.id, event.actor.name) })
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
      <ModalHeader closeLabel="fechar auditoria" onClose={closeDialog}><PollsBrand wordmark="/gdevs/polls/audit" linked={false} /></ModalHeader>
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
