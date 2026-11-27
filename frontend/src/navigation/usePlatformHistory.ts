import { useCallback, useEffect, useRef, useState } from 'react'
import type { LeaveGuard } from '../features/useNoteAutosave'
import { ensureHistory, historyDelta, PLATFORM_HISTORY_CHANGE, pushHistory, readHistory, sameEntry, type HistoryLocation } from './history'

// history.go has no completion promise and may silently do nothing.
export const HISTORY_TRAVERSAL_TIMEOUT = 1000

type Traversal = {
  expected: HistoryLocation
  timer: number
  complete: (matched: boolean) => void
}

export function usePlatformHistory() {
  const [pathname, setPathname] = useState(() => typeof window === 'undefined' ? '/' : window.location.pathname)
  const leaveGuard = useRef<LeaveGuard | null>(null)
  const registerLeaveGuard = useCallback((guard: LeaveGuard) => {
    leaveGuard.current = guard
    return () => { if (leaveGuard.current === guard) leaveGuard.current = null }
  }, [])
  const locationRef = useRef<HistoryLocation | null>(null)
  const traversal = useRef<Traversal | null>(null)

  useEffect(() => {
    const synchronize = () => {
      locationRef.current = ensureHistory()
      setPathname(window.location.pathname)
    }
    synchronize()

    const settleTraversal = (matched: boolean) => {
      const pending = traversal.current
      if (!pending) return
      window.clearTimeout(pending.timer)
      traversal.current = null
      pending.complete(matched)
    }

    const go = (delta: number, expected: HistoryLocation, complete: Traversal['complete']) => {
      const timer = window.setTimeout(() => settleTraversal(sameEntry(readHistory(), expected)), HISTORY_TRAVERSAL_TIMEOUT)
      traversal.current = { expected, timer, complete }
      try { window.history.go(delta) } catch { settleTraversal(false) }
    }

    const onPopState = () => {
      const previous = locationRef.current
      const target = readHistory()
      const pending = traversal.current
      if (pending) {
        // Never accept an unexpected destination as the completion of our traversal.
        settleTraversal(sameEntry(target, pending.expected))
        return
      }
      if (previous && leaveGuard.current && previous.href !== target.href) {
        const delta = historyDelta(previous, target)
        let restored = false
        let approved = false
        let canResumeTraversal = false
        let resumed = false
        const resume = () => {
          if (!restored || !approved || resumed) return
          resumed = true
          if (canResumeTraversal && sameEntry(readHistory(), previous)) {
            go(delta, target, matched => {
              if (matched) synchronize()
              else pushHistory(target.href)
            })
          } else pushHistory(target.href)
        }
        const proceed = () => { approved = true; resume() }
        if (leaveGuard.current(proceed)) {
          const restore = (matched: boolean) => {
            canResumeTraversal = matched
            if (matched) synchronize()
            else pushHistory(previous.href)
            restored = true
            resume()
          }
          if (delta) go(-delta, previous, restore)
          else restore(false)
          return
        }
      }
      synchronize()
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener(PLATFORM_HISTORY_CHANGE, synchronize)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener(PLATFORM_HISTORY_CHANGE, synchronize)
      if (traversal.current) window.clearTimeout(traversal.current.timer)
      traversal.current = null
    }
  }, [])

  const navigate = useCallback((path: string) => {
    const target = new URL(path, window.location.href)
    const proceed = () => {
      if (target.origin !== window.location.origin) {
        window.location.assign(path)
        return
      }
      if (target.href !== window.location.href) pushHistory(target.href)
      setPathname(target.pathname)
      window.scrollTo(0, 0)
    }
    if (target.href !== window.location.href && leaveGuard.current?.(proceed)) return
    proceed()
  }, [])

  return { pathname, navigate, registerLeaveGuard, leaveGuard }
}
