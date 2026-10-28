import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuthenticatedUser } from './auth/api'
import { getPoll, pollErrorMessage, submitPoll, type Poll, type PollSubmissionResponse } from './pollsApi'
import { pollWithSelection } from './pollPresentation'
import { changedOptionIds, LOGIN_PROMPT_SHAKE_MS, POLL_REFRESH_INTERVAL_MS, selectionDiff, togglePollSelection, type VoteMutation } from './pollRoutes'

interface UsePollVotingOptions {
  poll: Poll
  user: AuthenticatedUser | null
  identifier: string
  onLogin: () => void
  onError?: (message: string) => void
  onUpdated: (poll: Poll) => void
  onSuggestedPolls: (polls: PollSubmissionResponse['suggested_polls']) => void
  capturePositions: () => void
}

export interface PollVotingState {
  selected: string[]
  votePendingOptionIds: Set<string>
  voteErrorOptionIds: Set<string>
  loginPromptOptionId: string | null
  error: string
  toggle: (optionId: string) => void
  clearVoteError: (optionId: string) => void
}

export function usePollVoting({ poll, user, identifier, onLogin, onError, onUpdated, onSuggestedPolls, capturePositions }: UsePollVotingOptions): PollVotingState {
  const [pendingSelection, setPendingSelection] = useState<string[] | null>(null)
  const [votePendingOptionIds, setVotePendingOptionIds] = useState<Set<string>>(new Set())
  const [voteErrorOptionIds, setVoteErrorOptionIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [loginPromptOptionId, setLoginPromptOptionId] = useState<string | null>(null)
  const loginPromptTimer = useRef<number | null>(null)
  const voteQueue = useRef<VoteMutation[]>([])
  const voteProcessing = useRef(false)
  const voteServerPoll = useRef(poll)
  const voteServerSelection = useRef(poll.selected_options ?? [])
  const voteOptimisticSelection = useRef(poll.selected_options ?? [])

  const updatePendingVoteIds = useCallback(() => {
    setVotePendingOptionIds(new Set(voteQueue.current.flatMap((mutation) => mutation.changedOptionIds)))
  }, [])

  const processVoteQueue = useCallback(async () => {
    if (voteProcessing.current || !user) return
    voteProcessing.current = true
    while (voteQueue.current.length > 0) {
      const mutation = voteQueue.current[0]
      const previousSelection = voteServerSelection.current
      const nextSelection = togglePollSelection(previousSelection, mutation.optionId, poll.allow_multiple)
      const { addedOptions, removedOptions } = selectionDiff(previousSelection, nextSelection)

      try {
        const result = await submitPoll(identifier, addedOptions, removedOptions)
        const latest = result.poll
        voteServerPoll.current = latest
        voteServerSelection.current = latest.selected_options ?? nextSelection
        voteQueue.current.shift()
        updatePendingVoteIds()
        capturePositions()
        if (voteQueue.current.length === 0) {
          setPendingSelection(null)
          onUpdated(latest)
          if (result.suggested_polls.length > 0) onSuggestedPolls(result.suggested_polls)
        } else {
          const optimisticSelection = voteOptimisticSelection.current
          setPendingSelection(optimisticSelection)
          onUpdated(pollWithSelection(latest, user, optimisticSelection))
        }
      } catch (reason) {
        voteQueue.current.shift()
        const optimisticSelection = voteQueue.current.reduce(
          (selection, queuedMutation) => togglePollSelection(selection, queuedMutation.optionId, poll.allow_multiple),
          [...voteServerSelection.current],
        )
        voteOptimisticSelection.current = optimisticSelection
        setPendingSelection(voteQueue.current.length > 0 ? optimisticSelection : null)
        setVoteErrorOptionIds((current) => new Set([...current, ...mutation.changedOptionIds]))
        const message = pollErrorMessage(reason)
        if (onError) onError(message)
        else setError(message)
        updatePendingVoteIds()
        capturePositions()
        if (voteQueue.current.length === 0) onUpdated(voteServerPoll.current)
        else onUpdated(pollWithSelection(voteServerPoll.current, user, optimisticSelection))
      }
    }
    voteProcessing.current = false
    updatePendingVoteIds()
  }, [capturePositions, identifier, onError, onSuggestedPolls, onUpdated, poll.allow_multiple, updatePendingVoteIds, user])

  useEffect(() => {
    if (votePendingOptionIds.size > 0 || poll.closed) return
    let active = true
    const refresh = () => {
      if (!active || votePendingOptionIds.size > 0 || pendingSelection || document.visibilityState === 'hidden') return
      void getPoll(identifier).then((latest) => {
        if (!active) return
        capturePositions()
        onUpdated(latest)
      }).catch(() => undefined)
    }
    const interval = window.setInterval(refresh, POLL_REFRESH_INTERVAL_MS)
    return () => { active = false; window.clearInterval(interval) }
  }, [capturePositions, identifier, onUpdated, pendingSelection, poll.closed, votePendingOptionIds.size])

  useEffect(() => () => {
    if (loginPromptTimer.current !== null) window.clearTimeout(loginPromptTimer.current)
  }, [])

  useEffect(() => {
    if (voteQueue.current.length === 0 && !voteProcessing.current && pendingSelection === null) {
      voteServerPoll.current = poll
      voteServerSelection.current = poll.selected_options ?? []
      voteOptimisticSelection.current = poll.selected_options ?? []
    }
  }, [pendingSelection, poll])

  const toggle = (optionId: string) => {
    if (!user) {
      if (loginPromptTimer.current !== null) window.clearTimeout(loginPromptTimer.current)
      setLoginPromptOptionId(optionId)
      loginPromptTimer.current = window.setTimeout(() => {
        loginPromptTimer.current = null
        setLoginPromptOptionId(null)
        onLogin()
      }, LOGIN_PROMPT_SHAKE_MS)
      return
    }
    const previousSelection = voteOptimisticSelection.current
    const next = togglePollSelection(previousSelection, optionId, poll.allow_multiple)
    voteOptimisticSelection.current = next
    voteQueue.current.push({ optionId, changedOptionIds: changedOptionIds(previousSelection, next) })
    updatePendingVoteIds()
    capturePositions()
    setPendingSelection(next)
    setError('')
    onUpdated(pollWithSelection(poll, user, next))
    void processVoteQueue()
  }

  const clearVoteError = (optionId: string) => {
    setVoteErrorOptionIds((current) => {
      if (!current.has(optionId)) return current
      const next = new Set(current)
      next.delete(optionId)
      return next
    })
  }

  return { selected: pendingSelection ?? poll.selected_options ?? [], votePendingOptionIds, voteErrorOptionIds, loginPromptOptionId, error, toggle, clearVoteError }
}
