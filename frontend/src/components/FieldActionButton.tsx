import type { ButtonHTMLAttributes } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

interface FieldActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'add' | 'remove'
  compact?: boolean
  small?: boolean
  busy?: boolean
}

export function FieldActionButton({ variant, compact = false, small = false, busy = false, className = '', disabled, ...props }: FieldActionButtonProps) {
  const classes = ['field-action-button', `field-action-button--${variant}`, compact ? 'field-action-button--compact' : '', small ? 'field-action-button--small' : '', busy ? 'field-action-button--busy' : '', className].filter(Boolean).join(' ')
  return <button type="button" className={classes} disabled={busy || disabled} aria-busy={busy || undefined} {...props}>{busy ? <LoadingSpinner className="field-action-button__spinner" /> : variant === 'add' ? '+' : '×'}</button>
}
