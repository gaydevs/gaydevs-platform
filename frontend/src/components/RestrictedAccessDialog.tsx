import { useId, useRef, type ReactNode } from 'react'
import { ModalHeader } from './ModalHeader'
import { useModalLifecycle } from './useModalLifecycle'

interface RestrictedAccessDialogProps {
  brand: ReactNode
  eyebrow: string
  description: string
  onHome: () => void
}

/** A denied section keeps its own skeleton underneath this shared dialog. */
export function RestrictedAccessDialog({ brand, eyebrow, description, onHome }: RestrictedAccessDialogProps) {
  const titleId = useId()
  const homeButton = useRef<HTMLButtonElement>(null)
  useModalLifecycle(onHome, homeButton)

  return <div className="login-overlay" role="presentation">
    <section className="login-dialog poll-error-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <ModalHeader closeLabel="voltar à home" onClose={onHome}>{brand}</ModalHeader>
      <div className="poll-error-dialog__body">
        <p className="login-dialog__eyebrow">{eyebrow}</p>
        <h2 id={titleId}>Área restrita</h2>
        <p className="poll-close-dialog__description">{description}</p>
        <button ref={homeButton} className="action-link poll-error-dialog__action" type="button" onClick={onHome}>Home</button>
      </div>
    </section>
  </div>
}
