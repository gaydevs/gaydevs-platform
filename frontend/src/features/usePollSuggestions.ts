import { useState } from 'react'
import { dismissPollSuggestion, snoozePollSuggestions } from './userPreferencesApi'
import { pollErrorMessage, type PollSuggestion } from './pollsApi'

export function usePollSuggestions(onError?: (message: string) => void) {
  const [suggestions, setSuggestions] = useState<PollSuggestion[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  const show = (next: PollSuggestion[]) => {
    setSuggestions(next)
    setDialogOpen(false)
  }
  const clear = () => {
    setSuggestions([])
    setDialogOpen(false)
  }
  const open = () => setDialogOpen(true)
  const snooze = async () => {
    await snoozePollSuggestions(24)
  }
  const dismiss = async (pollId: string) => {
    try {
      await dismissPollSuggestion(pollId)
      setSuggestions((current) => current.filter((suggestion) => suggestion.id !== pollId))
    } catch (reason) {
      onError?.(pollErrorMessage(reason))
    }
  }

  return { suggestions, dialogOpen, show, clear, open, snooze, dismiss }
}
