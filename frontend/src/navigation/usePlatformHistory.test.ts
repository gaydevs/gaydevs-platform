// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { LeaveAction } from '../features/useNoteAutosave'
import { ensureHistory, historyDelta, pushHistory, readHistory, replaceHistory } from './history'
import { usePlatformHistory } from './usePlatformHistory'

beforeEach(() => {
  window.history.replaceState(null, '', '/home')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function setup() {
  const { result } = renderHook(() => usePlatformHistory())
  let proceed!: LeaveAction
  const guard = vi.fn((action: LeaveAction) => { proceed = action; return true })
  act(() => {
    result.current.navigate('/polls')
    pushHistory('#login')
    replaceHistory('#login/otp')
    replaceHistory('/polls')
    result.current.navigate('/notes')
    result.current.navigate('/notes/ana')
    result.current.registerLeaveGuard(guard)
  })
  return { result, guard, proceed: () => proceed() }
}

test('shared push and replace preserve physical indices across login steps and a branch', async () => {
  const home = ensureHistory()
  pushHistory('/polls')
  const polls = readHistory()
  pushHistory('#login')
  const login = readHistory()
  replaceHistory('#login/otp')
  replaceHistory('/polls')
  expect(readHistory().position?.key).toBe(login.position?.key)
  expect(historyDelta(home, readHistory())).toBe(2)
  expect(historyDelta(polls, readHistory())).toBe(1)
  window.history.back()
  await waitFor(() => expect(readHistory().position?.key).toBe(polls.position?.key))
  pushHistory('/notes')
  expect(historyDelta(home, readHistory())).toBe(2)
  expect(readHistory().position?.key).not.toBe(login.position?.key)
})

test('restores editor across login entries and resumes exactly the selected entry after approval', async () => {
  const { result, guard, proceed } = setup()
  const editor = readHistory()
  act(() => window.history.go(-2))
  await waitFor(() => expect(guard).toHaveBeenCalledOnce())
  await waitFor(() => expect(readHistory().position?.key).toBe(editor.position?.key))
  expect(result.current.pathname).toBe('/notes/ana')
  await act(async () => { await proceed() })
  await waitFor(() => expect(result.current.pathname).toBe('/polls'))
  expect(historyDelta(editor, readHistory())).toBe(-2)
  expect(guard).toHaveBeenCalledOnce()
})

test('canceling a blocked multi-entry back stays on the editor and permits a subsequent attempt', async () => {
  const { result, guard, proceed } = setup()
  const editor = readHistory()
  act(() => window.history.go(-3))
  await waitFor(() => expect(guard).toHaveBeenCalledOnce())
  await waitFor(() => expect(readHistory().position?.key).toBe(editor.position?.key))
  // Canceling the dialog drops the continuation; the restored entry stays current.
  expect(result.current.pathname).toBe('/notes/ana')
  act(() => window.history.go(-2))
  await waitFor(() => expect(guard).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(readHistory().position?.key).toBe(editor.position?.key))
  await act(async () => { await proceed() })
  await waitFor(() => expect(result.current.pathname).toBe('/polls'))
  expect(historyDelta(editor, readHistory())).toBe(-2)
})

test('unknown legacy entries use a safe fallback instead of a fabricated physical offset', async () => {
  const { result } = renderHook(() => usePlatformHistory())
  const legacy = { gdevsIndex: 0 }
  // Simulate an old login entry that does not belong to the tracked chain.
  act(() => { window.history.pushState(legacy, '', '/polls'); window.dispatchEvent(new PopStateEvent('popstate')) })
  act(() => result.current.navigate('/notes/ana'))
  let proceed!: LeaveAction
  const guard = vi.fn((action: LeaveAction) => { proceed = action; return true })
  act(() => result.current.registerLeaveGuard(guard))
  // The home entry belongs to a different chain after the untracked entry.
  const go = vi.spyOn(window.history, 'go')
  act(() => window.history.go(-2))
  await waitFor(() => expect(guard).toHaveBeenCalledOnce())
  await waitFor(() => expect(window.location.pathname).toBe('/notes/ana'))
  expect(go).toHaveBeenCalledTimes(1)
  await act(async () => { await proceed() })
  expect(result.current.pathname).toBe('/home')
  expect(window.location.pathname).toBe('/home')
})

test('a silent failed restoration cannot strand an already approved continuation', async () => {
  const { result, guard, proceed } = setup()
  const actualGo = window.history.go.bind(window.history)
  const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined)
  act(() => actualGo(-2))
  await waitFor(() => expect(guard).toHaveBeenCalledOnce())
  expect(go).toHaveBeenCalledWith(2)
  await act(async () => { await proceed() })
  await waitFor(() => expect(result.current.pathname).toBe('/polls'), { timeout: 3000 })
  expect(window.location.pathname).toBe('/polls')
  expect(guard).toHaveBeenCalledOnce()
})

test('a silent failed resume falls back to the approved URL rather than bypassing later guards', async () => {
  const { result, guard, proceed } = setup()
  const editor = readHistory()
  act(() => window.history.go(-2))
  await waitFor(() => expect(guard).toHaveBeenCalledOnce())
  await waitFor(() => expect(readHistory().position?.key).toBe(editor.position?.key))
  const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined)
  await act(async () => { await proceed() })
  expect(go).toHaveBeenCalledWith(-2)
  await waitFor(() => expect(result.current.pathname).toBe('/polls'), { timeout: 3000 })
  expect(window.location.pathname).toBe('/polls')
  act(() => result.current.navigate('/notes'))
  expect(guard).toHaveBeenCalledTimes(2)
})
