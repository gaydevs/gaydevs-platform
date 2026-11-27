// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { NotesPage } from './NotesPage'
import { NoteRichEditor } from './NoteRichEditor'
import { NoteEditorLoading } from './NotesLoadingStates'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getMemberNote, listNoteMembers, saveMemberNote } from './notesApi'
import type { LeaveGuard } from './useNoteAutosave'

vi.mock('./notesApi', () => ({ getMemberNote: vi.fn(), listNoteMembers: vi.fn(), saveMemberNote: vi.fn() }))
const admin = { id: 'admin', name: 'Admin', member_type: 'admin' }
const member = { id: 'ana', name: 'Ana Silva', preview: 'Desenvolvimento backend' }
const base = '/gaydevs/platform/notes'

afterEach(cleanup)
beforeEach(() => { vi.resetAllMocks() })

test('denies direct access to ordinary members without fetching notes', () => {
  render(<NotesPage memberId="ana" base={base} user={{ ...member, member_type: 'member' }} restoring={false} onNavigate={vi.fn()} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Área restrita')
  expect(getMemberNote).not.toHaveBeenCalled()
  expect(listNoteMembers).not.toHaveBeenCalled()
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
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
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
  const styles = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8')
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
