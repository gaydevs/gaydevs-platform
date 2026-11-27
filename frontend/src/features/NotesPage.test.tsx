// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { NotesPage, NotePreview } from './NotesPage'
import { getMemberNote, listNoteMembers, saveMemberNote } from './notesApi'

vi.mock('./notesApi', () => ({ getMemberNote: vi.fn(), listNoteMembers: vi.fn(), saveMemberNote: vi.fn() }))
const admin = { id: 'admin', name: 'Admin', member_type: 'admin' }
const member = { id: 'ana', name: 'Ana Silva' }
const base = '/gaydevs/platform/notes'

afterEach(cleanup)

beforeEach(() => {
  vi.resetAllMocks()
})

test('denies direct access to ordinary members without fetching notes', () => {
  render(<NotesPage memberId="ana" base={base} user={{ ...member, member_type: 'member' }} restoring={false} onNavigate={vi.fn()} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Área restrita')
  expect(getMemberNote).not.toHaveBeenCalled()
  expect(listNoteMembers).not.toHaveBeenCalled()
})

test('shows alphabetical cards and navigates to the member', async () => {
  vi.mocked(listNoteMembers).mockResolvedValue([{ id: 'z', name: 'Zeta' }, member])
  const navigate = vi.fn()
  render(<NotesPage memberId={null} base={base} user={admin} restoring={false} onNavigate={navigate} />)
  const buttons = await screen.findAllByRole('button')
  expect(buttons[0]).toHaveTextContent('Ana Silva')
  expect(within(buttons[0]).getByText('AS')).toBeInTheDocument()
  await userEvent.click(buttons[0])
  expect(navigate).toHaveBeenCalledWith(base + '/ana')
})

test('formats, previews and saves the single note', async () => {
  vi.mocked(getMemberNote).mockResolvedValue({ member, content: 'Texto' })
  vi.mocked(saveMemberNote).mockResolvedValue({ member, content: '**Texto**' })
  render(<NotesPage memberId="ana" base={base} user={admin} restoring={false} onNavigate={vi.fn()} />)
  const field = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Anotações' })
  field.focus()
  field.setSelectionRange(0, 5)
  await userEvent.click(screen.getByRole('button', { name: 'Negrito' }))
  expect(field).toHaveValue('**Texto**')
  await userEvent.click(screen.getByRole('button', { name: 'Visualizar' }))
  expect(screen.getByText('Texto').tagName).toBe('STRONG')
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(saveMemberNote).toHaveBeenCalledWith('ana', '**Texto**')
  expect(await screen.findByText('Anotação salva.')).toBeInTheDocument()
})

test('preview never interprets raw HTML as markup', () => {
  const { container } = render(<NotePreview content={'## Título\n- item\n<img src=x onerror=alert(1)>'} />)
  expect(screen.getByRole('heading', { name: 'Título' })).toBeInTheDocument()
  expect(screen.getByRole('listitem')).toHaveTextContent('item')
  expect(container.querySelector('img')).toBeNull()
  expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
})
