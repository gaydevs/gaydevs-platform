// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PollCard, type PollCardItem } from './PollCard'

afterEach(cleanup)

const item: PollCardItem = {
  slug: 'qual-jogo',
  question: 'Qual jogo? https://example.com/jogo',
  started_at: '2026-10-27T10:00:00.000Z',
  started_on: null,
  closed: false,
  closed_at: null,
  total_votes: 3,
  selected_options: [],
  options_count: 2,
}

describe('PollCard', () => {
  it('keeps links in the question external without navigating the card', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<PollCard item={item} path="/polls/qual-jogo" onNavigate={onNavigate} />)

    const externalLink = screen.getByRole('link', { name: 'https://example.com/jogo' })
    expect(externalLink).toHaveAttribute('target', '_blank')
    await user.click(externalLink)

    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('shows open polls without the current user vote in the list status', () => {
    render(<PollCard item={item} path="/polls/qual-jogo" onNavigate={vi.fn()} />)

    expect(screen.getByText('aberta e sem seu voto')).toHaveClass('poll-card__status', 'poll-card__status--open')
  })

  it('keeps the regular open status after the current user has voted', () => {
    render(<PollCard item={{ ...item, selected_options: ['option-1'] }} path="/polls/qual-jogo" onNavigate={vi.fn()} />)

    expect(screen.getByText('aberta')).toHaveClass('poll-card__status', 'poll-card__status--open')
    expect(screen.queryByText('aberta e sem seu voto')).not.toBeInTheDocument()
  })

  it('keeps the closed status even when the current user has no vote', () => {
    render(<PollCard item={{ ...item, closed: true, closed_at: '2026-10-20T12:00:00.000Z' }} path="/polls/qual-jogo" onNavigate={vi.fn()} />)

    expect(screen.getByText('encerrada')).toHaveClass('poll-card__status', 'poll-card__status--closed')
    expect(screen.queryByText('aberta e sem seu voto')).not.toBeInTheDocument()
  })

  it.each(['Enter', ' '])('supports keyboard navigation with %s', (key) => {
    const onNavigate = vi.fn()
    render(<PollCard item={item} path="/polls/qual-jogo" onNavigate={onNavigate} />)

    const card = document.querySelector('article.poll-card') as HTMLElement
    fireEvent.keyDown(card, { key })

    expect(onNavigate).toHaveBeenCalledWith('/polls/qual-jogo')
  })

  it('keeps the compact suggestion presentation and actions contract', () => {
    render(<PollCard item={item} path="/polls/qual-jogo" onNavigate={vi.fn()} compact showUnvotedStatus={false} actions={<button type="button">ações</button>} />)

    const card = document.querySelector('article.poll-card')
    expect(card).toHaveClass('poll-card', 'poll-card--compact', 'poll-card--with-actions')
    expect(screen.getByText('aberta')).toBeInTheDocument()
    expect(screen.queryByText('aberta e sem seu voto')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ações' })).toBeInTheDocument()
  })
})
