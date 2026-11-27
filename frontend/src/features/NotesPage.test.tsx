// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from './auth/api'
import { NotesPage } from './NotesPage'
import { NoteRichEditor } from './NoteRichEditor'
import { NoteEditorLoading } from './NotesLoadingStates'
// @ts-expect-error Node.js filesystem access is only used by this Vitest test.
import { readFileSync } from 'node:fs'
import { getMemberNote, listNoteMembers, saveMemberNote } from './notesApi'
import type { LeaveGuard } from './useNoteAutosave'

vi.mock('./notesApi', () => ({ getMemberNote: vi.fn(), listNoteMembers: vi.fn(), saveMemberNote: vi.fn() }))
const admin = { id: 'admin', name: 'Admin', member_type: 'admin' }
const member = { id: 'ana', name: 'Ana Silva', preview: 'Desenvolvimento backend' }
const base = '/gaydevs/platform/notes'

afterEach(cleanup)
beforeEach(() => { vi.resetAllMocks() })

test.each([null, 'ana'])('denies direct access on %s with modal and skeleton, without fetching notes', memberId => {
  const onNavigate = vi.fn()
  render(<NotesPage memberId={memberId} base={base} user={{ ...member, member_type: 'member' }} restoring={false} onNavigate={onNavigate} />)
  const dialog = screen.getByRole('dialog', { name: 'Área restrita' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(screen.getByRole('status', { name: memberId ? 'Carregando anotação' : 'Carregando gdevs' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(getMemberNote).not.toHaveBeenCalled()
  expect(listNoteMembers).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Home' }))
  expect(onNavigate).toHaveBeenCalledWith('/gaydevs/platform')
})

test('shows alphabetical cards with previews and navigates to a member', async () => {
  vi.mocked(listNoteMembers).mockResolvedValue([{ id: 'z', name: 'Zeta' }, member])
  const navigate = vi.fn()
  render(<NotesPage memberId={null} base={base} user={admin} restoring={false} onNavigate={navigate} />)
  expect(screen.getByRole('heading', { name: '/gdevs/notes' })).toBeInTheDocument()
  const buttons = await screen.findAllByRole('button')
  expect(buttons[0]).toHaveTextContent('Ana Silva')
  expect(within(buttons[0]).getByText('AS')).toBeInTheDocument()
  expect(within(buttons[0]).getByText('Desenvolvimento backend')).toBeInTheDocument()
  expect(buttons[1]).toHaveTextContent('Zeta')
  expect(buttons[1].querySelector('.notes-card__preview')).toBeNull()
  expect(screen.queryByText('Sem anotações')).not.toBeInTheDocument()
  await userEvent.click(buttons[0])
  expect(navigate).toHaveBeenCalledWith(base + '/ana')
})

test('renders Markdown as formatted editable text without HTML execution', async () => {
  const { container } = render(<NoteRichEditor content={'## Título\n\n**Texto**\n\n<img src=x onerror=alert(1)>'} onChange={vi.fn()} />)
  await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument()
  expect(screen.getByText('Texto').tagName).toBe('STRONG')
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('[onerror]')).toBeNull()
})

test('automatically saves a visual edit, without a save button', async () => {
  vi.mocked(getMemberNote).mockResolvedValue({ member, content: 'Texto' })
  let resolveSave!: (value: { member: typeof member; content: string }) => void
  vi.mocked(saveMemberNote).mockImplementation(() => new Promise(resolve => { resolveSave = resolve }))
  render(<NotesPage memberId="ana" base={base} user={admin} restoring={false} onNavigate={vi.fn()} />)
  const editor = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  editor.focus()
  // Pasting plain text exercises the actual Tiptap transaction without jsdom selection layout.
  fireEvent.paste(editor, { clipboardData: { getData: () => ' novo' } })
  expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  await waitFor(() => expect(saveMemberNote).toHaveBeenCalled(), { timeout: 2500 })
  expect(screen.queryByText(/salvando|anotação salva/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await act(async () => resolveSave({ member, content: 'Texto novo' }))
  expect(screen.queryByText(/salvando|anotação salva/i)).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('blocks exit during unsaved changes, permits cancel and retry after failure', async () => {
  vi.mocked(getMemberNote).mockResolvedValue({ member, content: 'Texto' })
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new Error('network')).mockResolvedValue({ member, content: 'Texto novo' })
  let guard: LeaveGuard | undefined
  const registerGuard = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const proceed = vi.fn()
  render(<NotesPage memberId="ana" base={base} user={admin} restoring={false} onNavigate={vi.fn()} registerGuard={registerGuard} />)
  const editor = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  fireEvent.paste(editor, { clipboardData: { getData: () => ' novo' } })
  act(() => { expect(guard?.(proceed)).toBe(true) })
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByRole('button', { name: 'Tentar de novo' })
  expect(proceed).not.toHaveBeenCalled()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(proceed).not.toHaveBeenCalled()
  expect(screen.queryByText('Não foi possível salvar')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  act(() => { expect(guard?.(proceed)).toBe(true) })
  await waitFor(() => expect(proceed).toHaveBeenCalledOnce())
})

test('omits the preview entirely for empty or whitespace-only notes', async () => {
  vi.mocked(listNoteMembers).mockResolvedValue([{ id: 'a', name: 'A', preview: '' }, { id: 'b', name: 'B', preview: '   ' }, { id: 'c', name: 'C' }])
  const { container } = render(<NotesPage memberId={null} base={base} user={admin} restoring={false} onNavigate={vi.fn()} />)
  await screen.findAllByRole('button')
  expect(container.querySelectorAll('.notes-card__preview')).toHaveLength(0)
  expect(screen.queryByText('Sem anotações')).not.toBeInTheDocument()
})

test('card name aligns its first line with the avatar, independent of wrapping and preview', async () => {
  const name = 'Nome Comprido Que Pode Quebrar Em Duas Linhas'
  vi.mocked(listNoteMembers).mockResolvedValue([{ id: 'long', name, preview: 'Prévia' }])
  render(<NotesPage memberId={null} base={base} user={admin} restoring={false} onNavigate={vi.fn()} />)
  const card = await screen.findByRole('button', { name: /Nome Comprido/ })
  const avatar = card.querySelector('.notes-avatar')
  const title = within(card).getByText(name)
  expect(avatar?.parentElement).toBe(card)
  expect(title.parentElement?.className).toBe('notes-card__body')
  // CSS contract: same avatar dimension and first-line height, not centered on the whole wrapped block.
  const styles = readFileSync('src/styles/global.css', 'utf8')
  expect(styles).toMatch(/\.notes-card\s*\{[^}]*--notes-avatar-size:\s*48px;[^}]*align-items:\s*flex-start/)
  expect(styles).toMatch(/\.notes-avatar\s*\{[^}]*height:\s*var\(--notes-avatar-size, 48px\)/)
  expect(styles).toMatch(/\.notes-card__name\s*\{[^}]*line-height:\s*1\.25;[^}]*padding-top:\s*max\(0px, calc\(\(var\(--notes-avatar-size\) - 1\.25em\) \/ 2\)\)/)
})

test('list displays shimmering card skeletons until the request resolves', async () => {
  let resolveList!: (value: typeof member[]) => void
  vi.mocked(listNoteMembers).mockImplementation(() => new Promise(resolve => { resolveList = resolve }))
  const { container } = render(<NotesPage memberId={null} base={base} user={admin} restoring={false} onNavigate={vi.fn()} />)
  const loading = screen.getByRole('status', { name: 'Carregando gdevs' })
  expect(loading).toHaveAttribute('aria-busy', 'true')
  expect(loading.querySelectorAll('.poll-loading-card')).toHaveLength(3)
  expect(loading.querySelector('.poll-loading__shine')).not.toBeNull()
  expect(loading).not.toHaveTextContent('Carregando')
  await act(async () => resolveList([member]))
  expect(screen.queryByRole('status', { name: 'Carregando gdevs' })).not.toBeInTheDocument()
  expect(container.querySelector('.notes-list-loading')).toBeNull()
  expect(await screen.findByRole('button', { name: /Ana Silva/ })).toBeInTheDocument()
})

test('responsive grid defines one, two and three equally sized columns at the intended breakpoints', () => {
  const styles = readFileSync('src/styles/global.css', 'utf8')
  expect(styles).toMatch(/\.notes-list\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);\s*\}/)
  expect(styles).toMatch(/@media\s*\(min-width:\s*640px\)\s*\{\s*\.notes-list\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);\s*\}\s*\}/)
  expect(styles).toMatch(/@media\s*\(min-width:\s*1024px\)\s*\{\s*\.notes-list\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);\s*\}\s*\}/)
  expect(styles).toMatch(/\.notes-card__preview\s*\{[^}]*-webkit-line-clamp:\s*2;[^}]*overflow:\s*hidden/)
})

