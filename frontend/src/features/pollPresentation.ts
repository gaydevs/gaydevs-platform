import type { AuthenticatedUser } from './auth/api'
import type { Poll, PollOption } from './pollsApi'

export function elapsedPollTime(timestamp: string | null, dateOnly: string | null, prefix: 'iniciada' | 'encerrada'): string {
  const moment = dateOnly ? new Date(`${dateOnly}T00:00:00Z`) : timestamp ? new Date(timestamp) : null
  if (!moment || Number.isNaN(moment.getTime())) return `${prefix} recentemente`
  const elapsedMs = Math.max(0, Date.now() - moment.getTime())
  const hours = Math.floor(elapsedMs / 3_600_000)
  if (hours < 1) return `${prefix} agora`
  if (hours < 24) return `${prefix} há ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  const days = Math.floor(elapsedMs / 86_400_000)
  if (days < 7) return `${prefix} há ${days} ${days === 1 ? 'dia' : 'dias'}`
  const weeks = Math.floor(days / 7)
  if (days < 30) return `${prefix} há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
  const months = Math.floor(days / 30)
  if (months < 12) return `${prefix} há ${months} ${months === 1 ? 'mês' : 'meses'}`
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  if (remainingMonths === 0) return `${prefix} há ${years} ${years === 1 ? 'ano' : 'anos'}`
  return `${prefix} há ${years} ${years === 1 ? 'ano' : 'anos'} e ${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'}`
}

export function voteLabel(count: number): string {
  return `${count} voto${count === 1 ? '' : 's'}`
}

function animatePollReorder(previousPositions: Map<string, DOMRect> | null, nodes: Map<string, HTMLElement>, reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false): void {
  if (!previousPositions || reducedMotion) return
  nodes.forEach((node, id) => {
    const previous = previousPositions.get(id)
    if (!previous) return
    const current = node.getBoundingClientRect()
    const translateX = previous.left - current.left
    const translateY = previous.top - current.top
    if (translateX === 0 && translateY === 0 || !node.animate) return
    node.animate([
      { transform: `translate(${translateX}px, ${translateY}px)` },
      { transform: 'translate(0, 0)' },
    ], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' })
  })
}

export function animatePollOptionReorder(previousPositions: Map<string, DOMRect> | null, nodes: Map<string, HTMLLabelElement>, reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false): void {
  animatePollReorder(previousPositions, nodes, reducedMotion)
}

export function animatePollCardReorder(previousPositions: Map<string, DOMRect> | null, nodes: Map<string, HTMLElement>, reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false): void {
  animatePollReorder(previousPositions, nodes, reducedMotion)
}

export function roundedPercentages(percentages: Record<string, number>, hasVotes: boolean): Record<string, number> {
  if (!hasVotes) return Object.fromEntries(Object.keys(percentages).map((id) => [id, 0]))
  return Object.fromEntries(Object.entries(percentages).map(([id, percentage]) => [id, Number(percentage.toFixed(2))]))
}

export function pollWithSelection(poll: Poll, user: AuthenticatedUser, selected: string[]): Poll {
  const selectedSet = new Set(selected)
  const optionsByVoter = new Map<string, string[]>()
  poll.options.forEach((option) => option.voters?.forEach((voter) => optionsByVoter.set(voter.id, [...(optionsByVoter.get(voter.id) ?? []), option.id])))
  optionsByVoter.delete(user.id)
  if (selected.length > 0) optionsByVoter.set(user.id, selected)

  const voteCounts = new Map<string, number>()
  let totalVotes = 0
  optionsByVoter.forEach((optionIds) => {
    optionIds.forEach((optionId) => voteCounts.set(optionId, (voteCounts.get(optionId) ?? 0) + 1))
    totalVotes += optionIds.length
  })
  poll.options.forEach((option) => {
    const anonymousVotes = option.anonymous_votes ?? 0
    if (anonymousVotes > 0) {
      voteCounts.set(option.id, (voteCounts.get(option.id) ?? 0) + anonymousVotes)
      totalVotes += anonymousVotes
    }
  })

  const orderedEntries = poll.options.map((option, index) => ({ option, index })).sort((left, right) => {
    const voteCountComparison = (voteCounts.get(right.option.id) ?? 0) - (voteCounts.get(left.option.id) ?? 0)
    if (voteCountComparison !== 0) return voteCountComparison
    const leftCreatedAt = left.option.created_at ? Date.parse(left.option.created_at) : Number.NaN
    const rightCreatedAt = right.option.created_at ? Date.parse(right.option.created_at) : Number.NaN
    if (Number.isFinite(leftCreatedAt) && Number.isFinite(rightCreatedAt) && leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt
    return left.index - right.index
  })
  const percentages = roundedPercentages(Object.fromEntries(poll.options.map((option) => [option.id, totalVotes > 0 ? ((voteCounts.get(option.id) ?? 0) / totalVotes) * 100 : 0])), totalVotes > 0)
  const options = orderedEntries.map(({ option }) => ({
    ...option,
    votes: voteCounts.get(option.id) ?? 0,
    percentage: percentages[option.id] ?? 0,
    voters: option.voters?.filter((voter) => voter.id !== user.id).concat(selectedSet.has(option.id) ? [{ id: user.id, name: user.name }] : []),
  }))

  return { ...poll, selected_options: selected, has_votes: totalVotes > 0, total_votes: totalVotes, message: totalVotes > 0 ? null : 'Ainda não há votos', options }
}

export function pollVoterSummary(option: Pick<PollOption, 'voters' | 'anonymous_votes'>): string {
  if (option.voters && option.voters.length > 0) return ` · ${option.voters.map((voter) => voter.name).join(', ')}`
  if ((option.anonymous_votes ?? 0) > 0) return ''
  return ' · sem votantes'
}
