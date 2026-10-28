import { SectionAuthGate } from '../components/SectionAuthGate'
import { PollsBrand } from '../components/PollsBrand'
import { PollCard } from './PollCard'
import { PollDetailLoading, PollListBatchLoading, PollLoading, PollsLandingPreview } from './PollLoadingStates'
import { PollCreate } from './PollCreate'
import { PollDetail } from './PollDetail'
import { usePollList } from './usePollList'
import type { AuthenticatedUser } from './auth/api'
import type { Poll } from './pollsApi'
import { pollsBase } from './pollRoutes'

export { PollCard } from './PollCard'
export { PollDetail } from './PollDetail'
export { PollDetailLoading, PollLoading } from './PollLoadingStates'
export { PollAuditDialog, PollCloseDialog, PollErrorDialog, PollHideOptionDialog } from './PollDialogs'
export { PollsSectionBar } from './PollSectionBar'

interface Props { identifier: string | null; user: AuthenticatedUser | null; onLogin: () => void; onNavigate: (path: string) => void; onAudit?: (poll: Poll) => void; onError?: (message: string) => void; onBrandVisibilityChange?: (visible: boolean) => void; create?: boolean; sessionRestoring?: boolean }

export function PollsPage({ identifier, user, onLogin, onNavigate, onAudit, onError, onBrandVisibilityChange, create = false, sessionRestoring = false }: Props) {
  const { polls, poll, setPoll, error, listPage, loadingMore, listLoadError, routeLoading, unauthenticatedLanding, transitioningToDetail, brandIcon, pollListSentinel, registerPollCard } = usePollList({ identifier, create, userId: user?.id ?? null, sessionRestoring, requestKey: `${identifier ?? 'list'}:${identifier ? user?.id ?? '' : ''}`, onBrandVisibilityChange })
  if (create) return <PollCreate user={user} onNavigate={onNavigate} />
  if (unauthenticatedLanding) return <SectionAuthGate mode="required" authenticated={Boolean(user)} restoring={sessionRestoring} fallback={<PollLoading />} onRequireLogin={onLogin}>{null}</SectionAuthGate>
  if (routeLoading) {
    if (identifier) return <div className="poll-route-transition">{transitioningToDetail && <PollsLandingPreview polls={polls} showCreate={user?.member_type === 'admin'} />}<PollDetailLoading /></div>
    return <PollLoading />
  }
  if (error) return <section className="polls-page container"><p className="poll-error">{error}</p></section>
  if (identifier && poll?.slug === identifier) return <PollDetail poll={poll} user={user} onLogin={onLogin} onAudit={() => onAudit?.(poll)} onError={onError} onNavigate={onNavigate} onUpdated={setPoll} />
  const base = pollsBase()
  const canCreate = user?.member_type === 'admin'
  return <section className="polls-page polls-page--landing container" aria-labelledby="polls-title">
    <div className="section-heading polls-landing-heading"><h1 className="polls-hero-title" id="polls-title"><PollsBrand className="polls-hero-brand" linked={false} iconRef={brandIcon} /></h1>{canCreate && <button className="poll-create-button" type="button" aria-label="Nova enquete" title="Nova enquete" onClick={() => onNavigate(`${base}/new`)}>+</button>}</div>
    {polls.length === 0 ? <p className="poll-empty">Ainda não há enquetes.</p> : <>
      <div className="poll-list">{polls.map((item) => <PollCard item={item} path={`${base}/${item.slug}`} onNavigate={onNavigate} cardRef={(node) => registerPollCard(item.id, node)} key={item.id} />)}</div>
      {listPage.has_more && <div className="poll-list-loader" ref={pollListSentinel} aria-busy={loadingMore}>
        {loadingMore && <PollListBatchLoading />}
        {listLoadError && <p className="poll-error poll-list-loader__error" role="alert">{listLoadError}</p>}
      </div>}
    </>}
  </section>
}
