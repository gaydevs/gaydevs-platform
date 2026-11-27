// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useNoteAutosave, type LeaveGuard } from './useNoteAutosave'
import { ApiError } from './auth/api'
import { saveMemberNote, type MemberNote } from './notesApi'

vi.mock('./notesApi', () => ({ saveMemberNote: vi.fn(), getMemberNote: vi.fn() }))
const response = (content: string, version = 1): MemberNote => ({ member: { id: 'ana', name: 'Ana' }, content, version })
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks() })
afterEach(() => { cleanup(); vi.useRealTimers() })

test('debounces and serializes writes without overwriting the latest edit', async () => {
  let resolveFirst!: (value: MemberNote) => void
  vi.mocked(saveMemberNote).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve })).mockResolvedValueOnce(response('third', 2))
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', '', 0))
  act(() => { result.current.change('first'); result.current.change('second') })
  await act(async () => { await vi.advanceTimersByTimeAsync(699) })
  expect(saveMemberNote).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(1) })
  expect(saveMemberNote).toHaveBeenCalledExactlyOnceWith('admin', 'ana', 'second', 0, expect.any(AbortSignal))
  act(() => result.current.change('third'))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(saveMemberNote).toHaveBeenCalledTimes(1)
  await act(async () => resolveFirst(response('second')))
  expect(saveMemberNote).toHaveBeenLastCalledWith('admin', 'ana', 'third', 1, expect.any(AbortSignal))
  expect(result.current.status).toBe('saved')
})

test('failed save keeps draft and navigation guarded until retry succeeds', async () => {
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(response('draft'))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', '', 0, register))
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
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', '', 0, register))
  const proceed = vi.fn()
  act(() => result.current.change('draft'))
  act(() => { expect(guard?.(proceed)).toBe(true) })
  act(() => result.current.cancelLeave())
  await act(async () => resolve(response('draft')))
  expect(proceed).not.toHaveBeenCalled()
  expect(result.current.status).toBe('saved')
})


test('session mismatch blocks retries and subsequent writes under a different account', async () => {
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new ApiError('Sessão alterada', 409))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin-a', 'ana', '', 0, register))
  act(() => result.current.change('private draft'))
  await act(async () => vi.advanceTimersByTimeAsync(700))
  expect(result.current.status).toBe('session-changed')
  const proceed = vi.fn()
  act(() => { expect(guard?.(proceed)).toBe(true) })
  await act(async () => result.current.retry())
  act(() => result.current.change('another draft'))
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(saveMemberNote).toHaveBeenCalledExactlyOnceWith('admin-a', 'ana', 'private draft', 0, expect.any(AbortSignal))
  expect(proceed).not.toHaveBeenCalled()
})

test('unmount aborts the in-flight write and prevents a queued write from the old account', async () => {
  let finish!: (value: MemberNote) => void
  vi.mocked(saveMemberNote).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const { result, unmount } = renderHook(() => useNoteAutosave('admin-a', 'ana', '', 0))
  act(() => result.current.change('first'))
  await act(async () => vi.advanceTimersByTimeAsync(700))
  const signal = vi.mocked(saveMemberNote).mock.calls[0][4]
  act(() => result.current.change('queued'))
  unmount()
  expect(signal?.aborted).toBe(true)
  await act(async () => finish(response('first')))
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(saveMemberNote).toHaveBeenCalledOnce()
})

test('ignore aborts the write, drops queued edits and resumes only once before unmount', async () => {
  let finish!: (value: MemberNote) => void
  vi.mocked(saveMemberNote).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', '', 0, register))
  const proceed = vi.fn()
  act(() => result.current.change('first'))
  act(() => { expect(guard?.(proceed)).toBe(true) })
  const signal = vi.mocked(saveMemberNote).mock.calls[0][4]
  act(() => result.current.change('queued'))
  act(() => { result.current.ignoreLeave(); result.current.ignoreLeave(); result.current.retry(); result.current.change('ignored') })
  expect(signal?.aborted).toBe(true)
  expect(proceed).toHaveBeenCalledOnce()
  expect(result.current.leaveOpen).toBe(false)
  expect(guard?.(vi.fn())).toBe(false)
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(false)
  await act(async () => finish(response('first')))
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(saveMemberNote).toHaveBeenCalledOnce()
  expect(proceed).toHaveBeenCalledOnce()
})

test('clean editor and reverted pending edit do not save or interrupt navigation', async () => {
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', 'original', 0, register))
  const proceed = vi.fn()
  expect(guard?.(proceed)).toBe(false)
  act(() => { result.current.change('edited'); result.current.change('original') })
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(saveMemberNote).not.toHaveBeenCalled()
  expect(guard?.(proceed)).toBe(false)
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(false)
})

