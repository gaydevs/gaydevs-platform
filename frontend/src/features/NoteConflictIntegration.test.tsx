// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { NotesPage } from './NotesPage'
import type { LeaveGuard } from './useNoteAutosave'

const member = { id: 'ana', name: 'Ana' }
const admin = { id: 'admin', name: 'Admin', member_type: 'admin' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

async function setup() {
  let remote = { member, content: 'Texto', version: 1 }
  let failRead = false
  let failWrite = false
  const get = vi.fn(async () => {
    if (failRead) { failRead = false; throw new TypeError('Network error') }
    return json(remote)
  })
  const put = vi.fn(async (init: RequestInit) => {
    if (failWrite) { failWrite = false; throw new TypeError('Network error') }
    const body = JSON.parse(String(init.body)) as { content: string; expected_version: number }
    if (body.expected_version !== remote.version) return json({ reason: 'note_version_conflict', note: remote }, 409)
    remote = { ...remote, content: body.content, version: remote.version + 1 }
    return json(remote)
  })
  vi.stubGlobal('fetch', vi.fn(async (input: URL | string, init: RequestInit = {}) => {
    const path = String(input)
    if (path.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 })
    if (path.endsWith('/notes/ana')) {
      expect(new Headers(init.headers).get('X-Notes-Actor')).toBe(admin.id)
      return init.method === 'PUT' ? put(init) : get()
    }
    throw new Error('Unexpected request: ' + path)
  }))
  let guard!: LeaveGuard
  const registerGuard = (value: LeaveGuard) => { guard = value; return () => {} }
  render(<NotesPage memberId="ana" base="/gaydevs/platform/notes" user={admin} restoring={false} onNavigate={vi.fn()} registerGuard={registerGuard} />)
  const editor = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  const setRemote = (content: string) => { remote = { ...remote, content, version: remote.version + 1 } }
  const edit = () => fireEvent.paste(screen.getByRole('textbox', { name: 'Anotações' }), { clipboardData: { getData: () => ' local' } })
  setRemote('**Remoto**')
  edit()
  return { editor, edit, put, get, remote: () => remote, setRemote, failNextRead: () => { failRead = true }, failNextWrite: () => { failWrite = true }, guard: (proceed: () => void) => guard(proceed) }
}

test('conflict modal is blocking, preserves local content and reloads Markdown without a spurious write', async () => {
  const h = await setup()
  const ui = userEvent.setup()
  const dialog = await screen.findByRole('dialog', { name: 'Conflito de anotação' }, { timeout: 5000 })
  const reload = within(dialog).getByRole('button', { name: 'Recarregar' })
  const overwrite = within(dialog).getByRole('button', { name: 'Sobrescrever' })
  expect(within(dialog).getAllByRole('button')).toHaveLength(2)
  expect(reload).toHaveFocus()
  await ui.tab({ shift: true })
  expect(overwrite).toHaveFocus()
  await ui.tab()
  expect(reload).toHaveFocus()
  await ui.keyboard('{Escape}')
  fireEvent.mouseDown(dialog.parentElement!)
  expect(dialog).toBeInTheDocument()
  expect(h.editor).toHaveAttribute('contenteditable', 'false')
  const local = h.editor.textContent
  h.edit()
  expect(h.editor.textContent).toBe(local)
  const nav = vi.fn()
  act(() => { expect(h.guard(nav)).toBe(true) })
  expect(nav).not.toHaveBeenCalled()
  const beforeUnload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(beforeUnload)
  expect(beforeUnload.defaultPrevented).toBe(true)
  h.failNextRead()
  await ui.click(reload)
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Seu texto continua preservado')
  expect(h.editor.textContent).toBe(local)
  await ui.click(reload)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const newEditor = await screen.findByRole('textbox', { name: 'Anotações' })
  expect(newEditor.querySelector('strong')).toHaveTextContent('Remoto')
  expect(newEditor).toHaveAttribute('contenteditable', 'true')
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 800)) })
  expect(h.put).toHaveBeenCalledOnce()
  expect(h.get).toHaveBeenCalledTimes(3)
  expect(nav).not.toHaveBeenCalled()
  const clean = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(clean)
  expect(clean.defaultPrevented).toBe(false)
  h.edit()
  await waitFor(() => expect(h.put).toHaveBeenCalledTimes(2), { timeout: 2500 })
  expect(JSON.parse(String(h.put.mock.calls[1][0].body)).expected_version).toBe(2)
}, 15000)

test('overwrite retains the local draft on failure and on a third writer until another explicit choice', async () => {
  const h = await setup()
  const dialog = await screen.findByRole('dialog', { name: 'Conflito de anotação' }, { timeout: 5000 })
  const overwrite = within(dialog).getByRole('button', { name: 'Sobrescrever' })
  const originalDraft = JSON.parse(String(h.put.mock.calls[0][0].body)).content
  h.failNextWrite()
  fireEvent.click(overwrite)
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Seu texto continua preservado')
  expect(h.remote().content).toBe('**Remoto**')
  h.setRemote('Terceira edição')
  fireEvent.click(overwrite)
  await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('mudou novamente'))
  expect(h.remote().content).toBe('Terceira edição')
  expect(h.put).toHaveBeenCalledTimes(3)
  fireEvent.click(overwrite)
  fireEvent.click(overwrite)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(h.put).toHaveBeenCalledTimes(4)
  expect(h.remote().content).toBe(originalDraft)
  expect(h.remote().version).toBe(4)
  expect(h.editor).toHaveAttribute('contenteditable', 'true')
  expect(h.get).toHaveBeenCalledOnce()
}, 15000)
