import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from './auth/api'
import { getMemberNote, saveMemberNote } from './notesApi'
import { NoteVersionConflict, type MemberNote } from './noteVersion'

export type LeaveAction = () => void | Promise<void>
export type LeaveGuard = (proceed: LeaveAction) => boolean
export type RegisterLeaveGuard = (guard: LeaveGuard) => () => void
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'session-changed'
export const NOTE_SAVE_DELAY = 700

// Navigation is synchronous, but logout must be allowed to report a failed exit.
function runLeaveAction(action: LeaveAction, onFailure: () => void) {
  try {
    const result = action()
    if (result) void result.catch(onFailure)
  } catch {
    onFailure()
  }
}

export function useNoteAutosave(actorId: string, memberId: string, initial: string, initialVersion: number, registerGuard?: RegisterLeaveGuard) {
  const latest = useRef(initial)
  const persisted = useRef(initial)
  const version = useRef(initialVersion)
  const conflictRef = useRef<MemberNote | null>(null)
  const [conflict, setConflict] = useState<MemberNote | null>(null)
  const [resolutionBusy, setResolutionBusy] = useState(false)
  const [resolutionError, setResolutionError] = useState('')
  const [editorSnapshot, setEditorSnapshot] = useState({ content: initial, generation: 0 })
  const persistenceUncertain = useRef(false)
  const inFlight = useRef(false)
  const activeRequest = useRef<AbortController | null>(null)
  const sessionChanged = useRef(false)
  const abandoned = useRef(false)
  const timer = useRef<number | null>(null)
  const mounted = useRef(true)
  const leave = useRef<LeaveAction | null>(null)
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [leaveOpen, setLeaveOpen] = useState(false)

  const clearTimer = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }, [])
  const dirty = useCallback(() => !abandoned.current && (conflictRef.current !== null || inFlight.current || persistenceUncertain.current || latest.current !== persisted.current), [])

  const updateConflict = useCallback((value: MemberNote | null) => {
    conflictRef.current = value
    setConflict(value)
  }, [])

  const finish = useCallback(() => {
    setStatus('saved')
    const proceed = leave.current
    leave.current = null
    setLeaveOpen(false)
    if (proceed) runLeaveAction(proceed, () => { /* The exit action owns its error feedback. */ })
  }, [])

  const invalidateSession = useCallback(() => {
    sessionChanged.current = true
    updateConflict(null)
    setStatus('session-changed')
  }, [updateConflict])

  const flush = useCallback(async function flushLatest() {
    clearTimer()
    if (!mounted.current || abandoned.current || inFlight.current || sessionChanged.current || conflictRef.current) return
    if (!dirty()) { finish(); return }
    const content = latest.current
    if (content.length > 10000) { setStatus('error'); return }
    inFlight.current = true
    setStatus('saving')
    const controller = new AbortController()
    activeRequest.current = controller
    try {
      const saved = await saveMemberNote(actorId, memberId, content, version.current, controller.signal)
      if (controller.signal.aborted || !mounted.current) return
      version.current = saved.version
      persisted.current = content
      persistenceUncertain.current = false
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return
      if (error instanceof NoteVersionConflict) {
        inFlight.current = false
        if (error.note.content === content || error.note.content === latest.current) {
          version.current = error.note.version
          persisted.current = error.note.content
          persistenceUncertain.current = false
          if (dirty()) void flushLatest()
          else finish()
        } else {
          persistenceUncertain.current = true
          setResolutionError('')
          updateConflict(error.note)
          setStatus('error')
        }
        return
      }
      // A failed response does not prove the server did not commit the write.
      persistenceUncertain.current = true
      inFlight.current = false
      if (mounted.current) {
        if (error instanceof ApiError && [401, 403, 409].includes(error.status)) {
          invalidateSession()
        } else setStatus('error')
      }
      return
    }
    inFlight.current = false
    if (!mounted.current) return
    if (dirty()) void flushLatest()
    else finish()
  }, [actorId, clearTimer, dirty, finish, invalidateSession, memberId, updateConflict])

  const change = useCallback((content: string) => {
    if (sessionChanged.current || !mounted.current || conflictRef.current) return
    latest.current = content
    // An asynchronous exit may fail; retain edits without sending them yet.
    if (abandoned.current) return
    clearTimer()
    if (!dirty()) { setStatus('saved'); return }
    if (!inFlight.current) {
      setStatus('pending')
      timer.current = window.setTimeout(() => void flush(), NOTE_SAVE_DELAY)
    }
  }, [clearTimer, dirty, flush])

  const guard = useCallback<LeaveGuard>((proceed) => {
    if (conflictRef.current) return true
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
  const ignoreLeave = () => {
    const proceed = leave.current
    if (!proceed || abandoned.current || conflictRef.current) return
    abandoned.current = true
    leave.current = null
    clearTimer()
    if (inFlight.current) persistenceUncertain.current = true
    activeRequest.current?.abort()
    inFlight.current = false
    setLeaveOpen(false)
    runLeaveAction(proceed, () => {
      if (!mounted.current) return
      abandoned.current = false
      if (sessionChanged.current) return
      if (!dirty()) { setStatus('saved'); return }
      setStatus('pending')
      timer.current = window.setTimeout(() => void flush(), NOTE_SAVE_DELAY)
    })
  }
  const resolveConflict = async (choice: 'reload' | 'overwrite') => {
    const remote = conflictRef.current
    if (!remote || inFlight.current || sessionChanged.current || !mounted.current) return
    const draft = latest.current
    inFlight.current = true
    setResolutionBusy(true)
    setResolutionError('')
    const controller = new AbortController()
    activeRequest.current = controller
    try {
      let saved: MemberNote
      if (choice === 'reload') saved = await getMemberNote(actorId, memberId, controller.signal)
      else {
        try {
          saved = await saveMemberNote(actorId, memberId, draft, remote.version, controller.signal)
        } catch (error) {
          if (!(error instanceof NoteVersionConflict) || error.note.content !== draft) throw error
          saved = error.note
        }
      }
      if (controller.signal.aborted || !mounted.current) return
      version.current = saved.version
      persisted.current = choice === 'reload' ? saved.content : draft
      latest.current = persisted.current
      persistenceUncertain.current = false
      if (choice === 'reload') setEditorSnapshot(previous => ({ content: saved.content, generation: previous.generation + 1 }))
      inFlight.current = false
      updateConflict(null)
      finish()
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return
      if (error instanceof NoteVersionConflict) {
        updateConflict(error.note)
        setResolutionError('A anotação mudou novamente. Escolha qual versão manter.')
      } else if (error instanceof ApiError && [401, 403, 409].includes(error.status)) {
        invalidateSession()
      } else {
        setResolutionError('Não foi possível concluir. Seu texto continua preservado. Tente novamente.')
      }
    } finally {
      if (!controller.signal.aborted && mounted.current) {
        inFlight.current = false
        setResolutionBusy(false)
      }
    }
  }
  return { change, status, leaveOpen, cancelLeave, ignoreLeave, retry: () => void flush(),
    conflict, resolutionBusy, resolutionError, editorSnapshot, resolveConflict }

}