test('a delayed save remains pending until it resolves, then navigation needs no guard', async () => {
  vi.mocked(saveMemberNote).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(response('draft')), 20000)))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', '', 0, register))
  const proceed = vi.fn()
  act(() => result.current.change('draft'))
  act(() => { expect(guard?.(proceed)).toBe(true) })
  await act(async () => vi.advanceTimersByTimeAsync(19999))
  expect(result.current.status).toBe('saving')
  expect(result.current.leaveOpen).toBe(true)
  expect(proceed).not.toHaveBeenCalled()
  await act(async () => vi.advanceTimersByTimeAsync(1))
  expect(result.current.status).toBe('saved')
  expect(proceed).toHaveBeenCalledOnce()
  expect(guard?.(vi.fn())).toBe(false)
})

test('repeated failures remain retryable and retain the same draft until success', async () => {
  vi.mocked(saveMemberNote)
    .mockRejectedValueOnce(new ApiError('Server error', 500))
    .mockRejectedValueOnce(new ApiError('Gateway Timeout', 504))
    .mockResolvedValueOnce(response('draft'))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', '', 0, register))
  const proceed = vi.fn()
  act(() => result.current.change('draft'))
  await act(async () => { expect(guard?.(proceed)).toBe(true) })
  expect(result.current.status).toBe('error')
  await act(async () => result.current.retry())
  expect(result.current.status).toBe('error')
  expect(result.current.leaveOpen).toBe(true)
  expect(proceed).not.toHaveBeenCalled()
  await act(async () => result.current.retry())
  expect(result.current.status).toBe('saved')
  expect(proceed).toHaveBeenCalledOnce()
  expect(vi.mocked(saveMemberNote).mock.calls.map(call => call.slice(0, 3))).toEqual(Array(3).fill(['admin', 'ana', 'draft']))
})

test.each([401, 403, 409])('saving with authorization error %s cannot retry', async status => {
  vi.mocked(saveMemberNote).mockRejectedValue(new ApiError('Denied', status))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', '', 0, register))
  const proceed = vi.fn()
  act(() => result.current.change('draft'))
  await act(async () => { expect(guard?.(proceed)).toBe(true) })
  expect(result.current.status).toBe('session-changed')
  await act(async () => result.current.retry())
  expect(saveMemberNote).toHaveBeenCalledOnce()
  expect(proceed).not.toHaveBeenCalled()
  act(() => result.current.ignoreLeave())
  expect(proceed).toHaveBeenCalledOnce()
})

test('an oversized note is not transmitted and can be corrected before retry', async () => {
  vi.mocked(saveMemberNote).mockResolvedValue(response('short'))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', '', 0, register))
  const proceed = vi.fn()
  act(() => result.current.change('x'.repeat(10001)))
  await act(async () => { expect(guard?.(proceed)).toBe(true) })
  expect(result.current.status).toBe('error')
  expect(saveMemberNote).not.toHaveBeenCalled()
  act(() => { result.current.cancelLeave(); result.current.change('short') })
  await act(async () => { expect(guard?.(proceed)).toBe(true) })
  expect(saveMemberNote).toHaveBeenCalledExactlyOnceWith('admin', 'ana', 'short', 0, expect.any(AbortSignal))
  expect(proceed).toHaveBeenCalledOnce()
})

test('a failed response after reverting to the confirmed content keeps persistence uncertain until retry succeeds', async () => {
  let reject!: (error: Error) => void
  vi.mocked(saveMemberNote)
    .mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail }))
    .mockRejectedValueOnce(new ApiError('Gateway Timeout', 504))
    .mockResolvedValueOnce(response('A'))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', 'A', 0, register))

  act(() => result.current.change('B'))
  await act(async () => vi.advanceTimersByTimeAsync(700))
  expect(saveMemberNote).toHaveBeenCalledExactlyOnceWith('admin', 'ana', 'B', 0, expect.any(AbortSignal))
  act(() => result.current.change('A'))
  await act(async () => reject(new TypeError('Response lost after commit')))
  expect(result.current.status).toBe('error')

  const unload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unload)
  expect(unload.defaultPrevented).toBe(true)

  const proceed = vi.fn()
  await act(async () => { expect(guard?.(proceed)).toBe(true) })
  expect(result.current.leaveOpen).toBe(true)
  expect(result.current.status).toBe('error')
  expect(proceed).not.toHaveBeenCalled()
  expect(saveMemberNote).toHaveBeenLastCalledWith('admin', 'ana', 'A', 0, expect.any(AbortSignal))

  await act(async () => result.current.retry())
  expect(saveMemberNote).toHaveBeenCalledTimes(3)
  expect(saveMemberNote).toHaveBeenLastCalledWith('admin', 'ana', 'A', 0, expect.any(AbortSignal))
  expect(result.current.status).toBe('saved')
  expect(result.current.leaveOpen).toBe(false)
  expect(proceed).toHaveBeenCalledOnce()
  expect(guard?.(vi.fn())).toBe(false)
  const confirmed = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(confirmed)
  expect(confirmed.defaultPrevented).toBe(false)
})