test('loading and loaded cards share the responsive grid and maintain alphabetical DOM and keyboard order', async () => {
  const members = [
    { id: 'f', name: 'Fernanda' },
    { id: 'c', name: 'Caio', preview: 'Prévia longa de anotação' },
    { id: 'e', name: 'Eduardo' },
    { id: 'a', name: 'Ana Silva', preview: 'Backend' },
    { id: 'd', name: 'Daniel' },
    { id: 'b', name: 'Bruno' },
  ]
  let resolveList!: (value: typeof members) => void
  vi.mocked(listNoteMembers).mockImplementation(() => new Promise(resolve => { resolveList = resolve }))
  const { container } = render(<NotesPage memberId={null} base={base} user={admin} restoring={false} onNavigate={vi.fn()} />)
  const loading = screen.getByRole('status', { name: 'Carregando gdevs' })
  expect(loading).toHaveClass('poll-list', 'notes-list')
  expect(loading.querySelectorAll(':scope > .notes-card')).toHaveLength(3)
  await act(async () => resolveList(members))
  const list = container.querySelector('.notes-list')
  expect(list).toHaveClass('poll-list', 'notes-list')
  expect(list?.querySelectorAll(':scope > .notes-card')).toHaveLength(6)
  const cards = screen.getAllByRole('button')
  expect(cards.map(card => card.querySelector('.notes-card__name')?.textContent)).toEqual(['Ana Silva', 'Bruno', 'Caio', 'Daniel', 'Eduardo', 'Fernanda'])
  const user = userEvent.setup()
  for (const card of cards) {
    await user.tab()
    expect(card).toHaveFocus()
  }
})

