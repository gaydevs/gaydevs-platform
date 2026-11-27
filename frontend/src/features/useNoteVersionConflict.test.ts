// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useNoteAutosave, type LeaveGuard } from './useNoteAutosave'
import { getMemberNote, saveMemberNote } from './notesApi'
import { NoteVersionConflict, type MemberNote } from './noteVersion'
import { ApiError } from './auth/api'

vi.mock('./notesApi', () => ({ saveMemberNote: vi.fn(), getMemberNote: vi.fn() }))
const note = (content: string, version: number): MemberNote => ({ member: { id: 'ana', name: 'Ana' }, content, version })
const tick = async () => { await act(async () => vi.advanceTimersByTimeAsync(700)) }
function setup() {
  let guard!: LeaveGuard
  const register = (value: LeaveGuard) => { guard = value; return () => {} }
  const hook = renderHook(() => useNoteAutosave('admin', 'ana', 'A', 1, register))
  return { ...hook, guard: (proceed: () => void | Promise<void>) => guard(proceed) }
}
function change(hook: ReturnType<typeof setup>, content: string) { act(() => hook.result.current.change(content)) }
function beforeUnload() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}
async function choose(hook: ReturnType<typeof setup>, action: 'reload' | 'overwrite') {
  await act(async () => hook.result.current.resolveConflict(action))
}
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks() })
afterEach(() => { cleanup(); vi.useRealTimers() })

test('normal saves use the latest confirmed revision and never poll the note', async () => {
  const hook = setup()
  vi.mocked(saveMemberNote).mockResolvedValueOnce(note('B', 2)).mockResolvedValueOnce(note('C', 3))
  change(hook, 'B'); await tick()
  change(hook, 'C'); await tick()
  expect(vi.mocked(saveMemberNote).mock.calls.map(call => call.slice(2, 4))).toEqual([['B', 1], ['C', 2]])
  await act(async () => vi.advanceTimersByTimeAsync(60000))
  expect(getMemberNote).not.toHaveBeenCalled()
  expect(hook.result.current.status).toBe('saved')
  expect(beforeUnload()).toBe(false)
})

test('lost response after commit is reconciled by retry without another committed write', async () => {
  const hook = setup()
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new TypeError('lost response')).mockRejectedValueOnce(new NoteVersionConflict(note('B', 2))).mockResolvedValueOnce(note('C', 3))
  change(hook, 'B'); await tick()
  expect(beforeUnload()).toBe(true)
  await act(async () => hook.result.current.retry())
  expect(hook.result.current.conflict).toBeNull()
  expect(hook.result.current.status).toBe('saved')
  change(hook, 'C'); await tick()
  expect(vi.mocked(saveMemberNote).mock.calls.map(call => call.slice(2, 4))).toEqual([['B', 1], ['B', 1], ['C', 2]])
})

test('lost response without commit retries the unchanged expected revision', async () => {
  const hook = setup()
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(note('B', 2))
  change(hook, 'B'); await tick()
  await act(async () => hook.result.current.retry())
  expect(vi.mocked(saveMemberNote).mock.calls.map(call => call.slice(2, 4))).toEqual([['B', 1], ['B', 1]])
  expect(hook.result.current.status).toBe('saved')
})

test('reconciliation of the submitted content preserves a later queued edit', async () => {
  const hook = setup()
  let reject!: (error: Error) => void
  vi.mocked(saveMemberNote).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail })).mockResolvedValueOnce(note('C', 3))
  change(hook, 'B'); await tick()
  change(hook, 'C')
  await act(async () => reject(new NoteVersionConflict(note('B', 2))))
  expect(hook.result.current.conflict).toBeNull()
  expect(vi.mocked(saveMemberNote).mock.calls.map(call => call.slice(2, 4))).toEqual([['B', 1], ['C', 2]])
  expect(hook.result.current.status).toBe('saved')
})

test('remote matching the current draft reconciles without writing again', async () => {
  const hook = setup()
  let reject!: (error: Error) => void
  vi.mocked(saveMemberNote).mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
  change(hook, 'B'); await tick()
  change(hook, 'C')
  await act(async () => reject(new NoteVersionConflict(note('C', 2))))
  expect(hook.result.current.conflict).toBeNull()
  expect(hook.result.current.status).toBe('saved')
  expect(saveMemberNote).toHaveBeenCalledOnce()
})

test.each(['B', 'C'])('aborted write and recovered logout: first commit %s determines CAS result', async winner => {
  let remote = note('A', 1)
  const commit = (content: string, expected: number) => {
    if (remote.version !== expected) throw new NoteVersionConflict(remote)
    remote = note(content, expected + 1)
    return remote
  }
  let runOld!: () => void
  vi.mocked(saveMemberNote).mockImplementationOnce((_actor, _id, content, expected) => new Promise((resolve, reject) => {
    runOld = () => { try { resolve(commit(content, expected)) } catch (error) { reject(error) } }
  })).mockImplementation(async (_actor, _id, content, expected) => commit(content, expected))
  const hook = setup()
  change(hook, 'B')
  act(() => { expect(hook.guard(async () => { throw new Error('logout failed') })).toBe(true) })
  const signal = vi.mocked(saveMemberNote).mock.calls[0][4]
  await act(async () => hook.result.current.ignoreLeave())
  expect(signal?.aborted).toBe(true)
  change(hook, 'C')
  if (winner === 'B') await act(async () => runOld())
  await tick()
  if (winner === 'C') await act(async () => runOld())
  expect(remote.content).toBe(winner)
  expect(remote.version).toBe(2)
  if (winner === 'B') {
    expect(hook.result.current.conflict?.content).toBe('B')
    expect(beforeUnload()).toBe(true)
    await choose(hook, 'overwrite')
    expect(remote.content).toBe('C')
    expect(remote.version).toBe(3)
  }
  expect(hook.result.current.conflict).toBeNull()
  expect(hook.result.current.status).toBe('saved')
})

