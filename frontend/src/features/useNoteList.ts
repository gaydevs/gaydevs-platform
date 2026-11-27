import { useEffect, useState } from 'react'
import { ApiError } from './auth/api'
import { listNoteMembers, type NoteMember } from './notesApi'
import { POLL_REFRESH_INTERVAL_MS } from './pollRoutes'

export const NOTES_REFRESH_INTERVAL_MS = POLL_REFRESH_INTERVAL_MS

export function useNoteList(actorId: string) {
  const [snapshot, setSnapshot] = useState<{ actorId: string; members: NoteMember[] | null; error: string; restricted?: boolean } | null>(null)

  useEffect(() => {
    let active = true
    let blocked = false
    let loaded = false
    let request: AbortController | null = null

    const refresh = async () => {
      if (!active || blocked || request) return
      const controller = new AbortController()
      request = controller
      try {
        const items = await listNoteMembers(actorId, controller.signal)
        if (!active || controller.signal.aborted) return
        loaded = true
        setSnapshot({ actorId, members: [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id)), error: '' })
      } catch (error) {
        if (!active || controller.signal.aborted) return
        if (error instanceof ApiError && [401, 403, 409].includes(error.status)) {
          blocked = true
          setSnapshot({ actorId, members: null, error: error.status === 403 ? 'Área restrita.' : 'Sessão alterada. Recarregue a página.', restricted: error.status === 403 })
        } else if (!loaded) {
          setSnapshot({ actorId, members: null, error: 'Não foi possível carregar os gdevs.' })
        }
      } finally {
        if (request === controller) request = null
      }
    }
    const refreshVisible = () => {
      if (document.visibilityState !== 'hidden') void refresh()
    }
    void refresh()
    const interval = window.setInterval(refreshVisible, NOTES_REFRESH_INTERVAL_MS)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      active = false
      request?.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [actorId])

  return snapshot?.actorId === actorId
    ? { members: snapshot.members, error: snapshot.error, restricted: Boolean(snapshot.restricted) }
    : { members: null, error: '', restricted: false }
}
