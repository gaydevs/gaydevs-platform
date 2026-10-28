import { useState } from 'react'
import { FieldActionButton } from '../components/FieldActionButton'
import { FieldControl } from '../components/FieldControl'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { AuthenticatedUser } from './auth/api'
import { createPoll, pollErrorMessage } from './pollsApi'
import { pollCreateApiFieldErrors, pollsBase } from './pollRoutes'

export function PollCreate({ user, onNavigate }: { user: AuthenticatedUser | null; onNavigate: (path: string) => void }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [multiple, setMultiple] = useState(false)
  const [allowNewOptions, setAllowNewOptions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [newOptionIndex, setNewOptionIndex] = useState<number | null>(null)
  const [addingOption, setAddingOption] = useState(false)
  const [validationErrorFields, setValidationErrorFields] = useState<Set<string>>(new Set())
  const [validationErrorMessages, setValidationErrorMessages] = useState<Record<string, string>>({})
  if (user?.member_type !== 'admin') return <section className="polls-page container"><p className="poll-error">Apenas admins podem criar enquetes.</p></section>
  const updateOption = (index: number, value: string) => setOptions((current) => current.map((option, currentIndex) => currentIndex === index ? value : option))
  const updateAllowNewOptions = (enabled: boolean) => {
    setAllowNewOptions(enabled)
    if (!enabled) setOptions((current) => current.length >= 2 ? current : [...current, ''])
  }
  const addOption = () => {
    if (busy) return
    setNewOptionIndex(options.length)
    setAddingOption(true)
    setOptions((current) => [...current, ''])
  }
  const clearValidationError = (field: string) => {
    setValidationErrorFields((current) => {
      if (!current.has(field)) return current
      const next = new Set(current)
      next.delete(field)
      return next
    })
    setValidationErrorMessages((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setError('')
  }
  const clearValidationPopups = () => {
    setValidationErrorFields(new Set())
    setValidationErrorMessages({})
    setError('')
  }
  const submit = async () => {
    setValidationErrorFields(new Set())
    setValidationErrorMessages({})
    setBusy(true); setError('')
    try {
      const poll = await createPoll({ question, options, allow_multiple: multiple, allow_new_options: allowNewOptions })
      onNavigate(`${pollsBase()}/${poll.slug}`)
    } catch (reason) {
      const fieldErrors = pollCreateApiFieldErrors(reason)
      if (fieldErrors) {
        setValidationErrorFields(fieldErrors.fields)
        setValidationErrorMessages(fieldErrors.messages)
        setError(fieldErrors.generalMessage ?? '')
      } else setError(pollErrorMessage(reason))
    } finally { setBusy(false) }
  }

  return <section className="polls-page container" aria-labelledby="new-poll-title" onPointerDownCapture={clearValidationPopups}>
    <h1 id="new-poll-title" className="poll-create-title">Nova enquete</h1>
    <div className={`poll-form${busy ? ' poll-form--busy' : ''}`} aria-busy={busy}>
      <FieldControl shellClassName={`poll-form__question${validationErrorFields.has('question') ? ' poll-form__field--invalid' : ''}`} error={validationErrorMessages.question} aria-label="Pergunta" placeholder="Pergunta" value={question} disabled={busy} onChange={(event) => { setQuestion(event.target.value); clearValidationError('question') }} />
      <div className="poll-form__options">
        {options.map((option, index) => {
          const removable = index > 0 && (allowNewOptions || index > 1)
          return <FieldControl shellClassName={`poll-form__option-row${removable ? ' poll-form__option-row--removable' : ''}${newOptionIndex === index ? ' poll-form__option-row--new' : ''}${validationErrorFields.has(`option-${index}`) ? ' poll-form__field--invalid' : ''}`} error={validationErrorMessages[`option-${index}`]} aria-label={`Opção ${index + 1}`} value={option} disabled={busy} placeholder={`Opção ${index + 1}`} onChange={(event) => { updateOption(index, event.target.value); clearValidationError(`option-${index}`) }} after={removable ? <FieldActionButton variant="remove" aria-label={`Remover opção ${index + 1}`} title={`Remover opção ${index + 1}`} disabled={busy} onClick={() => setOptions((current) => current.filter((_, currentIndex) => currentIndex !== index))} /> : undefined} key={index} />
        })}
        <button type="button" className={`action-link action-link--secondary poll-form__add-option${addingOption ? ' poll-form__add-option--moving' : ''}`} disabled={busy} onAnimationEnd={() => setAddingOption(false)} onClick={addOption}>Adicionar opção</button>
      </div>
      <label className="poll-switch"><input type="checkbox" checked={multiple} disabled={busy} onChange={(event) => setMultiple(event.target.checked)} /><span className="poll-switch__track" aria-hidden="true" /><span>Permitir selecionar múltiplas opções</span></label>
      <label className="poll-switch"><input type="checkbox" checked={allowNewOptions} disabled={busy} onChange={(event) => updateAllowNewOptions(event.target.checked)} /><span className="poll-switch__track" aria-hidden="true" /><span>Permitir adicionar novas opções depois</span></label>
      <div className="poll-form__submit-area">
        {error && <p className="poll-form__error" role="alert">{error}</p>}
        <button className={`action-link poll-submit-button${busy ? ' poll-submit-button--busy' : ''}`} type="button" aria-busy={busy} disabled={busy} onClick={() => void submit()}><span className="poll-submit-button__label">Criar enquete</span>{busy && <LoadingSpinner className="poll-submit-button__spinner" />}</button>
      </div>
    </div>
  </section>
}
