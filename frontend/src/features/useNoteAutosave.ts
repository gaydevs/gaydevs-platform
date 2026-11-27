import { useCallback, useEffect, useRef, useState } from 'react'
import { saveMemberNote } from './notesApi'

export type LeaveGuard = (proceed: () => void) => boolean
export type RegisterLeaveGuard = (guard: LeaveGuard) => () => void
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'
export const NOTE_SAVE_DELAY = 700

export function useNoteAutosave(memberId: string, initial: string, registerGuard?: RegisterLeaveGuard) {
  const latest = useRef(initial)
  const persisted = useRef(initial)
  const inFlight = useRef(false)
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
    if (!mounted.current || inFlight.current) return
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
    try {
      await saveMemberNote(memberId, content)
      persisted.current = content
    } catch {
      inFlight.current = false
      if (mounted.current) setStatus('error')
      return
    }
    inFlight.current = false
    if (!mounted.current) return
    if (dirty()) void flushLatest()
    else finish()
  }, [clearTimer, dirty, memberId])

  const change = useCallback((content: string) => {
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
      clearTimer()
      unregister?.()
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [clearTimer, dirty, guard, registerGuard])

  const cancelLeave = () => { leave.current = null; setLeaveOpen(false) }
  return { change, status, leaveOpen, cancelLeave, retry: () => void flush() }
}
