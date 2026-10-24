import { useCallback, useEffect, useRef, useState } from 'react'

export type LoginStep = 'search' | 'otp'
export const LOGIN_HASH = '#login'
export const LOGIN_OTP_HASH = '#login/otp'

/** Traduz o hash atual em uma das duas etapas conhecidas do login. */
export function loginStepFromHash(hash: string): LoginStep | null {
  // Converte uma entrada externa (a URL) em um estado permitido pela aplicação.
  if (hash === LOGIN_OTP_HASH) return 'otp'
  if (hash === LOGIN_HASH) return 'search'
  return null
}

/** Sincroniza abertura, etapa e fechamento do modal com o histórico do navegador. */
export function useLoginHash() {
  const [step, setStep] = useState<LoginStep | null>(() => loginStepFromHash(window.location.hash))
  const returnUrl = useRef<string | null>(null)
  useEffect(() => {
    // O usuário pode navegar pelo histórico; o estado acompanha hashchange/popstate.
    const synchronize = () => setStep(loginStepFromHash(window.location.hash))
    window.addEventListener('hashchange', synchronize)
    window.addEventListener('popstate', synchronize)
    return () => { window.removeEventListener('hashchange', synchronize); window.removeEventListener('popstate', synchronize) }
  }, [])
  /** Abre o modal sem abandonar a página atual. */
  const open = useCallback(() => {
    if (loginStepFromHash(window.location.hash) !== null) return
    // Guardamos a página original para fechar sem perder a posição/âncora.
    returnUrl.current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.history.pushState(null, '', LOGIN_HASH)
    setStep('search')
  }, [])
  /** Troca search/otp sem criar outra entrada no histórico. */
  const showStep = useCallback((nextStep: LoginStep) => {
    // replaceState troca a etapa sem criar uma entrada extra no histórico.
    window.history.replaceState(null, '', nextStep === 'otp' ? LOGIN_OTP_HASH : LOGIN_HASH)
    setStep(nextStep)
  }, [])
  /** Fecha o modal e restaura a URL original da pessoa. */
  const close = useCallback(() => {
    window.history.replaceState(null, '', returnUrl.current ?? `${window.location.pathname}${window.location.search}`)
    returnUrl.current = null
    setStep(null)
  }, [])
  return { step, open, showStep, close }
}
