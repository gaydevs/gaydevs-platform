// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { useAuth } from './features/auth/useAuth'
import { useLoginHash, type LoginStep } from './features/auth/useLoginHash'
import { getPoll, listPolls, type PollListResponse } from './features/pollsApi'
import { getMemberNote, listNoteMembers, saveMemberNote, type MemberNote } from './features/notesApi'
import { NoteVersionConflict } from './features/noteVersion'
import { readHistory } from './navigation/history'

vi.mock('./features/notesApi', () => ({ getMemberNote: vi.fn(), listNoteMembers: vi.fn(), saveMemberNote: vi.fn() }))
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


describe('notes navigation while autosave is pending', () => {
  const base = '/gaydevs/platform/notes'
  const member = { id: 'gdev-1', name: 'Gdev Exemplo', preview: 'Texto' }
  function setup() {
    window.history.replaceState(null, '', base)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const logout = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'admin', name: 'Admin', member_type: 'admin' }, restoring: false, refresh: vi.fn(), logout })
    vi.mocked(useLoginHash).mockReturnValue({ step: null, open: vi.fn(), showStep: vi.fn(), close: vi.fn() })
    vi.mocked(listNoteMembers).mockResolvedValue([member])
    vi.mocked(getMemberNote).mockResolvedValue({ member, content: 'Texto', version: 1 })
    let resolveSave!: (value: MemberNote) => void
    vi.mocked(saveMemberNote).mockImplementation(() => new Promise(resolve => { resolveSave = resolve }))
    render(<App />)
    return { logout, finish: () => resolveSave({ member, content: 'Texto novo', version: 2 }) }
  }
  async function edit() {
    await userEvent.click(await screen.findByRole('button', { name: /Gdev Exemplo/ }))
    const editor = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
    fireEvent.paste(editor, { clipboardData: { getData: () => ' novo' } })
  }

  it('guards the section link and resumes navigation after saving', async () => {
    const { finish } = setup()
    await edit()
    await userEvent.click(screen.getByRole('link', { name: 'abrir anotações' }))
    const dialog = await screen.findByRole('dialog', { name: 'Salvando anotação' })
    expect(window.location.pathname).toBe(base + '/gdev-1')
    await userEvent.click(within(dialog).getByRole('button', { name: 'cancelar saída' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.pathname).toBe(base + '/gdev-1')
    await userEvent.click(screen.getByRole('link', { name: 'abrir anotações' }))
    await screen.findByRole('dialog')
    await act(async () => finish())
    await waitFor(() => expect(window.location.pathname).toBe(base))
    expect(await screen.findByRole('heading', { name: '/gdevs/notes' })).toBeInTheDocument()
  }, 15000)

  it('restores history while saving, then resumes the original back navigation', async () => {
    const { finish } = setup()
    await edit()
    act(() => window.history.back())
    await screen.findByRole('dialog', { name: 'Salvando anotação' })
    await waitFor(() => expect(window.location.pathname).toBe(base + '/gdev-1'))
    await act(async () => finish())
    await waitFor(() => expect(window.location.pathname).toBe(base))
    expect(await screen.findByRole('heading', { name: '/gdevs/notes' })).toBeInTheDocument()
  }, 15000)

  it('guards logout and proceeds only after saving', async () => {
    const { finish, logout } = setup()
    await edit()
    await userEvent.click(screen.getByRole('button', { name: 'abrir menu' }))
    await userEvent.click(screen.getByRole('button', { name: 'sair' }))
    await screen.findByRole('dialog', { name: 'Salvando anotação' })
    expect(logout).not.toHaveBeenCalled()
    await act(async () => finish())
    await waitFor(() => expect(logout).toHaveBeenCalledOnce())
  }, 15000)


  it('recovers editing and navigation protection when ignored logout fails', async () => {
    const { finish, logout } = setup()
    let rejectLogout!: (error: Error) => void
    logout.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectLogout = reject }))
    await edit()
    await userEvent.click(screen.getByRole('button', { name: 'abrir menu' }))
    await userEvent.click(screen.getByRole('button', { name: 'sair' }))
    const dialog = await screen.findByRole('dialog', { name: 'Salvando anotação' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ignorar' }))
    expect(logout).toHaveBeenCalledOnce()
    const editor = screen.getByRole('textbox', { name: 'Anotações' })
    fireEvent.paste(editor, { clipboardData: { getData: () => ' durante logout' } })
    expect(saveMemberNote).toHaveBeenCalledOnce()
    await act(async () => rejectLogout(new Error('Logout failed')))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível sair. Tente novamente.')
    expect(screen.getByRole('textbox', { name: 'Anotações' })).toBeInTheDocument()
    await act(async () => finish())
    // Leaving before the restored debounce expires must be guarded again.
    await userEvent.click(screen.getByRole('link', { name: 'abrir anotações' }))
    const restored = await screen.findByRole('dialog', { name: 'Salvando anotação' })
    expect(restored).toBeInTheDocument()
    expect(saveMemberNote).toHaveBeenCalledTimes(2)
    expect(vi.mocked(saveMemberNote).mock.calls[1][2]).toContain('durante logout')
    await act(async () => finish())
    await waitFor(() => expect(window.location.pathname).toBe(base))
    expect(logout).toHaveBeenCalledOnce()
  }, 15000)

  it('reports logout failure after a confirmed save without disabling subsequent autosave', async () => {
    const { finish, logout } = setup()
    logout.mockRejectedValueOnce(new Error('Logout failed'))
    await edit()
    await userEvent.click(screen.getByRole('button', { name: 'abrir menu' }))
    await userEvent.click(screen.getByRole('button', { name: 'sair' }))
    await screen.findByRole('dialog', { name: 'Salvando anotação' })
    await act(async () => finish())
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível sair. Tente novamente.')
    const editor = screen.getByRole('textbox', { name: 'Anotações' })
    fireEvent.paste(editor, { clipboardData: { getData: () => ' nova edição' } })
    await waitFor(() => expect(saveMemberNote).toHaveBeenCalledTimes(2), { timeout: 4000 })
    expect(vi.mocked(saveMemberNote).mock.calls[1][2]).toContain('nova edição')
    await act(async () => finish())
  }, 15000)

  it('keeps the original Back destination pending until a conflict is resolved', async () => {
    setup()
    vi.mocked(saveMemberNote).mockRejectedValueOnce(new NoteVersionConflict({ member, content: 'Remoto', version: 2 }))
      .mockImplementationOnce(async (_actor, _member, content) => ({ member, content, version: 3 }))
    await edit()
    act(() => window.history.back())
    const conflict = await screen.findByRole('dialog', { name: 'Conflito de anotação' })
    await waitFor(() => expect(window.location.pathname).toBe(base + '/gdev-1'))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(conflict).toBeInTheDocument()
    expect(saveMemberNote).toHaveBeenCalledOnce()
    await userEvent.click(within(conflict).getByRole('button', { name: 'Sobrescrever' }))
    await waitFor(() => expect(window.location.pathname).toBe(base))
    expect(vi.mocked(saveMemberNote).mock.calls.map(call => call[3])).toEqual([1, 2])
    expect(await screen.findByRole('heading', { name: '/gdevs/notes' })).toBeInTheDocument()
  }, 15000)

  it('does not logout while a conflicting note awaits a decision', async () => {
    const { logout } = setup()
    vi.mocked(saveMemberNote).mockRejectedValueOnce(new NoteVersionConflict({ member, content: 'Remoto', version: 2 }))
    await edit()
    await userEvent.click(screen.getByRole('button', { name: 'abrir menu' }))
    await userEvent.click(screen.getByRole('button', { name: 'sair' }))
    const conflict = await screen.findByRole('dialog', { name: 'Conflito de anotação' })
    expect(logout).not.toHaveBeenCalled()
    vi.mocked(getMemberNote).mockResolvedValue({ member, content: 'Remoto', version: 2 })
    await userEvent.click(within(conflict).getByRole('button', { name: 'Recarregar' }))
    await waitFor(() => expect(logout).toHaveBeenCalledOnce())
    expect(saveMemberNote).toHaveBeenCalledOnce()
  }, 15000)

  it.each(['section', 'back', 'logout'])('ignores a pending save and resumes %s immediately', async destination => {
    const { finish, logout } = setup()
    await edit()
    if (destination === 'section') await userEvent.click(screen.getByRole('link', { name: 'abrir anotações' }))
    else if (destination === 'back') act(() => window.history.back())
    else {
      await userEvent.click(screen.getByRole('button', { name: 'abrir menu' }))
      await userEvent.click(screen.getByRole('button', { name: 'sair' }))
    }
    const dialog = await screen.findByRole('dialog', { name: 'Salvando anotação' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ignorar' }))
    if (destination === 'logout') await waitFor(() => expect(logout).toHaveBeenCalledOnce())
    else {
      await waitFor(() => expect(window.location.pathname).toBe(base))
      await waitFor(() => expect(listNoteMembers).toHaveBeenCalledTimes(2))
    }
    await act(async () => finish())
    expect(saveMemberNote).toHaveBeenCalledOnce()
    if (destination === 'logout') expect(logout).toHaveBeenCalledOnce()
  }, 15000)

})


describe('notes required login', () => {
  const base = '/gaydevs/platform/notes'
  const member = { id: 'ana', name: 'Ana' }
  async function setup(path: string, role: 'admin' | 'member') {
    window.history.replaceState(null, '', path)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const actual = await vi.importActual<typeof import('./features/auth/useLoginHash')>('./features/auth/useLoginHash')
    vi.mocked(useLoginHash).mockImplementation(actual.useLoginHash)
    const logged = { id: 'author', name: 'Autor', member_type: role }
    vi.mocked(useAuth).mockImplementation(() => {
      const [user, setUser] = useState<typeof logged | null>(null)
      return { user, restoring: false, refresh: async () => { setUser(logged); return logged }, logout: async () => setUser(null) }
    })
    vi.mocked(listNoteMembers).mockResolvedValue([member])
    vi.mocked(getMemberNote).mockResolvedValue({ member, content: 'Texto privado', version: 1 })
    render(<App />)
    await screen.findByRole('dialog')
    expect(window.location.hash).toBe('#login')
    expect(screen.getByRole('status', { name: path === base ? 'Carregando gdevs' : 'Carregando anotação' })).toBeInTheDocument()
    expect(listNoteMembers).not.toHaveBeenCalled()
    expect(getMemberNote).not.toHaveBeenCalled()
  }


  it.each(['save', 'ignore', 'cancel'])('crosses the real login entry with pending changes and %s', async action => {
    await setup(base, 'admin')
    await userEvent.click(screen.getByRole('button', { name: 'concluir login' }))
    let finish!: (value: MemberNote) => void
    vi.mocked(saveMemberNote).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await userEvent.click(await screen.findByRole('button', { name: /Ana/ }))
    const editor = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
    fireEvent.paste(editor, { clipboardData: { getData: () => ' novo' } })
    const entry = readHistory()
    act(() => window.history.go(-2))
    const dialog = await screen.findByRole('dialog', { name: 'Salvando anotação' })
    await waitFor(() => expect(readHistory().position?.key).toBe(entry.position?.key))
    expect(window.location.pathname).toBe(base + '/ana')
    expect(editor).toBeInTheDocument()
    if (action === 'cancel') {
      await userEvent.click(within(dialog).getByRole('button', { name: 'cancelar saída' }))
      await act(async () => finish({ member, content: 'Texto privado novo', version: 2 }))
      expect(window.location.pathname).toBe(base + '/ana')
      expect(editor).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    } else {
      if (action === 'ignore') await userEvent.click(within(dialog).getByRole('button', { name: 'Ignorar' }))
      await act(async () => finish({ member, content: 'Texto privado novo', version: 2 }))
      await waitFor(() => expect(window.location.pathname).toBe(base))
      expect(await screen.findByRole('button', { name: /Ana/ })).toBeInTheDocument()
      expect(readHistory().position?.index).toBe((entry.position?.index ?? 0) - 2)
    }
  }, 15000)

  it.each([base, base + '/ana'])('cancel redirects %s to platform home', async path => {
    await setup(path, 'admin')
    await userEvent.click(screen.getByRole('button', { name: 'fechar login' }))
    await waitFor(() => expect(window.location.pathname).toBe('/gaydevs/platform'))
    expect(window.location.hash).toBe('')
    expect(listNoteMembers).not.toHaveBeenCalled()
    expect(getMemberNote).not.toHaveBeenCalled()
  }, 15000)

  it.each([base, base + '/ana'])('admin returns to original route %s', async path => {
    await setup(path, 'admin')
    await userEvent.click(screen.getByRole('button', { name: 'concluir login' }))
    if (path === base) expect(await screen.findByRole('button', { name: /Ana/ })).toBeInTheDocument()
    else expect(await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })).toHaveTextContent('Texto privado')
    expect(window.location.pathname).toBe(path)
    expect(window.location.hash).toBe('')
  }, 15000)

  it.each([base, base + '/ana'])('non-admin receives restricted area after login at %s', async path => {
    await setup(path, 'member')
    await userEvent.click(screen.getByRole('button', { name: 'concluir login' }))
    const restricted = await screen.findByRole('dialog', { name: 'Área restrita' })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('status', { name: path === base ? 'Carregando gdevs' : 'Carregando anotação' })).toBeInTheDocument()
    expect(window.location.pathname).toBe(path)
    expect(window.location.hash).toBe('')
    expect(listNoteMembers).not.toHaveBeenCalled()
    expect(getMemberNote).not.toHaveBeenCalled()
    await userEvent.click(within(restricted).getByRole('button', { name: 'Home' }))
    await waitFor(() => expect(window.location.pathname).toBe('/gaydevs/platform'))
    expect(screen.queryByRole('dialog', { name: 'Área restrita' })).not.toBeInTheDocument()
  }, 15000)
})

