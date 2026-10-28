import { useEffect, useRef, type ReactNode } from 'react'

export type SectionAuthMode = 'required' | 'preview'

interface SectionAuthGateProps {
  mode: SectionAuthMode
  authenticated: boolean
  restoring: boolean
  fallback: ReactNode
  onRequireLogin?: () => void
  children: ReactNode
}

/** Define o contrato comum entre seções que exigem sessão e seções públicas com prévia. */
export function SectionAuthGate({ mode, authenticated, restoring, fallback, onRequireLogin, children }: SectionAuthGateProps) {
  const requestedLogin = useRef(false)

  useEffect(() => {
    if (mode !== 'required' || restoring || authenticated) {
      requestedLogin.current = false
      return
    }
    if (requestedLogin.current) return
    requestedLogin.current = true
    onRequireLogin?.()
  }, [authenticated, mode, onRequireLogin, restoring])

  if (mode === 'required' && !restoring && !authenticated) return fallback
  return children
}
