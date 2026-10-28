import type { HTMLAttributes } from 'react'

export function LoadingSpinner({ className = '', ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={`loading-spinner${className ? ` ${className}` : ''}`} aria-hidden="true" {...props} />
}
