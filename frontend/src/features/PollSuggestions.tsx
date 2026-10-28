import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { ModalHeader } from '../components/ModalHeader'
import { OverflowMenu } from '../components/OverflowMenu'
import { PollsBrand } from '../components/PollsBrand'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { PollCard } from './PollCard'
import type { PollSuggestion } from './pollsApi'

interface PollSuggestionsDialogProps {
  suggestions: PollSuggestion[]
  onClose: () => void
  onNavigate: (path: string) => void
  basePath: string
  onDismissSuggestion: (pollId: string) => Promise<void>
  onSnooze: () => Promise<void>
  onError: (message: string) => void
}

interface PollSuggestionsToastProps {
  suggestions: PollSuggestion[]
  onClose: () => void
  onSnooze: () => Promise<void>
  onError: (message: string) => void
  onOpen: () => void
}

export function PollSuggestionsToast({ suggestions, onClose, onSnooze, onError, onOpen }: PollSuggestionsToastProps) {
  const [busy, setBusy] = useState(false)

  const snooze = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onSnooze()
      onClose()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível adiar as sugestões.')
    } finally {
      setBusy(false)
    }
  }

  return <aside className="poll-suggestions-toast" aria-live="polite">
    <strong>Você ainda não votou em outras enquetes abertas.</strong>
    <p>{suggestions.length === 1 ? 'Há uma sugestão para você.' : `Há ${suggestions.length} sugestões para você.`}</p>
    <div className="poll-suggestions-toast__actions">
      <button className="action-link" type="button" onClick={onOpen}>Ver sugestões</button>
      <button className="poll-suggestions-toast__snooze" type="button" disabled={busy} onClick={() => void snooze()}>{busy && <LoadingSpinner className="poll-suggestions-toast__spinner" />}Agora não</button>
    </div>
  </aside>
}

export function PollSuggestionsDialog({ suggestions, onClose, onNavigate, basePath, onDismissSuggestion, onSnooze, onError }: PollSuggestionsDialogProps) {
  const [closing, setClosing] = useState(false)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [snoozeBusy, setSnoozeBusy] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const closingRef = useRef(false)

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 220)
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [close])

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close()
  }

  const dismissSuggestion = async (pollId: string) => {
    if (dismissingId) return
    setDismissingId(pollId)
    try {
      await onDismissSuggestion(pollId)
    } finally {
      setDismissingId(null)
    }
  }

  const snooze = async () => {
    if (snoozeBusy) return
    setSnoozeBusy(true)
    try {
      await onSnooze()
      close()
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível adiar as sugestões.')
    } finally {
      setSnoozeBusy(false)
    }
  }

  return <div className={`login-overlay${closing ? ' login-overlay--closing' : ''}`} role="presentation" onMouseDown={closeFromBackdrop}>
    <section className={`login-dialog poll-suggestions-dialog${closing ? ' login-dialog--closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="poll-suggestions-title">
      <ModalHeader closeLabel="fechar sugestões" onClose={close}>
        <PollsBrand wordmark="/gdevs/polls/suggestions" linked={false} />
      </ModalHeader>
      <p className="login-dialog__eyebrow">OUTRAS ENQUETES</p>
      <h2 id="poll-suggestions-title">Participe de mais decisões</h2>
      <div className="poll-suggestions-dialog__list">
        {suggestions.map((suggestion) => <PollCard key={suggestion.id} item={{ ...suggestion, closed: false, closed_at: null }} path={`${basePath}/${suggestion.slug}`} onNavigate={(path) => { close(); onNavigate(path) }} compact actions={<OverflowMenu label={`Ações da enquete ${suggestion.question}`} className="poll-suggestion-card__menu">
          {(closeMenu) => <button className="poll-suggestion-card__dismiss" type="button" disabled={dismissingId !== null} onClick={() => { closeMenu(); void dismissSuggestion(suggestion.id) }}>{dismissingId === suggestion.id && <LoadingSpinner className="poll-suggestions-dialog__spinner" />}não quero votar nesta enquete</button>}
        </OverflowMenu>} />)}
      </div>
      <button className="action-link action-link--secondary poll-suggestions-dialog__later" type="button" disabled={snoozeBusy} onClick={() => void snooze()}>{snoozeBusy && <LoadingSpinner className="poll-suggestions-dialog__snooze-spinner" />}Agora não</button>
    </section>
  </div>
}