test('two tabs cannot overwrite each other, resolution requires an explicit decision', async () => {
  let remote = note('A', 1)
  vi.mocked(saveMemberNote).mockImplementation(async (_actor, _id, content, expected) => {
    if (remote.version !== expected) throw new NoteVersionConflict(remote)
    remote = note(content, expected + 1)
    return remote
  })
  const first = setup(), second = setup()
  change(first, 'B'); await tick()
  change(second, 'C'); await tick()
  expect(second.result.current.conflict?.content).toBe('B')
  expect(remote.content).toBe('B')
  const navigation = vi.fn()
  act(() => { expect(second.guard(navigation)).toBe(true); second.result.current.retry(); second.result.current.change('ignored') })
  await tick()
  expect(saveMemberNote).toHaveBeenCalledTimes(2)
  expect(navigation).not.toHaveBeenCalled()
  await choose(second, 'overwrite')
  expect(remote.content).toBe('C')
  expect(second.result.current.status).toBe('saved')
})

test('conflict resolution reload discards only after successful GET and resumes pending exit once', async () => {
  const hook = setup()
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new NoteVersionConflict(note('remote', 2)))
  vi.mocked(getMemberNote).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(note('# Remote', 3))
  change(hook, 'draft')
  const proceed = vi.fn()
  await act(async () => { expect(hook.guard(proceed)).toBe(true) })
  expect(hook.result.current.conflict?.version).toBe(2)
  await choose(hook, 'reload')
  expect(hook.result.current.resolutionError).toBeTruthy()
  expect(hook.result.current.editorSnapshot.content).toBe('A')
  expect(beforeUnload()).toBe(true)
  expect(proceed).not.toHaveBeenCalled()
  await choose(hook, 'reload')
  expect(hook.result.current.editorSnapshot).toEqual({ content: '# Remote', generation: 1 })
  expect(hook.result.current.conflict).toBeNull()
  expect(saveMemberNote).toHaveBeenCalledOnce()
  expect(proceed).toHaveBeenCalledOnce()
  expect(beforeUnload()).toBe(false)
})

test('overwrite failure preserves draft; a third write forces a fresh decision', async () => {
  const hook = setup()
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new NoteVersionConflict(note('remote', 2)))
    .mockRejectedValueOnce(new Error('network'))
    .mockRejectedValueOnce(new NoteVersionConflict(note('third', 3)))
    .mockResolvedValueOnce(note('local', 4))
  change(hook, 'local'); await tick()
  await choose(hook, 'overwrite')
  expect(hook.result.current.resolutionError).toBeTruthy()
  expect(hook.result.current.conflict?.version).toBe(2)
  await choose(hook, 'overwrite')
  expect(hook.result.current.conflict?.version).toBe(3)
  expect(saveMemberNote).toHaveBeenCalledTimes(3)
  await tick()
  expect(saveMemberNote).toHaveBeenCalledTimes(3)
  await choose(hook, 'overwrite')
  expect(vi.mocked(saveMemberNote).mock.calls.map(call => call.slice(2, 4))).toEqual([['local', 1], ['local', 2], ['local', 2], ['local', 3]])
  expect(hook.result.current.conflict).toBeNull()
  expect(beforeUnload()).toBe(false)
})

test('only one resolution request can be in flight, even when actions are invoked directly', async () => {
  const hook = setup()
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new NoteVersionConflict(note('remote', 2)))
  let resolve!: (value: MemberNote) => void
  vi.mocked(getMemberNote).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  change(hook, 'local'); await tick()
  act(() => {
    void hook.result.current.resolveConflict('reload')
    void hook.result.current.resolveConflict('reload')
    void hook.result.current.resolveConflict('overwrite')
  })
  expect(getMemberNote).toHaveBeenCalledOnce()
  expect(saveMemberNote).toHaveBeenCalledOnce()
  expect(hook.result.current.resolutionBusy).toBe(true)
  await act(async () => resolve(note('remote', 2)))
  expect(hook.result.current.resolutionBusy).toBe(false)
})

test.each(['reload', 'overwrite'] as const)('session change during %s prevents subsequent writes', async action => {
  const hook = setup()
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new NoteVersionConflict(note('remote', 2))).mockRejectedValueOnce(new ApiError('session', 409))
  vi.mocked(getMemberNote).mockRejectedValueOnce(new ApiError('session', 409))
  change(hook, 'local'); await tick()
  await choose(hook, action)
  expect(hook.result.current.status).toBe('session-changed')
  expect(hook.result.current.conflict).toBeNull()
  change(hook, 'later')
  await act(async () => hook.result.current.retry())
  await tick()
  expect(saveMemberNote).toHaveBeenCalledTimes(action === 'reload' ? 1 : 2)
})

test('unmount aborts conflict resolution and ignores its late result', async () => {
  const hook = setup()
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new NoteVersionConflict(note('remote', 2)))
  let resolve!: (value: MemberNote) => void
  vi.mocked(getMemberNote).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  change(hook, 'local'); await tick()
  act(() => { void hook.result.current.resolveConflict('reload') })
  const signal = vi.mocked(getMemberNote).mock.calls[0][2]
  hook.unmount()
  expect(signal?.aborted).toBe(true)
  await act(async () => resolve(note('remote', 2)))
  expect(saveMemberNote).toHaveBeenCalledOnce()
})
