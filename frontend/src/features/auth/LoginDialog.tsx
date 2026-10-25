import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { BrandLogo } from '../../components/BrandLogo'
import { ModalHeader } from '../../components/ModalHeader'
import { OtpVerificationStep } from './OtpVerificationStep'
import { UserSearchStep } from './UserSearchStep'
import type { LoginStep } from './useLoginHash'
import type { OtpLoginContext } from './types'

// O contexto permite recarregar diretamente em #login/otp sem expor o código.
const STORAGE_KEY = 'gaydevs.login.otp'
const CLOSE_ANIMATION_MS = 220

interface LoginDialogProps {
  step: LoginStep
  onStepChange: (step: LoginStep) => void
  onClose: () => void
  onAuthenticated: () => Promise<unknown>
}

/** Recupera o pedido de OTP salvo para permitir refresh em #login/otp. */
function storedOtpContext(): OtpLoginContext | null {
  try {
    // sessionStorage sobrevive ao refresh da aba, mas não a uma nova sessão do navegador.
    const value = sessionStorage.getItem(STORAGE_KEY)
    return value ? JSON.parse(value) as OtpLoginContext : null
  } catch {
    return null
  }
}

/** Coordena as etapas do login, mas deixa cada etapa cuidar da própria interface. */
export function LoginDialog({ step, onStepChange, onClose, onAuthenticated }: LoginDialogProps) {
  const [otpContext, setOtpContext] = useState<OtpLoginContext | null>(() => storedOtpContext())
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | null>(null)

  /** Cancela o pedido pendente e remove seu contexto da aba. */
  const clearOtpContext = useCallback(() => {
    // Ao sair do fluxo, o OTP pendente não deve continuar disponível na aba.
    sessionStorage.removeItem(STORAGE_KEY)
    setOtpContext(null)
  }, [])

  /** Executa o fechamento real depois que a animação termina. */
  const finishClose = useCallback(() => {
    clearOtpContext()
    onClose()
  }, [clearOtpContext, onClose])

  /** Inicia a saída animada usada pelo ×, Escape, backdrop e sucesso. */
  const closeDialog = useCallback(() => {
    if (closing) return
    // Espera a animação terminar antes de o App desmontar o diálogo.
    setClosing(true)
    closeTimer.current = window.setTimeout(finishClose, CLOSE_ANIMATION_MS)
  }, [closing, finishClose])

  /** Volta para a busca e descarta o contexto do OTP atual. */
  const backToSearch = () => {
    // Voltar cancela o pedido atual e monta uma busca completamente nova.
    clearOtpContext()
    onStepChange('search')
  }

  /** Recebe o OTP criado pela etapa de busca e muda o hash para a etapa seguinte. */
  const handleOtpRequested = (context: OtpLoginContext) => {
    // O filho só solicita o OTP; o coordenador persiste o contexto e muda a etapa.
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context))
    setOtpContext(context)
    onStepChange('otp')
  }

  /** Atualiza a sessão e fecha o modal após uma confirmação válida. */
  const handleVerified = async () => {
    await onAuthenticated()
    closeDialog()
  }

  useEffect(() => {
    // Um link direto para #login/otp sem contexto válido volta para a busca.
    if (step === 'otp' && otpContext === null) onStepChange('search')
  }, [step, otpContext, onStepChange])

  useEffect(() => {
    // Trava o scroll da página; cada etapa define o próprio foco inicial.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDialog()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [closeDialog])

  useEffect(() => () => {
    // Evita que o timer de fechamento tente atualizar um componente desmontado.
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  /** Fecha somente quando o clique ocorreu fora do painel do modal. */
  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeDialog()
  }

  return <div className={`login-overlay${closing ? ' login-overlay--closing' : ''}`} role="presentation" onMouseDown={closeFromBackdrop}>
    <section className={`login-dialog${closing ? ' login-dialog--closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="login-title">
      <ModalHeader closeLabel="fechar login" onClose={closeDialog}>
        <BrandLogo
          wordmark={step === 'otp' ? '/gdevs/login/verify-otp' : '/gdevs/login'}
          suffix=""
        />
      </ModalHeader>
      {step === 'search'
        ? <UserSearchStep onOtpRequested={handleOtpRequested} />
        : otpContext && <OtpVerificationStep otpContext={otpContext} onBack={backToSearch} onVerified={handleVerified} />}
    </section>
  </div>
}