test('detail displays name and editor skeletons while loading, then the actual note', async () => {
  let resolveNote!: (value: { member: typeof member; content: string }) => void
  vi.mocked(getMemberNote).mockImplementation(() => new Promise(resolve => { resolveNote = resolve }))
  render(<NotesPage memberId="ana" base={base} user={admin} restoring={false} onNavigate={vi.fn()} />)
  const loading = screen.getByRole('status', { name: 'Carregando anotação' })
  expect(loading.querySelector('.notes-loading-detail-name.poll-loading__shine')).not.toBeNull()
  expect(loading.querySelector('.notes-editor-loading .poll-loading__shine')).not.toBeNull()
  expect(loading).not.toHaveTextContent('Carregando')
  await act(async () => resolveNote({ member, content: 'Texto' }))
  await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  expect(screen.queryByRole('status', { name: 'Carregando anotação' })).not.toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Carregando editor' })).not.toBeInTheDocument()
})

test('session restoration uses the appropriate skeleton without querying private data', () => {
  const props = { base, user: null, restoring: true, onNavigate: vi.fn() }
  const { rerender } = render(<NotesPage {...props} memberId={null} />)
  expect(screen.getByRole('status', { name: 'Carregando gdevs' })).toBeInTheDocument()
  rerender(<NotesPage {...props} memberId="ana" />)
  expect(screen.getByRole('status', { name: 'Carregando anotação' })).toBeInTheDocument()
  expect(getMemberNote).not.toHaveBeenCalled()
  expect(listNoteMembers).not.toHaveBeenCalled()
})

test('editor fallback uses the same shimmer without visible loading text', () => {
  render(<NoteEditorLoading />)
  const loading = screen.getByRole('status', { name: 'Carregando editor' })
  expect(loading.querySelectorAll('.poll-loading__shine')).toHaveLength(3)
  expect(loading).not.toHaveTextContent('Carregando')
})

test('a background save failure stays silent until exit, and retry in modal completes navigation', async () => {
  vi.mocked(getMemberNote).mockResolvedValue({ member, content: 'Texto' })
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(new Error('network')).mockResolvedValue({ member, content: 'Texto novo' })
  let guard: LeaveGuard | undefined
  const registerGuard = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const proceed = vi.fn()
  render(<NotesPage memberId="ana" base={base} user={admin} restoring={false} onNavigate={vi.fn()} registerGuard={registerGuard} />)
  const editor = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  fireEvent.paste(editor, { clipboardData: { getData: () => ' novo' } })
  await waitFor(() => expect(saveMemberNote).toHaveBeenCalledTimes(1), { timeout: 2500 })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText(/não foi possível salvar/i)).not.toBeInTheDocument()
  act(() => { expect(guard?.(proceed)).toBe(true) })
  const dialog = await screen.findByRole('dialog')
  const retry = await within(dialog).findByRole('button', { name: 'Tentar de novo' })
  expect(proceed).not.toHaveBeenCalled()
  await userEvent.click(retry)
  await waitFor(() => expect(proceed).toHaveBeenCalledOnce())
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})


