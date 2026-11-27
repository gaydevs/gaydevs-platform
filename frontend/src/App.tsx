import { useCallback, useEffect, useRef, useState } from 'react'
import { Hero } from './sections/Hero'
import { About } from './sections/About'
import { Topics } from './sections/Topics'
import { Events } from './sections/Events'
import { Timeline } from './sections/Timeline'
import { Gallery } from './sections/Gallery'
import { Community } from './sections/Community'
import { Lore } from './sections/Lore'
import { FinalCta } from './sections/FinalCta'
import { Footer } from './sections/Footer'
import { about, accessibility, developerLinks, finalCta, footer, hero, publicLinks, sections, topics } from './data/site'
import { events, formatGuide } from './data/events'
import { timeline } from './data/timeline'
import { photos } from './data/photos'
import { community } from './data/community'
import { lore } from './data/lore'
import { images } from './data/images'
import { useAuth } from './features/auth/useAuth'
import { useLoginHash } from './features/auth/useLoginHash'
import { AccountHeader } from './components/AccountHeader'
import { LoginDialog } from './features/auth/LoginDialog'
import { PollAuditDialog, PollErrorDialog, PollsPage, PollsSectionBar } from './features/PollsPage'
import type { Poll } from './features/pollsApi'
import { NotesPage, NotesSectionBar } from './features/NotesPage'
import type { LeaveGuard } from './features/useNoteAutosave'

