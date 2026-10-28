import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LinkifiedText } from '../components/LinkifiedText'
import { FieldActionButton } from '../components/FieldActionButton'
import { FieldControl } from '../components/FieldControl'
import { PollSuggestionsDialog, PollSuggestionsToast } from './PollSuggestions'
import { PollCloseDialog, PollHideOptionDialog } from './PollDialogs'
import { PollOptionCard } from './PollOptionCard'
import type { AuthenticatedUser } from './auth/api'
import { addPollOption, getPoll, pollErrorMessage, type Poll, type PollOption } from './pollsApi'
import { animatePollOptionReorder } from './pollPresentation'
import { pollClosedElapsedTime, pollElapsedTime, pollsBase } from './pollRoutes'
import { usePollSuggestions } from './usePollSuggestions'
import { usePollVoting } from './usePollVoting'

export function PollDetail({ poll, user, onLogin, onAudit, onError, onNavigate = () => undefined, onUpdated }: { poll: Poll; user: AuthenticatedUser | null; onLogin: () => void; onAudit?: () => void; onError?: (message: string) => void; onNavigate?: (path: string) => void; onUpdated: (poll: Poll) => void }) {
  const [optionLabel, setOptionLabel] = useState('')
  const [addOptionBusy, setAddOptionBusy] = useState(false)
  const [addOptionError, setAddOptionError] = useState('')
  const [addOptionFailed, setAddOptionFailed] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [optionToHide, setOptionToHide] = useState<PollOption | null>(null)
  const [revealingOptionId, setRevealingOptionId] = useState<string | null>(null)
  const suggestions = usePollSuggestions(onError)
  const identifier = poll.slug
  const optionNodes = useRef(new Map<string, HTMLLabelElement>())
  const positionsBeforeUpdate = useRef<Map<string, DOMRect> | null>(null)

  const captureOptionPositions = useCallback(() => {
    positionsBeforeUpdate.current = new Map([...optionNodes.current.entries()].map(([id, node]) => [id, node.getBoundingClientRect()]))
  }, [])

  useLayoutEffect(() => {
    const previousPositions = positionsBeforeUpdate.current
    positionsBeforeUpdate.current = null
    animatePollOptionReorder(previousPositions, optionNodes.current)
  }, [poll.options])

  const voting = usePollVoting({
    poll,
    user,
    identifier,
    onLogin,
    onError,
    onUpdated,
    onSuggestedPolls: suggestions.show,
    capturePositions: captureOptionPositions,
  })
  const selectedSet = new Set(voting.selected)
  const maxPercentage = useMemo(() => Math.max(0, ...poll.options.map((option) => option.percentage)), [poll.options])
  const minimumOptions = poll.allow_new_options ? 1 : 2
  const canHideOption = user?.member_type === 'admin' && !poll.closed && poll.options.length > minimumOptions
  const errorMessage = addOptionFailed ? addOptionError : voting.error || addOptionError

  const addOption = async () => {
    const label = optionLabel
    if (!label.trim() || addOptionBusy) return
    setAddOptionBusy(true)
    setAddOptionError('')
    setAddOptionFailed(false)
    captureOptionPositions()
    try {
      await addPollOption(identifier, label)
      const latest = await getPoll(identifier)
      const newOption = latest.options.find((item) => !poll.options.some((current) => current.id === item.id))
      if (newOption) setRevealingOptionId(newOption.id)
      onUpdated(latest)
      setOptionLabel('')
    } catch (reason) {
      setAddOptionFailed(true)
      setAddOptionError(pollErrorMessage(reason))
    } finally {
      setAddOptionBusy(false)
    }
  }

  const resetFailedOption = () => {
    setAddOptionFailed(false)
    setOptionLabel('')
    setAddOptionError('')
  }

  return <>
    <section className="polls-page container" aria-labelledby="poll-title">
      <div className="section-heading">
        <p className={`poll-card__status${poll.closed ? ' poll-card__status--closed' : ' poll-card__status--open'}`}>
          {poll.closed ? 'encerrada' : 'aberta'}
        </p>
        <h1 id="poll-title"><LinkifiedText text={poll.question} /></h1>
        <div className="poll-detail__tags" aria-label="informações da enquete">
          <span className="poll-tag">{poll.allow_multiple ? 'múltipla escolha' : 'única escolha'}</span>
          {poll.allow_new_options && <span className="poll-tag">opções abertas</span>}
          <span className="poll-tag poll-tag--creator">criado por {poll.creator.name}</span>
          {user?.member_type === 'admin' && !poll.closed && (
            <button className="poll-tag poll-close-action" type="button" onClick={() => setCloseDialogOpen(true)}>encerrar</button>
          )}
        </div>
        <button className="poll-date-meta poll-status-trigger" type="button" aria-label={`ver auditoria da enquete ${poll.closed ? 'encerrada' : 'iniciada'}`} onClick={onAudit}>
          {poll.closed ? pollClosedElapsedTime(poll) : pollElapsedTime(poll)}
        </button>
      </div>
      <div className="poll-options">
        {poll.options.map((option) => {
          const barWidth = maxPercentage > 0 ? Math.min(100, (option.percentage / maxPercentage) * 100) : 0
          const isNewOption = option.id === revealingOptionId
          const needsLogin = option.id === voting.loginPromptOptionId
          const votePending = voting.votePendingOptionIds.has(option.id)
          const voteError = voting.voteErrorOptionIds.has(option.id)
          const isSelected = selectedSet.has(option.id)
          return <PollOptionCard
            key={option.id}
            poll={poll}
            option={option}
            barWidth={barWidth}
            isNewOption={isNewOption}
            needsLogin={needsLogin}
            votePending={votePending}
            voteError={voteError}
            isSelected={isSelected}
            optionRef={(node) => {
              if (node) optionNodes.current.set(option.id, node)
              else optionNodes.current.delete(option.id)
            }}
            onToggle={() => voting.toggle(option.id)}
            onAnimationEnd={() => {
              if (isNewOption) setRevealingOptionId(null)
              if (voteError) voting.clearVoteError(option.id)
            }}
            onHide={canHideOption ? () => setOptionToHide(option) : undefined}
          />
        })}
        {!poll.closed && poll.allow_new_options && user && (
          <div className={`poll-option poll-new-option-card${addOptionFailed ? ' poll-new-option-card--error' : ''}`} aria-label="sugira uma nova opção">
            <span className={`poll-new-option-card__indicator${poll.allow_multiple ? ' poll-new-option-card__indicator--checkbox' : ' poll-new-option-card__indicator--radio'}`} aria-hidden="true" />
            <div className="poll-new-option-card__body">
              <label className="sr-only" htmlFor="new-option">sugira uma nova opção</label>
              <FieldControl
                variant="compact"
                shellClassName="poll-new-option-card__field"
                id="new-option"
                value={optionLabel}
                disabled={addOptionBusy || addOptionFailed}
                aria-invalid={addOptionFailed}
                placeholder="sugira uma nova opção"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    if (!addOptionBusy && !addOptionFailed) void addOption()
                  }
                }}
                onChange={(event) => {
                  setOptionLabel(event.target.value)
                  setAddOptionFailed(false)
                  setAddOptionError('')
                }}
                after={
                  <FieldActionButton
                    variant={addOptionFailed ? 'remove' : 'add'}
                    compact
                    busy={addOptionBusy}
                    aria-label={addOptionFailed ? 'Descartar sugestão' : 'Adicionar opção'}
                    title={addOptionFailed ? 'Descartar sugestão' : 'Adicionar opção'}
                    disabled={addOptionBusy || (!addOptionFailed && !optionLabel.trim())}
                    onClick={() => {
                      if (addOptionFailed) resetFailedOption()
                      else void addOption()
                    }}
                  />
                }
              />
              {addOptionFailed && addOptionError ? <p className="poll-new-option-card__error">{addOptionError}</p> : <span className="poll-new-option-card__vote-meta" aria-hidden="true" />}
              <span className="poll-option__meter poll-new-option-card__meter" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
      {errorMessage && !addOptionFailed && <p className="poll-error">{errorMessage}</p>}
      {closeDialogOpen && <PollCloseDialog poll={poll} onClose={() => setCloseDialogOpen(false)} onClosed={(updatedPoll) => onUpdated(updatedPoll)} />}
      {optionToHide && <PollHideOptionDialog poll={poll} option={optionToHide} onClose={() => setOptionToHide(null)} onHidden={(updatedPoll) => onUpdated(updatedPoll)} />}
    </section>
    {suggestions.suggestions.length > 0 && !suggestions.dialogOpen && <PollSuggestionsToast suggestions={suggestions.suggestions} onOpen={suggestions.open} onClose={suggestions.clear} onSnooze={suggestions.snooze} onError={onError ?? (() => undefined)} />}
    {suggestions.suggestions.length > 0 && suggestions.dialogOpen && <PollSuggestionsDialog suggestions={suggestions.suggestions} basePath={pollsBase()} onNavigate={onNavigate} onDismissSuggestion={suggestions.dismiss} onSnooze={suggestions.snooze} onError={onError ?? (() => undefined)} onClose={suggestions.clear} />}
  </>
}