test('switching admins clears previews and ignores a late response for the previous admin', async () => {
  const other = { ...admin, id: 'admin-b' }
  let finish!: (value: typeof member[]) => void
  vi.mocked(listNoteMembers).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce([{ ...member, preview: 'Nota do segundo' }])
  const props = { base, memberId: null, restoring: false, onNavigate: vi.fn() }
  const { rerender } = render(<NotesPage {...props} user={admin} />)
  const signal = vi.mocked(listNoteMembers).mock.calls[0][1]
  rerender(<NotesPage {...props} user={other} />)
  expect(signal?.aborted).toBe(true)
  expect(await screen.findByText('Nota do segundo')).toBeInTheDocument()
  await act(async () => finish([{ ...member, preview: 'Nota do primeiro' }]))
  expect(screen.queryByText('Nota do primeiro')).not.toBeInTheDocument()
  expect(listNoteMembers).toHaveBeenLastCalledWith('admin-b', expect.any(AbortSignal))
})

test('switching admins removes the previous editor and cancels pending autosave', async () => {
  vi.mocked(getMemberNote).mockResolvedValueOnce({ member, content: 'Privado do primeiro' })
    .mockResolvedValueOnce({ member, content: 'Privado do segundo' })
  const props = { base, memberId: 'ana', restoring: false, onNavigate: vi.fn() }
  const { rerender } = render(<NotesPage {...props} user={admin} />)
  const editor = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  expect(editor).toHaveTextContent('Privado do primeiro')
  fireEvent.paste(editor, { clipboardData: { getData: () => ' edit' } })
  rerender(<NotesPage {...props} user={{ ...admin, id: 'admin-b' }} />)
  expect(editor).not.toBeInTheDocument()
  expect(await screen.findByText('Privado do segundo')).toBeInTheDocument()
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 800)) })
  expect(saveMemberNote).not.toHaveBeenCalled()
  expect(getMemberNote).toHaveBeenLastCalledWith('admin-b', 'ana', expect.any(AbortSignal))
})

test('session mismatch hides the old editor and instructs reload without offering retry', async () => {
  vi.mocked(getMemberNote).mockResolvedValue({ member, content: 'Private' })
  vi.mocked(saveMemberNote).mockRejectedValue(new ApiError('Sessão alterada', 409))
  let guard: LeaveGuard | undefined
  const registerGuard = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  render(<NotesPage memberId="ana" base={base} user={admin} restoring={false} onNavigate={vi.fn()} registerGuard={registerGuard} />)
  const editor = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  fireEvent.paste(editor, { clipboardData: { getData: () => ' edit' } })
  const proceed = vi.fn()
  act(() => { expect(guard?.(proceed)).toBe(true) })
  const dialog = await screen.findByRole('dialog', { name: 'Sessão alterada' })
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Recarregar' })).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  expect(proceed).not.toHaveBeenCalled()
})

test.each([null, 'ana'])('visitor sees the skeleton and requests login on route %s', memberId => {
  const onLogin = vi.fn()
  render(<NotesPage base={base} user={null} restoring={false} onNavigate={vi.fn()} onLogin={onLogin} memberId={memberId} />)
  expect(screen.getByRole('status', { name: memberId ? 'Carregando anotação' : 'Carregando gdevs' })).toBeInTheDocument()
  expect(screen.queryByText('Área restrita.')).not.toBeInTheDocument()
  expect(onLogin).toHaveBeenCalledOnce()
  expect(listNoteMembers).not.toHaveBeenCalled()
  expect(getMemberNote).not.toHaveBeenCalled()
})


test.each(['saving', 'error', 'session-changed'])('Ignorar leaves without confirmation in state %s', async state => {
  vi.mocked(getMemberNote).mockResolvedValue({ member, content: 'Texto' })
  let finish!: (result: { member: typeof member; content: string }) => void
  if (state === 'saving') vi.mocked(saveMemberNote).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  else vi.mocked(saveMemberNote).mockRejectedValue(state === 'error' ? new Error('network') : new ApiError('Sessão alterada', 409))
  let guard: LeaveGuard | undefined
  const registerGuard = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const proceed = vi.fn()
  render(<NotesPage memberId="ana" base={base} user={admin} restoring={false} onNavigate={vi.fn()} registerGuard={registerGuard} />)
  const editor = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  fireEvent.paste(editor, { clipboardData: { getData: () => ' novo' } })
  act(() => { expect(guard?.(proceed)).toBe(true) })
  const title = state === 'saving' ? 'Salvando anotação' : state === 'error' ? 'Não foi possível salvar' : 'Sessão alterada'
  const dialog = await screen.findByRole('dialog', { name: title })
  expect(dialog).toHaveTextContent('Alterações pendentes podem não ser salvas')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Ignorar' }))
  expect(proceed).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  if (state === 'saving') await act(async () => finish({ member, content: 'Texto novo' }))
  expect(proceed).toHaveBeenCalledOnce()
  expect(saveMemberNote).toHaveBeenCalledOnce()
})


