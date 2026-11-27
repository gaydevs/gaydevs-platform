import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from './auth/api'
import { saveMemberNote } from './notesApi'

export type LeaveGuard = (proceed: () => void) => boolean
export type RegisterLeaveGuard = (guard: LeaveGuard) => () => void
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'session-changed'
export const NOTE_SAVE_DELAY = 700

export function useNoteAutosave(actorId: string, memberId: string, initial: string, registerGuard?: RegisterLeaveGuard) {
  const latest = useRef(initial)
  const persisted = useRef(initial)
  const inFlight = useRef(false)
  const activeRequest = useRef<AbortController | null>(null)
  const sessionChanged = useRef(false)
  const timer = useRef<number | null>(null)
  const mounted = useRef(true)
  const leave = useRef<(() => void) | null>(null)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [leaveOpen, setLeaveOpen] = useState(false)

  const clearTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }, [])
  const dirty = useCallback(() => inFlight.current || latest.current !== persisted.current, [])

  const flush = useCallback(async function flushLatest() {
    clearTimer()
    if (!mounted.current || inFlight.current || sessionChanged.current) return
    const finish = () => {
      setStatus('saved')
      const proceed = leave.current
      leave.current = null
      setLeaveOpen(false)
      proceed?.()
    }
    if (!dirty()) { finish(); return }
    const content = latest.current
    if (content.length > 10000) { setStatus('error'); return }
    inFlight.current = true
    setStatus('saving')
    const controller = new AbortController()
    activeRequest.current = controller
    try {
      await saveMemberNote(actorId, memberId, content, controller.signal)
      if (controller.signal.aborted) return
      persisted.current = content
    } catch (error) {
      if (controller.signal.aborted) return
      inFlight.current = false
      if (mounted.current) {
        if (error instanceof ApiError && [401, 403, 409].includes(error.status)) {
          sessionChanged.current = true
          setStatus('session-changed')
        } else setStatus('error')
      }
      return
    }
    inFlight.current = false
    if (!mounted.current) return
    if (dirty()) void flushLatest()
    else finish()
  }, [actorId, clearTimer, dirty, memberId])

  const change = useCallback((content: string) => {
    if (sessionChanged.current || !mounted.current) return
    latest.current = content
    clearTimer()
    if (!dirty()) { setStatus('saved'); return }
    if (!inFlight.current) {
      setStatus('pending')
      timer.current = window.setTimeout(() => void flush(), NOTE_SAVE_DELAY)
    }
  }, [clearTimer, dirty, flush])

  const guard = useCallback<LeaveGuard>((proceed) => {
    if (!dirty()) return false
    leave.current = proceed
    setLeaveOpen(true)
    void flush()
    return true
  }, [dirty, flush])

  useEffect(() => {
    mounted.current = true
    const unregister = registerGuard?.(guard)
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty()) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      mounted.current = false
      activeRequest.current?.abort()
      inFlight.current = false
      leave.current = null
      clearTimer()
      unregister?.()
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [clearTimer, dirty, guard, registerGuard])

  const cancelLeave = () => { leave.current = null; setLeaveOpen(false) }
  return { change, status, leaveOpen, cancelLeave, retry: () => void flush() }
}