test('failed ignored logout restores autosave and preserves edits made during logout', async () => {
  let finishOld!: (value: MemberNote) => void
  let failLogout!: (error: Error) => void
  vi.mocked(saveMemberNote).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    .mockResolvedValueOnce(response('latest'))
    .mockResolvedValueOnce(response('after', 2))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', 'A', 0, register))
  const logout = vi.fn(() => new Promise<void>((_resolve, reject) => { failLogout = reject }))
  act(() => result.current.change('B'))
  act(() => { expect(guard?.(logout)).toBe(true) })
  const signal = vi.mocked(saveMemberNote).mock.calls[0][4]
  act(() => result.current.ignoreLeave())
  expect(logout).toHaveBeenCalledOnce()
  expect(signal?.aborted).toBe(true)
  act(() => result.current.change('latest'))
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(saveMemberNote).toHaveBeenCalledOnce()
  await act(async () => failLogout(new Error('Logout failed')))
  expect(result.current.status).toBe('pending')
  const unload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unload)
  expect(unload.defaultPrevented).toBe(true)
  await act(async () => finishOld(response('B')))
  await act(async () => vi.advanceTimersByTimeAsync(700))
  expect(saveMemberNote).toHaveBeenLastCalledWith('admin', 'ana', 'latest', 0, expect.any(AbortSignal))
  expect(result.current.status).toBe('saved')
  act(() => result.current.change('after'))
  const proceed = vi.fn()
  await act(async () => { expect(guard?.(proceed)).toBe(true) })
  expect(saveMemberNote).toHaveBeenLastCalledWith('admin', 'ana', 'after', 1, expect.any(AbortSignal))
  expect(proceed).toHaveBeenCalledOnce()
  expect(logout).toHaveBeenCalledOnce()
})

test('failed ignored logout reconciles an aborted write even if draft equals the last confirmed content', async () => {
  let finish!: (value: MemberNote) => void
  vi.mocked(saveMemberNote).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce(response('A'))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', 'A', 0, register))
  act(() => result.current.change('B'))
  await act(async () => vi.advanceTimersByTimeAsync(700))
  act(() => result.current.change('A'))
  act(() => { expect(guard?.(async () => { throw new Error('logout') })).toBe(true) })
  await act(async () => result.current.ignoreLeave())
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  await act(async () => finish(response('B')))
  await act(async () => vi.advanceTimersByTimeAsync(700))
  expect(saveMemberNote).toHaveBeenLastCalledWith('admin', 'ana', 'A', 0, expect.any(AbortSignal))
  expect(result.current.status).toBe('saved')
})

test('successful ignored logout does not restart saves while awaiting exit or after completion', async () => {
  let finish!: (value: MemberNote) => void
  let finishLogout!: () => void
  vi.mocked(saveMemberNote).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result, unmount } = renderHook(() => useNoteAutosave('admin', 'ana', '', 0, register))
  const logout = vi.fn(() => new Promise<void>(resolve => { finishLogout = resolve }))
  act(() => result.current.change('draft'))
  act(() => { expect(guard?.(logout)).toBe(true) })
  act(() => { result.current.ignoreLeave(); result.current.ignoreLeave(); result.current.change('during logout') })
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(logout).toHaveBeenCalledOnce()
  expect(saveMemberNote).toHaveBeenCalledOnce()
  await act(async () => finishLogout())
  unmount()
  await act(async () => finish(response('draft')))
  await act(async () => vi.advanceTimersByTimeAsync(2000))
  expect(saveMemberNote).toHaveBeenCalledOnce()
})

test('failed ignored logout cannot re-enable saving after authorization loss', async () => {
  vi.mocked(saveMemberNote).mockRejectedValueOnce(new ApiError('Denied', 409))
  let guard: LeaveGuard | undefined
  const register = (value: LeaveGuard) => { guard = value; return () => { guard = undefined } }
  const { result } = renderHook(() => useNoteAutosave('admin', 'ana', '', 0, register))
  act(() => result.current.change('draft'))
  await act(async () => { expect(guard?.(async () => { throw new Error('logout') })).toBe(true) })
  expect(result.current.status).toBe('session-changed')
  await act(async () => result.current.ignoreLeave())
  act(() => result.current.change('new'))
  await act(async () => { result.current.retry(); await vi.advanceTimersByTimeAsync(2000) })
  expect(result.current.status).toBe('session-changed')
  expect(saveMemberNote).toHaveBeenCalledOnce()
  expect(guard?.(vi.fn())).toBe(true)
})
