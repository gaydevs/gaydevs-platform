import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

export type FieldControlProps = InputHTMLAttributes<HTMLInputElement> & {
  before?: ReactNode
  after?: ReactNode
  error?: ReactNode
  shellClassName?: string
  variant?: 'regular' | 'compact'
}

export const FieldControl = forwardRef<HTMLInputElement, FieldControlProps>(function FieldControl({ before, after, error, shellClassName = '', variant = 'regular', className, ...inputProps }, ref) {
  const shellClasses = ['field-control', variant === 'compact' ? 'field-control--compact' : '', before ? 'field-control--before' : '', after ? 'field-control--after' : '', shellClassName].filter(Boolean).join(' ')

  return <span className={shellClasses}>
    {before && <span className="field-control__before" aria-hidden="true">{before}</span>}
    <input ref={ref} className={className} {...inputProps} />
    {after && <span className="field-control__after">{after}</span>}
    {error && <span className="field-control__error" role="alert">{error}</span>}
  </span>
})
