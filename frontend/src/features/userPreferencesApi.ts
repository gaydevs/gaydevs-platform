import { ApiError, request } from './auth/api'

export interface UserPreferences {
  polls: {
    suggestions: {
      snooze_until: string | null
      not_interested_poll_ids: string[]
    }
  }
}

interface PreferencesResponse { preferences: UserPreferences }

export async function getUserPreferences(): Promise<UserPreferences> {
  return (await request<PreferencesResponse>('me/preferences')).preferences
}

export async function snoozePollSuggestions(hours = 24): Promise<UserPreferences> {
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) {
    throw new ApiError('O adiamento das sugestões deve durar entre 1 e 24 horas.', 422, undefined, undefined, {
      hours: ['O adiamento das sugestões deve durar entre 1 e 24 horas.'],
    })
  }
  return (await request<PreferencesResponse>('me/preferences/poll-suggestions/snooze', {
    method: 'POST',
    body: JSON.stringify({ hours }),
  }, true)).preferences
}

export async function dismissPollSuggestion(pollId: string): Promise<UserPreferences> {
  return (await request<PreferencesResponse>('me/preferences/poll-suggestions/dismiss', {
    method: 'POST',
    body: JSON.stringify({ poll_id: pollId }),
  }, true)).preferences
}
