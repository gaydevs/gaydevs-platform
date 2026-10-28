import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useSectionBrandVisibility } from '../components/useSectionBrandVisibility'
import { getPoll, listPolls, pollErrorMessage, type Poll, type PollListResponse } from './pollsApi'
import { animatePollCardReorder } from './pollPresentation'
import { mergePolls, normalizePollList, POLL_PAGE_SIZE, POLL_REFRESH_INTERVAL_MS } from './pollRoutes'

interface UsePollListOptions {
  identifier: string | null
  create: boolean
  userId: string | null
  sessionRestoring: boolean
  requestKey: string
  onBrandVisibilityChange?: (visible: boolean) => void
}

export interface PollListState {
  polls: Poll[]
  poll: Poll | null
  setPoll: (poll: Poll | null) => void
  loading: boolean
  error: string
  listPage: { next_cursor: string | null; has_more: boolean }
  loadingMore: boolean
  listLoadError: string
  routeLoading: boolean
  unauthenticatedLanding: boolean
  transitioningToDetail: boolean
  hasDisplayedLanding: RefObject<boolean | null>
  brandIcon: RefObject<HTMLImageElement | null>
  pollListSentinel: RefObject<HTMLDivElement | null>
  registerPollCard: (id: string, node: HTMLElement | null) => void
}

export function usePollList({ identifier, create, userId, sessionRestoring, requestKey, onBrandVisibilityChange }: UsePollListOptions): PollListState {
  const [polls, setPolls] = useState<Poll[]>([])
  const [poll, setPoll] = useState<Poll | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [listPage, setListPage] = useState({ next_cursor: null as string | null, has_more: false })
  const [loadingMore, setLoadingMore] = useState(false)
  const [listLoadError, setListLoadError] = useState('')
  const brandIcon = useRef<HTMLImageElement>(null)
  const hasDisplayedLanding = useRef(false)
  const waitingForSession = Boolean(!create && sessionRestoring)
  const unauthenticatedLanding = !identifier && !create && !sessionRestoring && !userId
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null)
  const [transitioningToDetail, setTransitioningToDetail] = useState(false)
  const pollCardNodes = useRef(new Map<string, HTMLElement>())
  const pollCardPositionsBeforeUpdate = useRef<Map<string, DOMRect> | null>(null)
  const pollListSentinel = useRef<HTMLDivElement | null>(null)
  const listPageRef = useRef(listPage)
  const listSyncAt = useRef<string | null>(null)
  const listVersion = useRef(0)
  const loadingMoreRef = useRef(false)
  const listRefreshInFlight = useRef(false)
  const registerPollCard = useCallback((id: string, node: HTMLElement | null) => {
    if (node) pollCardNodes.current.set(id, node)
    else pollCardNodes.current.delete(id)
  }, [])

  const capturePollCardPositions = useCallback(() => {
    pollCardPositionsBeforeUpdate.current = new Map([...pollCardNodes.current.entries()].map(([id, node]) => [id, node.getBoundingClientRect()]))
  }, [])

  useLayoutEffect(() => {
    const previousPositions = pollCardPositionsBeforeUpdate.current
    pollCardPositionsBeforeUpdate.current = null
    animatePollCardReorder(previousPositions, pollCardNodes.current)
  }, [polls])

  useEffect(() => {
    if (!identifier || !hasDisplayedLanding.current) return
    setTransitioningToDetail(true)
    const timeout = window.setTimeout(() => setTransitioningToDetail(false), 280)
    return () => window.clearTimeout(timeout)
  }, [identifier])

  const loadMorePolls = useCallback(async () => {
    const page = listPageRef.current
    if (identifier || create || !page.has_more || !page.next_cursor || loadingMoreRef.current) return
    const version = listVersion.current
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const latest = normalizePollList(await listPolls({ limit: POLL_PAGE_SIZE, cursor: page.next_cursor }))
      if (version !== listVersion.current) return
      capturePollCardPositions()
      setPolls((current) => mergePolls(current, latest.polls))
      listPageRef.current = { next_cursor: latest.next_cursor, has_more: latest.has_more }
      setListPage(listPageRef.current)
      setListLoadError('')
    } catch (reason) {
      if (version === listVersion.current) setListLoadError(pollErrorMessage(reason))
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [capturePollCardPositions, create, identifier])

  useEffect(() => {
    let active = true
    if (create || waitingForSession || unauthenticatedLanding) return () => { active = false }
    const version = ++listVersion.current
    if (!identifier) listSyncAt.current = null
    const load = identifier ? getPoll(identifier) : listPolls({ limit: POLL_PAGE_SIZE })
    Promise.resolve(load).then((value) => {
      if (!active || version !== listVersion.current) return
      setError('')
      setListLoadError('')
      if (Array.isArray(value)) {
        setPolls(value)
        listPageRef.current = { next_cursor: null, has_more: false }
        setListPage(listPageRef.current)
        listSyncAt.current = new Date().toISOString()
      } else if (identifier) {
        setPoll(value as Poll)
      } else {
        const page = normalizePollList(value as PollListResponse | Poll[])
        setPolls(page.polls)
        listPageRef.current = { next_cursor: page.next_cursor, has_more: page.has_more }
        setListPage(listPageRef.current)
        listSyncAt.current = page.synced_at
      }
    }).catch((reason) => { if (active && version === listVersion.current) setError(pollErrorMessage(reason)) }).finally(() => { if (active && version === listVersion.current) { setLoading(false); setLoadedRequestKey(requestKey) } })
    return () => { active = false }
  }, [identifier, create, requestKey, unauthenticatedLanding, waitingForSession])

  const routeLoading = waitingForSession || loading || loadedRequestKey !== requestKey

  useEffect(() => {
    if (identifier || create || waitingForSession || routeLoading || !listPage.has_more) return
    const sentinel = pollListSentinel.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMorePolls()
    }, { rootMargin: '480px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [create, identifier, listPage.has_more, loadMorePolls, loadingMore, routeLoading, waitingForSession])

  useEffect(() => {
    if (identifier || create || waitingForSession || routeLoading) return
    let active = true
    const refresh = () => {
      const since = listSyncAt.current
      if (!active || !since || document.visibilityState === 'hidden' || listRefreshInFlight.current) return
      listRefreshInFlight.current = true
      void listPolls({ since }).then((response) => {
        if (!active) return
        const latest = normalizePollList(response)
        if (latest.polls.length > 0) {
          capturePollCardPositions()
          setError('')
          setPolls((current) => mergePolls(current, latest.polls))
        }
        listSyncAt.current = latest.synced_at
      }).catch(() => undefined).finally(() => { listRefreshInFlight.current = false })
    }
    const interval = window.setInterval(refresh, POLL_REFRESH_INTERVAL_MS)
    return () => { active = false; window.clearInterval(interval) }
  }, [capturePollCardPositions, create, identifier, routeLoading, waitingForSession])

  useEffect(() => {
    if (!identifier && !routeLoading && !error) hasDisplayedLanding.current = true
  }, [identifier, routeLoading, error])

  useSectionBrandVisibility({
    brandRef: brandIcon,
    enabled: !identifier && !create && !loading && !routeLoading,
    onVisibilityChange: onBrandVisibilityChange,
  })

  return { polls, poll, setPoll, loading, error, listPage, loadingMore, listLoadError, routeLoading, unauthenticatedLanding, transitioningToDetail, hasDisplayedLanding, brandIcon, pollListSentinel, registerPollCard }
}
