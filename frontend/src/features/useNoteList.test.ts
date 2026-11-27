// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ApiError } from './auth/api'
import { listNoteMembers, type NoteMember } from './notesApi'
import { NOTES_REFRESH_INTERVAL_MS, useNoteList } from './useNoteList'

vi.mock('./notesApi', () => ({ listNoteMembers: vi.fn() }))
const first = { id: 'a', name: 'Ana', preview: 'Antiga' }
const second = { id: 'b', name: 'Bruno' }
let visible: DocumentVisibilityState
beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  visible = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })
const advance = async () => { await act(async () => vi.advanceTimersByTimeAsync(NOTES_REFRESH_INTERVAL_MS)) }

test('refresh replaces snapshot silently, including removed members and empty previews', async () => {
  vi.mocked(listNoteMembers).mockResolvedValueOnce([second, first]).mockResolvedValueOnce([{ ...first, preview: '' }])
  const { result } = renderHook(() => useNoteList('admin-a'))
  expect(result.current.members).toBeNull()
  await act(async () => {})
  expect(result.current.members).toEqual([first, second])
  await act(async () => vi.advanceTimersByTimeAsync(NOTES_REFRESH_INTERVAL_MS - 1))
  expect(listNoteMembers).toHaveBeenCalledOnce()
  await act(async () => vi.advanceTimersByTimeAsync(1))
  expect(result.current.members).toEqual([{ ...first, preview: '' }])
  expect(listNoteMembers).toHaveBeenLastCalledWith('admin-a', expect.any(AbortSignal))
})

test('hidden tab pauses interval and visibility return refreshes immediately', async () => {
  vi.mocked(listNoteMembers).mockResolvedValue([first])
  renderHook(() => useNoteList('admin-a'))
  await act(async () => {})
  visible = 'hidden'
  await advance()
  expect(listNoteMembers).toHaveBeenCalledOnce()
  visible = 'visible'
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(listNoteMembers).toHaveBeenCalledTimes(2)
})

test('no overlapping requests and no late response after author change', async () => {
  let finish!: (items: NoteMember[]) => void
  vi.mocked(listNoteMembers).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue([second])
  const { result, rerender, unmount } = renderHook(({ actor }) => useNoteList(actor), { initialProps: { actor: 'admin-a' } })
  const signal = vi.mocked(listNoteMembers).mock.calls[0][1]
  await advance()
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(listNoteMembers).toHaveBeenCalledOnce()
  rerender({ actor: 'admin-b' })
  expect(signal?.aborted).toBe(true)
  expect(result.current.members).toBeNull()
  await act(async () => finish([first]))
  expect(result.current.members).toEqual([second])
  unmount()
  await advance()
  expect(listNoteMembers).toHaveBeenCalledTimes(2)
})

test('transient failure keeps existing cards and next interval recovers', async () => {
  vi.mocked(listNoteMembers).mockResolvedValueOnce([first]).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([second])
  const { result } = renderHook(() => useNoteList('admin-a'))
  await act(async () => {})
  await advance()
  expect(result.current.members).toEqual([first])
  expect(result.current.error).toBe('')
  await advance()
  expect(result.current.members).toEqual([second])
})

test.each([401, 403, 409])('authorization loss %s clears previews and stops refreshes', async status => {
  vi.mocked(listNoteMembers).mockResolvedValueOnce([first]).mockRejectedValueOnce(new ApiError('access denied', status))
  const { result } = renderHook(() => useNoteList('admin-a'))
  await act(async () => {})
  await advance()
  expect(result.current.members).toBeNull()
  expect(result.current.error).not.toBe('')
  await advance()
  expect(listNoteMembers).toHaveBeenCalledTimes(2)
})
