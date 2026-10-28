import type { ReactNode, MouseEvent, KeyboardEvent } from 'react'
import { LinkifiedText } from '../components/LinkifiedText'
import { elapsedPollTime, voteLabel } from './pollPresentation'

export interface PollCardItem {
  slug: string
  question: string
  started_at: string | null
  started_on: string | null
  closed: boolean
  closed_at: string | null
  total_votes: number
  selected_options?: string[]
  options?: { id: string }[]
  options_count?: number
}

interface PollCardProps {
  item: PollCardItem
  path: string
  onNavigate: (path: string) => void
  cardRef?: (node: HTMLElement | null) => void
  compact?: boolean
  showUnvotedStatus?: boolean
  actions?: ReactNode
}

function pollElapsedTime(item: PollCardItem): string {
  return elapsedPollTime(item.started_at, item.started_on, 'iniciada')
}

function pollClosedElapsedTime(item: PollCardItem): string {
  return elapsedPollTime(item.closed_at, null, 'encerrada')
}

export function PollCard({ item, path, onNavigate, cardRef, compact = false, showUnvotedStatus = true, actions }: PollCardProps) {
  const openCard = () => onNavigate(path)
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a')) return
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    openCard()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openCard()
  }
  const optionsCount = item.options_count ?? item.options?.length ?? 0
  const status = item.closed ? 'encerrada' : showUnvotedStatus && item.selected_options?.length === 0 ? 'aberta e sem seu voto' : 'aberta'
  const classes = ['poll-card', compact && 'poll-card--compact', actions && 'poll-card--with-actions'].filter(Boolean).join(' ')

  return <article ref={cardRef} className={classes} role="link" tabIndex={0} onClick={handleClick} onKeyDown={handleKeyDown}><span className={`poll-card__status${item.closed ? ' poll-card__status--closed' : ' poll-card__status--open'}`}>{status}</span><h2><LinkifiedText text={item.question} stopPropagation /></h2><span className="poll-card__dates">{item.closed ? pollClosedElapsedTime(item) : pollElapsedTime(item)}</span><p>{optionsCount} opções · {voteLabel(item.total_votes)}</p>{actions}</article>
}
