// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { getMemberNote, listNoteMembers, saveMemberNote } from './notesApi'

afterEach(() => vi.unstubAllGlobals())
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

test('both read endpoints bind the expected actor and disable cache', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(json({ members: [] })).mockResolvedValueOnce(json({ member: { id: 'ana', name: 'Ana' }, content: '', version: 0 }))
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
  const saving = saveMemberNote('admin-a', 'ana', 'private draft', 0)
  // The browser session may have changed by the time CSRF completes.
  finishCsrf(new Response(null, { status: 204 }))
  await expect(saving).rejects.toMatchObject({ status: 409 })
  const init = fetchMock.mock.calls[1][1] as RequestInit
  expect(new Headers(init.headers).get('X-Notes-Actor')).toBe('admin-a')
  expect(JSON.parse(String(init.body))).toEqual({ content: 'private draft', expected_version: 0 })
  expect(init.cache).toBe('no-store')
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('abandoned save does not send PUT after CSRF resolves', async () => {
  let finishCsrf!: (response: Response) => void
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finishCsrf = resolve }))
  vi.stubGlobal('fetch', fetchMock)
  const controller = new AbortController()
  const saving = saveMemberNote('admin-a', 'ana', 'private draft', 0, controller.signal)
  controller.abort()
  finishCsrf(new Response(null, { status: 204 }))
  await expect(saving).rejects.toMatchObject({ name: 'AbortError' })
  expect(fetchMock).toHaveBeenCalledOnce()
})

test.each([401, 403, 409, 422, 500, 504])('save exposes HTTP %s to the caller without swallowing it', async status => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ message: 'Falha simulada' }, status))
  vi.stubGlobal('fetch', fetchMock)
  await expect(saveMemberNote('admin-a', 'ana', 'draft', 0)).rejects.toMatchObject({ status, message: 'Falha simulada' })
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test('network exception and non-JSON gateway timeout propagate independently', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockRejectedValueOnce(new TypeError('Network error'))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response('Gateway timeout', { status: 504 }))
  vi.stubGlobal('fetch', fetchMock)
  await expect(saveMemberNote('admin-a', 'ana', 'draft', 0)).rejects.toThrow('Network error')
  await expect(saveMemberNote('admin-a', 'ana', 'draft', 0)).rejects.toMatchObject({ status: 504 })
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

test('CSRF failure never sends the note body', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
  vi.stubGlobal('fetch', fetchMock)
  await expect(saveMemberNote('admin-a', 'ana', 'private draft', 0)).rejects.toMatchObject({ status: 500 })
  expect(fetchMock).toHaveBeenCalledOnce()
  expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
})

test('version conflicts are typed only with a valid scoped snapshot', async () => {
  const snapshot = { member: { id: 'ana', name: 'Ana' }, content: 'remote', version: 2 }
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(json({ reason: 'note_version_conflict', note: snapshot }, 409))
  vi.stubGlobal('fetch', fetchMock)
  await expect(saveMemberNote('admin', 'ana', 'local', 1)).rejects.toMatchObject({ name: 'NoteVersionConflict', note: snapshot })
  expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({ content: 'local', expected_version: 1 })
})

test.each([
  { member: { id: 'other', name: 'Other' }, content: 'private', version: 2 },
  { member: { id: 'ana', name: 'Ana' }, content: 'remote', version: '2' },
  { member: { id: 'ana', name: 'Ana' }, content: 'remote', version: 1 },
  null,
])('malformed conflict %j fails closed', async note => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ reason: 'note_version_conflict', note }, 409)))
  await expect(saveMemberNote('admin', 'ana', 'local', 1)).rejects.toMatchObject({ name: 'ApiError', status: 409 })
})

test('rejects an invalid success revision rather than declaring the note saved', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(json({ member: { id: 'ana', name: 'Ana' }, content: 'local', version: 3 })))
  await expect(saveMemberNote('admin', 'ana', 'local', 1)).rejects.toThrow('Revisão de anotação inválida')
})
