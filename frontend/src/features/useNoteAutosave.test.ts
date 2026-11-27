// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useNoteAutosave, type LeaveGuard } from './useNoteAutosave'
import { saveMemberNote, type MemberNote } from './notesApi'

vi.mock('./notesApi', () => ({ saveMemberNote: vi.fn() }))
const response = (content: string): MemberNote => ({ member: { id: 'ana', name: 'Ana' }, content })
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks() })
afterEach(() => { cleanup(); vi.useRealTimers() })

test('debounces and serializes writes without overwriting the latest edit', async () => {
  let resolveFirst!: (value: MemberNote) => void
  vi.mocked(saveMemberNote).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve })).mockResolvedValueOnce(response('third'))
  const { result } = renderHook(() => useNoteAutosave('ana', ''))
  act(() => { result.current.change('first'); result.current.change('second') })
  await act(async () => { await vi.advanceTimersByTimeAsync(699) })
  expect(saveMemberNote).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(1) })
  expect(saveMemberNote).toHaveBeenCalledExactlyOnceWith('ana', 'second')
  act(() => result.current.change('third'))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(saveMemberNote).toHaveBeenCalledTimes(1)
  await act(async () => resolveFirst(response('second')))
  expect(saveMemberNote).toHaveBeenLastCalledWith('ana', 'third')
  expect(result.current.status).toBe('saved')
})

test('failed save keeps draft and navigation guarded until retry succeeds', async () => {
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(response('draft'))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('ana', '', register))
  const proceed = vi.fn()
  act(() => result.current.change('draft'))
  await act(async () => { expect(guard?.(proceed)).toBe(true) })
  expect(result.current.status).toBe('error')
  expect(result.current.leaveOpen).toBe(true)
  expect(proceed).not.toHaveBeenCalled()
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  await act(async () => result.current.retry())
  expect(proceed).toHaveBeenCalledOnce()
  expect(result.current.leaveOpen).toBe(false)
})

test('canceling an exit does not discard or navigate away from the draft', async () => {
  let resolve!: (value: MemberNote) => void
  vi.mocked(saveMemberNote).mockImplementation(() => new Promise(done => { resolve = done }))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('ana', '', register))
  const proceed = vi.fn()
  act(() => result.current.change('draft'))
  act(() => { expect(guard?.(proceed)).toBe(true) })
  act(() => result.current.cancelLeave())
  await act(async () => resolve(response('draft')))
  expect(proceed).not.toHaveBeenCalled()
  expect(result.current.status).toBe('saved')
})