describe('route identifier normalization', () => {
  function setup(path: string) {
    window.history.replaceState(null, '', '/gaydevs/platform' + path)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    vi.mocked(useAuth).mockReturnValue({ user: { id: 'admin', name: 'Admin', member_type: 'admin' }, restoring: false, refresh: vi.fn(), logout: vi.fn() })
    vi.mocked(useLoginHash).mockReturnValue({ step: null, open: vi.fn(), showStep: vi.fn(), close: vi.fn() })
    vi.mocked(listNoteMembers).mockResolvedValue([])
    vi.mocked(listPolls).mockResolvedValue({ polls: [], next_cursor: null, has_more: false, synced_at: '2026-11-27T12:00:00Z' })
    vi.mocked(getMemberNote).mockResolvedValue({ member: { id: 'ana', name: 'Ana' }, content: 'Texto', version: 1 })
    vi.mocked(getPoll).mockResolvedValue({
      id: 'poll-1', slug: 'qual-jogo', question: 'Qual jogo?', created_at: '2026-10-27T10:00:00.000Z',
      creator: { id: 'creator', name: 'Criador' }, started_at: '2026-10-27T10:00:00.000Z', started_on: null,
      allow_multiple: false, allow_new_options: false, closed: false, closed_at: null, has_votes: false,
      total_votes: 0, message: null, selected_options: [], options: [],
    })
    render(<App />)
  }

  it('opens the notes list with redundant trailing slashes', async () => {
    setup('/notes///')
    await waitFor(() => expect(listNoteMembers).toHaveBeenCalledWith('admin', expect.any(AbortSignal)))
    expect(getMemberNote).not.toHaveBeenCalled()
  })

  it('opens the correct note with redundant boundary slashes', async () => {
    setup('/notes///ana///')
    await waitFor(() => expect(getMemberNote).toHaveBeenCalledWith('admin', 'ana', expect.any(AbortSignal)))
    expect(await screen.findByRole('textbox', { name: 'Anotações' })).toHaveTextContent('Texto')
  })

  it('opens the polls list with redundant trailing slashes', async () => {
    setup('/polls///')
    await waitFor(() => expect(listPolls).toHaveBeenCalled())
    expect(getPoll).not.toHaveBeenCalled()
  })

  it('opens the correct poll with redundant boundary slashes', async () => {
    setup('/polls///qual-jogo///')
    await waitFor(() => expect(getPoll).toHaveBeenCalledWith('qual-jogo'))
  })
})
