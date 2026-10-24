import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { messageForApiError, verifyOtp } from './api'
import type { OtpLoginContext } from './types'

// Um array facilita mover o foco e tratar cada caixa individualmente.
const OTP_DIGITS = 6

interface OtpVerificationStepProps {
  otpContext: OtpLoginContext
  onBack: () => void
  onVerified: () => Promise<void>
}

/** Exibe o OTP em seis caixas e controla confirmação, erro e nova tentativa. */
export function OtpVerificationStep({ otpContext, onBack, onVerified }: OtpVerificationStepProps) {
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_DIGITS).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const digitInputs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (error) digitInputs.current[0]?.focus()
  }, [error])

  /** Envia o código completo e informa ao coordenador quando a sessão foi criada. */
  const verifyCode = async (nextCode: string) => {
    if (nextCode.length !== OTP_DIGITS || loading) return
    setLoading(true)
    setError(null)
    setShake(false)
    try {
      await verifyOtp(otpContext.otp_request_id, nextCode)
      await onVerified()
    } catch (requestError) {
      // O erro limpa o código, sinaliza a falha com movimento e prepara nova tentativa.
      setDigits(Array(OTP_DIGITS).fill(''))
      setError(messageForApiError(requestError))
      setShake(true)
    } finally {
      setLoading(false)
    }
  }

  /** Distribui um valor digitado ou colado e verifica ao completar seis dígitos. */
  const updateDigits = (index: number, value: string) => {
    // Também é usado para colagem: os caracteres ocupam as caixas seguintes.
    const nextDigits = [...digits]
    value.slice(0, OTP_DIGITS - index).split('').forEach((digit, offset) => { nextDigits[index + offset] = digit })
    setError(null)
    setShake(false)
    setDigits(nextDigits)
    digitInputs.current[Math.min(index + value.length, OTP_DIGITS - 1)]?.focus()
    if (nextDigits.every(Boolean)) void verifyCode(nextDigits.join(''))
  }

  /** Trata a digitação normal em uma caixa e mantém apenas números. */
  const updateDigit = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const entered = event.target.value.replace(/\D/g, '')
    if (entered === '') {
      setError(null)
      setShake(false)
      setDigits((current) => current.map((digit, digitIndex) => digitIndex === index ? '' : digit))
      return
    }
    updateDigits(index, entered)
  }

  /** Trata colagem de um código inteiro a partir da caixa focada. */
  const pasteCode = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '')
    if (pasted === '') return
    event.preventDefault()
    updateDigits(index, pasted)
  }

  /** Move o foco com Backspace e setas para as caixas vizinhas. */
  const navigateCode = (index: number, event: ReactKeyboardEvent<HTMLInputElement>) => {
    // Backspace e setas tornam as seis caixas uma única entrada contínua.
    if (event.key === 'Backspace') {
      event.preventDefault()
      if (digits[index] !== '') {
        setDigits((current) => current.map((digit, digitIndex) => digitIndex === index ? '' : digit))
        return
      }
      if (index > 0) {
        setDigits((current) => current.map((digit, digitIndex) => digitIndex === index - 1 ? '' : digit))
        digitInputs.current[index - 1]?.focus()
      }
    }
    if (event.key === 'ArrowLeft' && index > 0) digitInputs.current[index - 1]?.focus()
    if (event.key === 'ArrowRight' && index < OTP_DIGITS - 1) digitInputs.current[index + 1]?.focus()
  }

  return <div className="login-dialog__panel login-dialog__panel--otp">
    <p className="login-dialog__eyebrow">confirme seu acesso</p>
    <h2 id="login-title">digite o código</h2>
    <p>Enviamos um código para <strong>{otpContext.user.email}</strong>.</p>

    <fieldset className={`login-code${shake ? ' login-code--shake' : ''}`}>
      <legend>código de 6 dígitos</legend>
      <div className="login-code__digits">
        {digits.map((digit, index) => <input
          key={index}
          ref={(input) => { digitInputs.current[index] = input }}
          autoFocus={index === 0}
          aria-label={`dígito ${index + 1} do código`}
          inputMode="numeric"
          autoComplete="off"
          data-1p-ignore="true"
          data-bwignore="true"
          data-lpignore="true"
          data-form-type="other"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={loading}
          onChange={(event) => updateDigit(index, event)}
          onKeyDown={(event) => navigateCode(index, event)}
          onPaste={(event) => pasteCode(index, event)}
        />)}
      </div>
    </fieldset>

    {error && <p className="login-error" role="alert">{error}</p>}
    <button className="login-back" type="button" onClick={onBack}>voltar para a busca</button>
  </div>
}
