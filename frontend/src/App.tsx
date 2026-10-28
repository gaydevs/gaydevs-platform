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

export default function App() {
  // Os hooks mantêm autenticação e URL fora da árvore visual da landing page.
  const auth = useAuth()
  const login = useLoginHash()
  const { open: openLogin, close: closeLoginHash, showStep: showLoginStep, step: loginStep } = login
  const refreshAuth = auth.refresh
  const [brandVisible, setBrandVisible] = useState(true)
  const [auditPoll, setAuditPoll] = useState<Poll | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const pollsLoginPrompt = useRef(false)
  const loginCompleted = useRef(false)
  const [pathname, setPathname] = useState(() => typeof window === 'undefined' ? '/' : window.location.pathname)
  useEffect(() => {
    const synchronizePathname = () => setPathname(window.location.pathname)
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
    const target = new URL(path, window.location.origin)
    if (target.origin !== window.location.origin) {
      window.location.assign(path)
      return
    }
    const next = `${target.pathname}${target.search}${target.hash}`
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.pushState(null, '', next)
    setPathname(target.pathname)
    window.scrollTo(0, 0)
  }, [])
  const pollsMarker = '/polls'
  const pollsIndex = pathname.indexOf(pollsMarker)
  const pollIdentifier = pollsIndex >= 0 ? pathname.slice(pollsIndex + pollsMarker.length).replace(/^\/+|\/+$/g, '') || null : null
  const createPoll = pollIdentifier === 'new'
  const isPollsSection = pollsIndex >= 0
  const isLandingPage = !isPollsSection
  const isPollsLanding = isPollsSection && pollIdentifier === null
  const pollsPath = isPollsSection ? pathname.slice(0, pollsIndex) + pollsMarker : pollsMarker
  const homePath = pollsPath.slice(0, -pollsMarker.length) || '/'
  const showPollsSectionBar = isPollsSection && (!isPollsLanding || !brandVisible)
  const openAudit = useCallback((poll: Poll) => {
    if (auth.user) setAuditPoll(poll)
    else openLogin()
  }, [auth.user, openLogin])
  const showPollError = useCallback((message: string) => setPollError(message), [])
  const openPollsLogin = useCallback(() => {
    pollsLoginPrompt.current = true
    loginCompleted.current = false
    openLogin()
  }, [openLogin])
  const closeLogin = useCallback(() => {
    const redirectToHome = pollsLoginPrompt.current && !loginCompleted.current
    pollsLoginPrompt.current = false
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
    <AccountHeader user={auth.user} restoring={auth.restoring} brandVisible={isLandingPage && brandVisible} onLogin={login.open} onLogout={auth.logout} onNavigate={navigate} />
    <PollsSectionBar visible={showPollsSectionBar} path={pollsPath} onNavigate={navigate} />
    <main id="conteudo">
      {pollsIndex >= 0 ? <PollsPage identifier={createPoll ? null : pollIdentifier} create={createPoll} user={auth.user} sessionRestoring={auth.restoring} onLogin={isPollsLanding ? openPollsLogin : login.open} onNavigate={navigate} onAudit={openAudit} onError={showPollError} onBrandVisibilityChange={setBrandVisible} /> : <>
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
