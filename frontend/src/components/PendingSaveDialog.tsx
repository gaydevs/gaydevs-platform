import { useId, useRef, type ReactNode } from 'react'
import { ModalHeader } from './ModalHeader'
import { LoadingSpinner } from './LoadingSpinner'
import { useModalLifecycle } from './useModalLifecycle'

interface PendingSaveDialogProps {
  brand: ReactNode
  eyebrow: string
  status: 'saved' | 'pending' | 'saving' | 'error' | 'session-changed'
  savingTitle: string
  sessionDescription: string
  onCancel: () => void
  onIgnore: () => void
  onRetry: () => void
  onReload: () => void
}

/** Presents an existing navigation guard; it never performs persistence itself. */
export function PendingSaveDialog({ brand, eyebrow, status, savingTitle, sessionDescription, onCancel, onIgnore, onRetry, onReload }: PendingSaveDialogProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  useModalLifecycle(onCancel, dialogRef, '.modal-header__close')
  const changed = status === 'session-changed'
  const failed = status === 'error'

  return <div className="login-overlay" role="presentation">
    <section ref={dialogRef} className="login-dialog poll-close-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <ModalHeader closeLabel="cancelar saída" onClose={onCancel}>{brand}</ModalHeader>
      <div className="poll-close-dialog__body">
        <p className="login-dialog__eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{changed ? 'Sessão alterada' : failed ? 'Não foi possível salvar' : savingTitle}</h2>
        <p className="poll-close-dialog__description">{changed ? sessionDescription : failed ? 'Seu texto continua na ficha. Tente novamente antes de sair.' : 'Aguarde o salvamento para continuar.'} Alterações pendentes podem não ser salvas se você ignorar.</p>
        <div className="poll-close-dialog__actions">
          <button className="action-link action-link--secondary" type="button" onClick={onIgnore}>Ignorar</button>
          {changed ? <button className="action-link" type="button" onClick={onReload}>Recarregar</button> : failed ? <button className="action-link" type="button" onClick={onRetry}>Tentar de novo</button> : <span role="status" className="pending-save-dialog__spinner"><LoadingSpinner /></span>}
        </div>
      </div>
    </section>
  </div>
}
