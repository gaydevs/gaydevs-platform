import { PollsBrand } from '../components/PollsBrand'
import { PollCard } from './PollCard'
import type { Poll } from './pollsApi'
import { pollsBase } from './pollRoutes'

export function PollLoading() {
  return <section className="polls-page container poll-loading" aria-busy="true" aria-live="polite">
    <div className="section-heading" aria-hidden="true"><h1 className="polls-hero-title"><PollsBrand className="polls-hero-brand" linked={false} /></h1></div>
    <div className="poll-list" aria-hidden="true">{[0, 1, 2].map((index) => <div className="poll-card poll-loading-card" key={index}><span className="poll-loading__status poll-loading__shine" /><span className="poll-loading__card-title poll-loading__shine" /><span className="poll-loading__card-date poll-loading__shine" /><span className="poll-loading__card-meta poll-loading__shine" /></div>)}</div>
    <span className="sr-only">Carregando enquete…</span>
  </section>
}

export function PollListBatchLoading() {
  return <div className="poll-list poll-list--batch-loading" aria-hidden="true">{[0, 1, 2].map((index) => <div className="poll-card poll-loading-card" key={index}><span className="poll-loading__status poll-loading__shine" /><span className="poll-loading__card-title poll-loading__shine" /><span className="poll-loading__card-date poll-loading__shine" /><span className="poll-loading__card-meta poll-loading__shine" /></div>)}</div>
}

export function PollDetailLoading() {
  return <section className="polls-page container poll-detail-loading" aria-busy="true" aria-live="polite">
    <div className="section-heading" aria-hidden="true">
      <span className="poll-loading__eyebrow poll-loading__shine" />
      <span className="poll-loading__detail-title poll-loading__shine" />
      <div className="poll-loading__tags">
        <span className="poll-loading__tag poll-loading__shine" />
        <span className="poll-loading__tag poll-loading__shine" />
        <span className="poll-loading__tag poll-loading__shine" />
      </div>
      <span className="poll-loading__detail-date poll-loading__shine" />
    </div>
    <div className="poll-options" aria-hidden="true">{[0, 1, 2, 3].map((index) => <div className="poll-option poll-loading-option" key={index}>
      <span className="poll-loading__option-check poll-loading__shine" />
      <span className="poll-loading__option-content"><span className="poll-loading__option-title poll-loading__shine" /><span className="poll-loading__option-meta poll-loading__shine" /></span>
      <span className="poll-loading__option-meter"><span className="poll-loading__shine" /></span>
    </div>)}</div>
    <span className="sr-only">Carregando enquete…</span>
  </section>
}

export function PollsLandingPreview({ polls, showCreate }: { polls: Poll[]; showCreate: boolean }) {
  const base = pollsBase()
  return <section className="polls-page polls-page--landing container poll-route-transition__outgoing" aria-hidden="true">
    <div className="section-heading polls-landing-heading"><h1 className="polls-hero-title"><PollsBrand className="polls-hero-brand" linked={false} /></h1>{showCreate && <span className="poll-create-button" aria-hidden="true">+</span>}</div>
    {polls.length > 0 && <div className="poll-list">{polls.map((item) => <PollCard item={item} path={`${base}/${item.slug}`} onNavigate={() => undefined} key={item.id} />)}</div>}
  </section>
}
