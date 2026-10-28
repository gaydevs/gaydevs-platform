// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useAuth } from './features/auth/useAuth'
import { useLoginHash, type LoginStep } from './features/auth/useLoginHash'
import { getPoll, listPolls, type PollListResponse } from './features/pollsApi'

vi.mock('./features/auth/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('./features/auth/useLoginHash', () => ({ useLoginHash: vi.fn() }))
vi.mock('./features/pollsApi', () => ({
  addPollOption: vi.fn(),
  createPoll: vi.fn(),
  getPoll: vi.fn(),
  getPollAudit: vi.fn(),
  listPolls: vi.fn(() => new Promise(() => undefined)),
  pollErrorMessage: vi.fn(() => 'erro'),
  submitPoll: vi.fn(),
}))
vi.mock('./features/auth/LoginDialog', () => ({
  LoginDialog: ({ onClose, onAuthenticated }: { onClose: () => void; onAuthenticated: () => Promise<unknown> }) => <div role="dialog">
    <button type="button" onClick={onClose}>fechar login</button>
    <button type="button" onClick={async () => { await onAuthenticated(); onClose() }}>concluir login</button>
  </div>,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.history.replaceState(null, '', '/')
})

describe('poll landing authentication', () => {
  it('keeps the list skeleton behind automatic login and redirects home when canceled', async () => {
    window.history.replaceState(null, '', '/gaydevs/platform/polls')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    vi.mocked(useAuth).mockReturnValue({ user: null, restoring: false, refresh: vi.fn(), logout: vi.fn() })
    const open = vi.fn()
    vi.mocked(useLoginHash).mockImplementation(() => {
      const [step, setStep] = useState<LoginStep | null>(null)

      return {
        step,
        open: () => { open(); setStep('search') },
        showStep: (nextStep) => setStep(nextStep),
        close: () => setStep(null),
      }
    })
    const ui = userEvent.setup()

    render(<App />)

    await waitFor(() => expect(open).toHaveBeenCalledOnce())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(document.querySelector('.poll-loading')).toBeInTheDocument()

    await ui.click(screen.getByRole('button', { name: 'fechar login' }))
    await waitFor(() => expect(window.location.pathname).toBe('/gaydevs/platform'))
    expect(document.querySelector('.poll-loading')).not.toBeInTheDocument()
  })

  it('keeps the list skeleton while a successful login loads the polls', async () => {
    window.history.replaceState(null, '', '/gaydevs/platform/polls')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const authenticatedUser = { id: 'user-1', name: 'Luciano Vettoretti', member_type: 'member' as const }
    vi.mocked(useAuth).mockImplementation(() => {
      const [user, setUser] = useState<typeof authenticatedUser | null>(null)

      return {
        user,
        restoring: false,
        refresh: async () => { setUser(authenticatedUser); return authenticatedUser },
        logout: async () => { setUser(null) },
      }
    })
    vi.mocked(useLoginHash).mockImplementation(() => {
      const [step, setStep] = useState<LoginStep | null>(null)

      return {
        step,
        open: () => setStep('search'),
        showStep: (nextStep) => setStep(nextStep),
        close: () => setStep(null),
      }
    })
    const ui = userEvent.setup()

    render(<App />)

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    await ui.click(screen.getByRole('button', { name: 'concluir login' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.querySelector('.poll-loading')).toBeInTheDocument()
  })

  it('restores the fixed polls submenu after returning from a poll and scrolling', async () => {
    window.history.replaceState(null, '', '/gaydevs/platform/polls/qual-jogo')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'user-1', name: 'Luciano Vettoretti', member_type: 'member' }, restoring: false, refresh: vi.fn(), logout: vi.fn() })
    vi.mocked(useLoginHash).mockReturnValue({ step: null, open: vi.fn(), showStep: vi.fn(), close: vi.fn() })
    vi.mocked(getPoll).mockResolvedValue({
      id: 'poll-1', slug: 'qual-jogo', question: 'Qual jogo?', created_at: '2026-10-27T10:00:00.000Z',
      creator: { id: 'creator', name: 'Criador' }, started_at: '2026-10-27T10:00:00.000Z', started_on: null,
      allow_multiple: false, allow_new_options: false, closed: false, closed_at: null, has_votes: false,
      total_votes: 0, message: null, selected_options: [], options: [],
    })
    let resolveList: ((value: PollListResponse) => void) | undefined
    vi.mocked(listPolls).mockReturnValue(new Promise((resolve) => { resolveList = resolve }))

    const ui = userEvent.setup()
    render(<App />)

    await waitFor(() => expect(screen.getByRole('link', { name: 'abrir enquetes' })).toBeVisible())
    await ui.click(screen.getByRole('link', { name: 'abrir enquetes' }))

    resolveList?.({ polls: [], next_cursor: null, has_more: false, synced_at: '2026-10-27T12:00:00.000Z' })
    await waitFor(() => expect(screen.getByRole('heading', { name: '/gdevs/polls' })).toBeInTheDocument())

    const brandImage = document.querySelector('.polls-landing-heading img') as HTMLImageElement
    Object.defineProperty(brandImage, 'getBoundingClientRect', { configurable: true, value: () => ({ top: -300, bottom: -250, left: 0, right: 0, width: 0, height: 0 }) })
    window.dispatchEvent(new Event('scroll'))

    await waitFor(() => expect(document.querySelector('.section-submenu-bar')).toHaveClass('section-submenu-bar--visible'))
  })
})