test('restricted modal waits until login has closed and never fetches private data', () => {
  const props = { memberId: null, base, user: { ...member, member_type: 'member' }, restoring: false, onNavigate: vi.fn() }
  const { rerender } = render(<NotesPage {...props} loginOpen />)
  expect(screen.queryByRole('dialog', { name: 'Área restrita' })).not.toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Carregando gdevs' })).toBeInTheDocument()
  rerender(<NotesPage {...props} loginOpen={false} />)
  expect(screen.getByRole('dialog', { name: 'Área restrita' })).toBeInTheDocument()
  expect(listNoteMembers).not.toHaveBeenCalled()
  expect(getMemberNote).not.toHaveBeenCalled()
})

test.each(['close', 'escape'])('restricted dialog %s returns home', method => {
  const onNavigate = vi.fn()
  render(<NotesPage memberId={null} base={base} user={{ ...member, member_type: 'member' }} restoring={false} onNavigate={onNavigate} />)
  if (method === 'close') fireEvent.click(screen.getByRole('button', { name: 'voltar à home' }))
  else fireEvent.keyDown(window, { key: 'Escape' })
  expect(onNavigate).toHaveBeenCalledWith('/gaydevs/platform')
})

test.each([null, 'ana'])('403 from notes endpoint presents restricted modal on %s', async memberId => {
  vi.mocked(listNoteMembers).mockRejectedValue(new ApiError('Forbidden', 403))
  vi.mocked(getMemberNote).mockRejectedValue(new ApiError('Forbidden', 403))
  render(<NotesPage memberId={memberId} base={base} user={admin} restoring={false} onNavigate={vi.fn()} />)
  expect(await screen.findByRole('dialog', { name: 'Área restrita' })).toBeInTheDocument()
  expect(screen.getByRole('status', { name: memberId ? 'Carregando anotação' : 'Carregando gdevs' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

test.each([null, 'ana'])('session restoration delays login prompt on %s until authentication is resolved', memberId => {
  const onLogin = vi.fn()
  const props = { memberId, base, user: null, onLogin, onNavigate: vi.fn() }
  const { rerender } = render(<NotesPage {...props} restoring />)
  expect(onLogin).not.toHaveBeenCalled()
  rerender(<NotesPage {...props} restoring={false} />)
  expect(onLogin).toHaveBeenCalledOnce()
  expect(getMemberNote).not.toHaveBeenCalled()
  expect(listNoteMembers).not.toHaveBeenCalled()
})

test('permission lost while refreshing removes previously displayed private preview', async () => {
  vi.mocked(listNoteMembers).mockResolvedValueOnce([member]).mockRejectedValueOnce(new ApiError('Forbidden', 403))
  render(<NotesPage memberId={null} base={base} user={admin} restoring={false} onNavigate={vi.fn()} />)
  expect(await screen.findByText(member.preview)).toBeInTheDocument()
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(await screen.findByRole('dialog', { name: 'Área restrita' })).toBeInTheDocument()
  expect(screen.queryByText(member.preview)).not.toBeInTheDocument()
  expect(screen.queryByText(member.name)).not.toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Carregando gdevs' })).toBeInTheDocument()
})

test('refresh updates preview without replacing cards with a skeleton', async () => {
  vi.mocked(listNoteMembers).mockResolvedValueOnce([member])
  let finish!: (items: typeof member[]) => void
  vi.mocked(listNoteMembers).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(<NotesPage memberId={null} base={base} user={admin} restoring={false} onNavigate={vi.fn()} />)
  expect(await screen.findByText(member.preview)).toBeInTheDocument()
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(screen.getByText(member.preview)).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Carregando gdevs' })).not.toBeInTheDocument()
  await act(async () => finish([{ ...member, preview: 'Gravação tardia' }]))
  expect(screen.getByText('Gravação tardia')).toBeInTheDocument()
  expect(screen.queryByText(member.preview)).not.toBeInTheDocument()
})
