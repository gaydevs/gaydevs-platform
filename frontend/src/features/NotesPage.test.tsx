// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { NotesPage } from './NotesPage'
import { NoteRichEditor } from './NoteRichEditor'
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
  vi.mocked(saveMemberNote).mockResolvedValue({ member, content: 'Texto novo' })
  render(<NotesPage memberId="ana" base={base} user={admin} restoring={false} onNavigate={vi.fn()} />)
  const editor = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  editor.focus()
  // Pasting plain text exercises the actual Tiptap transaction without jsdom selection layout.
  fireEvent.paste(editor, { clipboardData: { getData: () => ' novo' } })
  expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  await waitFor(() => expect(saveMemberNote).toHaveBeenCalled(), { timeout: 2500 })
  expect(await screen.findByText('Anotação salva')).toBeInTheDocument()
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
  act(() => { expect(guard?.(proceed)).toBe(true) })
  await waitFor(() => expect(proceed).toHaveBeenCalledOnce())
})