export default function App() {
  // Os hooks mantêm autenticação e URL fora da árvore visual da landing page.
  const auth = useAuth()
  const login = useLoginHash()
  const { open: openLogin, close: closeLoginHash, showStep: showLoginStep, step: loginStep } = login
  const refreshAuth = auth.refresh
  const logout = auth.logout
  const [logoutError, setLogoutError] = useState(false)
  const [brandVisible, setBrandVisible] = useState(true)
  const [auditPoll, setAuditPoll] = useState<Poll | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const sectionLoginPrompt = useRef(false)
  const loginCompleted = useRef(false)
  const [pathname, setPathname] = useState(() => typeof window === 'undefined' ? '/' : window.location.pathname)
  const leaveGuard = useRef<LeaveGuard | null>(null)
  const registerLeaveGuard = useCallback((guard: LeaveGuard) => {
    leaveGuard.current = guard
    return () => { if (leaveGuard.current === guard) leaveGuard.current = null }
  }, [])
  const locationRef = useRef<{ href: string; index: number } | null>(null)
  const restoringHistory = useRef<{ index: number; resume: (() => void) | null } | null>(null)
  const bypassHistory = useRef(false)
  useEffect(() => {
    const initialIndex = window.history.state?.gdevsIndex ?? 0
    window.history.replaceState({ ...window.history.state, gdevsIndex: initialIndex }, '')
    locationRef.current = { href: window.location.href, index: initialIndex }
    const synchronizePathname = () => {
      const previous = locationRef.current
      const target = { href: window.location.href, index: window.history.state?.gdevsIndex }
      const restoration = restoringHistory.current
      if (restoration && target.index === restoration.index) {
        restoringHistory.current = null
        restoration.resume?.()
        return
      }
      if (previous && !bypassHistory.current && leaveGuard.current) {
        const delta = typeof target.index === 'number' ? target.index - previous.index : 0
        const proceed = () => {
          if (delta) {
            const resume = () => { bypassHistory.current = true; window.history.go(delta) }
            if (restoringHistory.current) restoringHistory.current.resume = resume
            else resume()
          } else {
            window.history.pushState({ gdevsIndex: previous.index + 1 }, '', target.href)
            locationRef.current = { href: target.href, index: previous.index + 1 }
            setPathname(window.location.pathname)
          }
        }
        if (leaveGuard.current(proceed)) {
          if (delta) {
            restoringHistory.current = { index: previous.index, resume: null }
            window.history.go(-delta)
          } else {
            window.history.pushState({ gdevsIndex: previous.index }, '', previous.href)
          }
          return
        }
      }
      bypassHistory.current = false
      const index = typeof target.index === 'number' ? target.index : 0
      if (typeof target.index !== 'number') window.history.replaceState({ ...window.history.state, gdevsIndex: index }, '')
      locationRef.current = { href: target.href, index }
      setPathname(window.location.pathname)
    }
    window.addEventListener('popstate', synchronizePathname)
    return () => window.removeEventListener('popstate', synchronizePathname)
  }, [])
  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    return () => { window.history.scrollRestoration = previousScrollRestoration }
  }, [])
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname])
  const navigate = useCallback((path: string) => {
    const target = new URL(path, window.location.href)
    const proceed = () => {
      if (target.origin !== window.location.origin) {
        window.location.assign(path)
        return
      }
      if (target.href !== window.location.href) {
        const index = (locationRef.current?.index ?? 0) + 1
        window.history.pushState({ gdevsIndex: index }, '', target.href)
        locationRef.current = { href: target.href, index }
      }
      setPathname(target.pathname)
      window.scrollTo(0, 0)
    }
    if (target.href !== window.location.href && leaveGuard.current?.(proceed)) return
    proceed()
  }, [])
  const logoutWithFeedback = useCallback(async () => {
    setLogoutError(false)
    try {
      await logout()
    } catch (error) {
      setLogoutError(true)
      throw error
    }
  }, [logout])
  const guardedLogout = useCallback(async () => {
    if (leaveGuard.current?.(logoutWithFeedback)) return
    try {
      await logoutWithFeedback()
    } catch {
      // The account header reports the failure; do not leave an unhandled rejection.
    }
  }, [logoutWithFeedback])
  const pollsMarker = '/polls'
  const pollsIndex = pathname.indexOf(pollsMarker)
  const pollIdentifier = pollsIndex >= 0 ? pathname.slice(pollsIndex + pollsMarker.length).replace(/^\/+|\/+$/g, '') || null : null
  const createPoll = pollIdentifier === 'new'
  const isPollsSection = pollsIndex >= 0
  const notesIndex = pathname.search(/\/notes(?:\/|$)/)
  const isNotesSection = notesIndex >= 0
  const notesPath = isNotesSection ? pathname.slice(0, notesIndex) + '/notes' : '/notes'
  const noteMemberId = isNotesSection ? pathname.slice(notesIndex + '/notes'.length).replace(/^\/+|\/+$/g, '') || null : null
  const isLandingPage = !isPollsSection && !isNotesSection
  const isPollsLanding = isPollsSection && pollIdentifier === null
  const pollsPath = isPollsSection ? pathname.slice(0, pollsIndex) + pollsMarker : pollsMarker
  const homePath = (isNotesSection ? notesPath.slice(0, -'/notes'.length) : pollsPath.slice(0, -pollsMarker.length)) || '/'
  const showNotesSectionBar = isNotesSection && (noteMemberId !== null || !brandVisible)
  const showPollsSectionBar = isPollsSection && (!isPollsLanding || !brandVisible)
  const openAudit = useCallback((poll: Poll) => {
    if (auth.user) setAuditPoll(poll)
    else openLogin()
  }, [auth.user, openLogin])
  const showPollError = useCallback((message: string) => setPollError(message), [])
  const openSectionLogin = useCallback(() => {
    sectionLoginPrompt.current = true
    loginCompleted.current = false
    openLogin()
  }, [openLogin])
  const closeLogin = useCallback(() => {
    const redirectToHome = sectionLoginPrompt.current && !loginCompleted.current
    sectionLoginPrompt.current = false
    loginCompleted.current = false
    closeLoginHash()
    if (redirectToHome) navigate(homePath)
  }, [closeLoginHash, homePath, navigate])
  const handleLoginAuthenticated = useCallback(async () => {
    const sessionUser = await refreshAuth()
    loginCompleted.current = true
    return sessionUser
  }, [refreshAuth])

  return <>
    <a className="skip-link" href="#conteudo">{accessibility.skip}</a>
    <AccountHeader user={auth.user} restoring={auth.restoring} brandVisible={isLandingPage && brandVisible} onLogin={login.open} onLogout={guardedLogout} logoutError={Boolean(auth.user) && logoutError} onNavigate={navigate} />
    <PollsSectionBar visible={showPollsSectionBar} path={pollsPath} onNavigate={navigate} />
    {isNotesSection && auth.user?.member_type === 'admin' && <NotesSectionBar visible={showNotesSectionBar} path={notesPath} onNavigate={navigate} />}
    <main id="conteudo">
      {isNotesSection ? <NotesPage memberId={noteMemberId} base={notesPath} user={auth.user} restoring={auth.restoring} onLogin={openSectionLogin} loginOpen={Boolean(loginStep)} onNavigate={navigate} onBrandVisibilityChange={setBrandVisible} registerGuard={registerLeaveGuard} /> : pollsIndex >= 0 ? <PollsPage identifier={createPoll ? null : pollIdentifier} create={createPoll} user={auth.user} sessionRestoring={auth.restoring} onLogin={isPollsLanding ? openSectionLogin : login.open} onNavigate={navigate} onAudit={openAudit} onError={showPollError} onBrandVisibilityChange={setBrandVisible} /> : <>
      <Hero content={hero} mobile={images.heroMobile} desktop={images.heroDesktop} onBrandVisibilityChange={setBrandVisible} />
      <About content={about} />
      <Topics content={topics} />
      <Events content={sections.events} formats={events} photos={photos} guide={formatGuide} />
      <Timeline content={sections.timeline} items={timeline} />
      <Gallery content={sections.gallery} photos={photos} />
      <Community content={sections.community} spaces={community} />
      <Lore content={sections.lore} profiles={lore} mascot={images.cleito} mascotAlt={accessibility.cleito} />
      <FinalCta content={finalCta} links={publicLinks} />
      </>}
    </main>
    <Footer content={footer} developerLinks={developerLinks} />
    {/* Montar só quando aberto garante estado novo a cada reabertura. */}
    {loginStep && <LoginDialog step={loginStep} onStepChange={showLoginStep} onClose={closeLogin} onAuthenticated={handleLoginAuthenticated} />}
    {auditPoll && auth.user && <PollAuditDialog key={auditPoll.slug} poll={auditPoll} onClose={() => setAuditPoll(null)} />}
    {pollError && <PollErrorDialog message={pollError} onClose={() => setPollError(null)} />}
  </>
}
