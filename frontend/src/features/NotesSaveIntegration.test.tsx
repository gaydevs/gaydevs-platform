// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { NotesPage } from './NotesPage'
import type { LeaveGuard } from './useNoteAutosave'

const member = { id: 'ana', name: 'Ana Silva' }
const admin = { id: 'admin', name: 'Admin', member_type: 'admin' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

// Exercise real NotesPage, autosave, notesApi and CSRF/request handling; only the network is simulated.
async function setup(write: (init: RequestInit) => Promise<Response>) {
  const put = vi.fn(write)
  vi.stubGlobal('fetch', vi.fn(async (input: URL | string, init: RequestInit = {}) => {
    const path = String(input)
    if (path.endsWith('/sanctum/csrf-cookie')) return new Response(null, { status: 204 })
    if (path.endsWith('/notes/ana')) {
      expect(new Headers(init.headers).get('X-Notes-Actor')).toBe(admin.id)
      return init.method === 'PUT' ? put(init) : json({ member, content: 'Texto' })
    }
    throw new Error('Unexpected request: ' + path)
  }))
  let guard: LeaveGuard | undefined
  const registerGuard = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  render(<NotesPage memberId="ana" base="/gaydevs/platform/notes" user={admin} restoring={false} onNavigate={vi.fn()} registerGuard={registerGuard} />)
  const editor = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  fireEvent.paste(editor, { clipboardData: { getData: () => ' novo' } })
  const proceed = vi.fn()
  act(() => { expect(guard?.(proceed)).toBe(true) })
  await waitFor(() => expect(put).toHaveBeenCalledOnce())
  return { put, proceed }
}

test('delayed HTTP response can be ignored without waiting or retrying', async () => {
  let resolve!: (response: Response) => void
  const { put, proceed } = await setup(() => new Promise(done => { resolve = done }))
  const dialog = screen.getByRole('dialog', { name: 'Salvando anotação' })
  expect(proceed).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Ignorar' }))
  expect(proceed).toHaveBeenCalledOnce()
  expect(put.mock.calls[0][0].signal?.aborted).toBe(true)
  await act(async () => resolve(json({ member, content: 'Texto novo' })))
  expect(put).toHaveBeenCalledOnce()
  expect(proceed).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('HTTP 504 and 500 expose retry, keeping the same payload until successful navigation', async () => {
  let attempts = 0
  const { put, proceed } = await setup(async init => {
    attempts++
    if (attempts === 1) return new Response('Gateway Timeout', { status: 504 })
    if (attempts === 2) return json({ message: 'Falha simulada' }, 500)
    return json({ member, content: JSON.parse(String(init.body)).content })
  })
  const failure = await screen.findByRole('dialog', { name: 'Não foi possível salvar' })
  expect(proceed).not.toHaveBeenCalled()
  fireEvent.click(within(failure).getByRole('button', { name: 'Tentar de novo' }))
  await waitFor(() => expect(put).toHaveBeenCalledTimes(2))
  const second = await screen.findByRole('dialog', { name: 'Não foi possível salvar' })
  expect(proceed).not.toHaveBeenCalled()
  fireEvent.click(within(second).getByRole('button', { name: 'Tentar de novo' }))
  await waitFor(() => expect(proceed).toHaveBeenCalledOnce())
  expect(put).toHaveBeenCalledTimes(3)
  expect(put.mock.calls.map(([init]) => init.body)).toEqual(Array(3).fill(put.mock.calls[0][0].body))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('network exception permits Ignore without another write', async () => {
  const { put, proceed } = await setup(async () => { throw new TypeError('Network error') })
  const failure = await screen.findByRole('dialog', { name: 'Não foi possível salvar' })
  expect(proceed).not.toHaveBeenCalled()
  fireEvent.click(within(failure).getByRole('button', { name: 'Ignorar' }))
  expect(proceed).toHaveBeenCalledOnce()
  expect(put).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
