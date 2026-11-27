// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { getMemberNote, listNoteMembers, saveMemberNote } from './notesApi'

afterEach(() => vi.unstubAllGlobals())
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

test('both read endpoints bind the expected actor and disable cache', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(json({ members: [] })).mockResolvedValueOnce(json({ member: { id: 'ana', name: 'Ana' }, content: '' }))
  vi.stubGlobal('fetch', fetchMock)
  await listNoteMembers('admin-a')
  await getMemberNote('admin-b', 'ana')
  for (const [index, author] of ['admin-a', 'admin-b'].entries()) {
    const init = fetchMock.mock.calls[index][1] as RequestInit
    expect(new Headers(init.headers).get('X-Notes-Actor')).toBe(author)
    expect(init.cache).toBe('no-store')
  }
})

test('autosave keeps its original expected actor even if session changes during CSRF', async () => {
  let finishCsrf!: (response: Response) => void
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishCsrf = resolve }))
    .mockResolvedValueOnce(json({ message: 'Sessão alterada.' }, 409))
  vi.stubGlobal('fetch', fetchMock)
  const saving = saveMemberNote('admin-a', 'ana', 'private draft')
  // The browser session may have changed by the time CSRF completes.
  finishCsrf(new Response(null, { status: 204 }))
  await expect(saving).rejects.toMatchObject({ status: 409 })
  const init = fetchMock.mock.calls[1][1] as RequestInit
  expect(new Headers(init.headers).get('X-Notes-Actor')).toBe('admin-a')
  expect(JSON.parse(String(init.body))).toEqual({ content: 'private draft' })
  expect(init.cache).toBe('no-store')
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('abandoned save does not send PUT after CSRF resolves', async () => {
  let finishCsrf!: (response: Response) => void
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishCsrf = resolve }))
  vi.stubGlobal('fetch', fetchMock)
  const controller = new AbortController()
  const saving = saveMemberNote('admin-a', 'ana', 'private draft', controller.signal)
  controller.abort()
  finishCsrf(new Response(null, { status: 204 }))
  await expect(saving).rejects.toMatchObject({ name: 'AbortError' })
  expect(fetchMock).toHaveBeenCalledOnce()
})
