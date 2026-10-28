import type { ButtonHTMLAttributes } from 'react'

interface FieldActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'add' | 'remove'
  compact?: boolean
  small?: boolean
}

export function FieldActionButton({ variant, compact = false, small = false, className = '', ...props }: FieldActionButtonProps) {
  const classes = ['field-action-button', `field-action-button--${variant}`, compact ? 'field-action-button--compact' : '', small ? 'field-action-button--small' : '', className].filter(Boolean).join(' ')
  return <button className={classes} {...props}>{variant === 'add' ? '+' : '×'}</button>
}
