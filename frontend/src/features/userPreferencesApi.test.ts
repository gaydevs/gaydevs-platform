// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { dismissPollSuggestion, snoozePollSuggestions } from './userPreferencesApi'

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0'
})

describe('user preferences API', () => {
  it('sends the approved snooze duration with CSRF protection', async () => {
    document.cookie = 'XSRF-TOKEN=token'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        preferences: { polls: { suggestions: { snooze_until: '2026-10-28T12:00:00Z', not_interested_poll_ids: [] } } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(snoozePollSuggestions(24)).resolves.toMatchObject({ polls: { suggestions: { snooze_until: expect.any(String) } } })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/sanctum/csrf-cookie')
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBe(JSON.stringify({ hours: 24 }))
  })

  it('sends a dismissed poll id with CSRF protection', async () => {
    document.cookie = 'XSRF-TOKEN=token'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        preferences: { polls: { suggestions: { snooze_until: null, not_interested_poll_ids: ['poll-id'] } } },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(dismissPollSuggestion('poll-id')).resolves.toMatchObject({ polls: { suggestions: { not_interested_poll_ids: ['poll-id'] } } })
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBe(JSON.stringify({ poll_id: 'poll-id' }))
  })

  it.each([0, 25, 24.5])('rejects a snooze outside the 1–24 hour range before calling the API', async (hours) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(snoozePollSuggestions(hours)).rejects.toMatchObject({ status: 422 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
