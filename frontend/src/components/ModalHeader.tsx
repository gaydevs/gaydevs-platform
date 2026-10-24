import type { ReactNode } from 'react'

interface ModalHeaderProps {
  children: ReactNode
  closeLabel: string
  onClose: () => void
}

/** Cabeçalho padrão dos modais: marca, fechamento e divisória colorida. */
export function ModalHeader({ children, closeLabel, onClose }: ModalHeaderProps) {
  return <header className="modal-header">
    <div className="modal-header__row">
      {children}
      <button className="modal-header__close" type="button" aria-label={closeLabel} onClick={onClose}>×</button>
    </div>
    <span className="modal-header__divider" aria-hidden="true" />
  </header>
}
