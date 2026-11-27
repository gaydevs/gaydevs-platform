import { useId, useRef } from 'react'
import { ModalHeader } from '../components/ModalHeader'
import { NotesBrand } from '../components/NotesBrand'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useModalLifecycle } from '../components/useModalLifecycle'

export function NoteConflictDialog({ busy, error, onReload, onOverwrite }: {
  busy: boolean; error: string; onReload: () => void; onOverwrite: () => void
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  useModalLifecycle(undefined, dialogRef, '.action-link--secondary')
  return <div className="login-overlay" role="presentation">
    <section ref={dialogRef} tabIndex={-1} className="login-dialog poll-close-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <ModalHeader><NotesBrand linked={false} /></ModalHeader>
      <div className="poll-close-dialog__body">
        <p className="login-dialog__eyebrow">ANOTAÇÕES</p>
        <h2 id={titleId}>Conflito de anotação</h2>
        <p className="poll-close-dialog__description">Esta anotação foi alterada em outra gravação. Recarregar descarta sua edição local; Sobrescrever substitui a versão remota pela sua edição.</p>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="poll-close-dialog__actions">
          <button className="action-link action-link--secondary" type="button" disabled={busy} onClick={onReload}>Recarregar</button>
          <button className="action-link" type="button" disabled={busy} onClick={onOverwrite}>Sobrescrever</button>
          {busy && <span role="status" aria-label="Resolvendo conflito"><LoadingSpinner /></span>}
        </div>
      </div>
    </section>
  </div>
}
