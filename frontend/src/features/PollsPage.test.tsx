// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, messageForApiError } from './auth/api'
import type { AuthenticatedUser } from './auth/api'
import { PollAuditDialog, PollCard, PollDetail, PollDetailLoading, PollErrorDialog, PollLoading, PollsPage, PollsSectionBar } from './PollsPage'
import { addPollOption, closePoll, createPoll, getPoll, getPollAudit, hidePollOption, listPolls, pollErrorMessage, submitPoll, type Poll, type PollSubmissionResponse, type PollSuggestion } from './pollsApi'
import { dismissPollSuggestion, snoozePollSuggestions } from './userPreferencesApi'
import { animatePollCardReorder, animatePollOptionReorder, elapsedPollTime, pollWithSelection, pollVoterSummary, roundedPercentages, voteLabel } from './pollPresentation'

vi.mock('./pollsApi', () => ({
  addPollOption: vi.fn(),
  closePoll: vi.fn(),
  createPoll: vi.fn(),
  getPoll: vi.fn(),
  getPollAudit: vi.fn(),
  hidePollOption: vi.fn(),
  listPolls: vi.fn(),
  pollErrorMessage: vi.fn(() => 'erro'),
  submitPoll: vi.fn(),
}))

vi.mock('./userPreferencesApi', () => ({
  dismissPollSuggestion: vi.fn(),
  snoozePollSuggestions: vi.fn(),
}))

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.clearAllTimers(); vi.unstubAllGlobals(); vi.useRealTimers() })

const user: AuthenticatedUser = { id: 'user-1', name: 'Luciano Vettoretti', member_type: 'member' }
const adminUser: AuthenticatedUser = { ...user, member_type: 'admin' }

function option(id: string, label: string, votes: number, voters = [{ id: 'other', name: 'Outro Gdev' }]) {
  return { id, label, votes, percentage: votes * 10, created_at: `2026-01-0${id}` , voters }
}

function poll(overrides: Partial<Poll> = {}): Poll {
  return {
    id: 'poll-1',
    slug: 'qual-jogo',
    question: 'Qual jogo?',
    created_at: '2026-10-27T10:00:00.000Z',
    creator: { id: 'creator', name: 'Criador' },
    started_at: '2026-01-01T00:00:00.000Z',
    started_on: null,
    allow_multiple: true,
    allow_new_options: false,
    closed: false,
    closed_at: null,
    has_votes: true,
    total_votes: 2,
    message: null,
    selected_options: [],
    options: [option('1', 'Primeiro', 1), option('2', 'Segundo', 1)],
    ...overrides,
  }
}

function pollPage(polls: Poll[], overrides: Partial<{ next_cursor: string | null; has_more: boolean; synced_at: string }> = {}) {
  return { polls, next_cursor: null, has_more: false, synced_at: '2026-10-27T12:00:00.000Z', ...overrides }
}

function submitResponse(value: Poll, suggested_polls: PollSubmissionResponse['suggested_polls'] = []): PollSubmissionResponse {
  return { poll: value, suggested_polls }
}

function pollSuggestion(overrides: Partial<PollSuggestion> = {}): PollSuggestion {
  return {
    id: 'poll-2',
    slug: 'outra-enquete',
    question: 'Qual filme assistir?',
    started_at: '2026-10-20T12:00:00.000Z',
    started_on: null,
    options_count: 4,
    total_votes: 8,
    ...overrides,
  }
}

describe('pollVoterSummary', () => {
  it('does not show an empty identified-voter message when votes are anonymous', () => {
    expect(pollVoterSummary({ voters: [], anonymous_votes: 10 })).toBe('')
  })

  it('shows identified voters when present', () => {
    expect(pollVoterSummary({ voters: [{ id: '1', name: 'Gdev Um' }], anonymous_votes: 0 })).toBe(' · Gdev Um')
  })

  it('shows no voters only when the option has no votes', () => {
    expect(pollVoterSummary({ voters: [], anonymous_votes: 0 })).toBe(' · sem votantes')
  })
})

describe('poll presentation', () => {
  it('does not force rounded percentages to add up to 100%', () => {
    const percentages = roundedPercentages({ first: 8 / 55 * 100, second: 8 / 55 * 100, third: 39 / 55 * 100 }, true)

    expect(percentages).toEqual({ first: 14.55, second: 14.55, third: 70.91 })
    expect(Object.values(percentages).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100.01, 10)
  })

  it('returns zero percentages when there are no votes', () => {
    expect(roundedPercentages({ first: 0, second: 0 }, false)).toEqual({ first: 0, second: 0 })
  })

  it('formats singular and plural vote counts', () => {
    expect(voteLabel(1)).toBe('1 voto')
    expect(voteLabel(8)).toBe('8 votos')
  })

  it('animates cards from their previous position after a reorder', () => {
    const animate = vi.fn()
    const node = {
      animate,
      getBoundingClientRect: () => ({ left: 0, top: 120 } as DOMRect),
    } as unknown as HTMLLabelElement
    const previous = { left: 0, top: 0 } as DOMRect

    animatePollOptionReorder(new Map([['option-1', previous]]), new Map([['option-1', node]]), false)

    expect(animate).toHaveBeenCalledWith([
      { transform: 'translate(0px, -120px)' },
      { transform: 'translate(0, 0)' },
    ], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' })
  })

  it('animates poll cards from their previous position after a list refresh', () => {
    const animate = vi.fn()
    const node = {
      animate,
      getBoundingClientRect: () => ({ left: 0, top: 120 } as DOMRect),
    } as unknown as HTMLElement
    const previous = { left: 0, top: 0 } as DOMRect

    animatePollCardReorder(new Map([['poll-1', previous]]), new Map([['poll-1', node]]), false)

    expect(animate).toHaveBeenCalledWith([
      { transform: 'translate(0px, -120px)' },
      { transform: 'translate(0, 0)' },
    ], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' })
  })

  it('formats relative poll times', () => {
    vi.setSystemTime(new Date('2026-10-27T12:00:00.000Z'))

    expect(elapsedPollTime('2026-10-27T11:00:00.000Z', null, 'iniciada')).toBe('iniciada há 1 hora')
    expect(elapsedPollTime(null, '2026-10-20', 'encerrada')).toBe('encerrada há 1 semana')
  })

  it('updates counts, percentages and order optimistically using raw votes', () => {
    const current = poll({
      options: [
        option('1', 'Primeiro', 2, [{ id: 'user-1', name: user.name }, { id: 'other', name: 'Outro Gdev' }]),
        option('2', 'Segundo', 2),
        option('3', 'Terceiro', 1),
      ],
      total_votes: 5,
    })

    const next = pollWithSelection(current, user, ['2', '3'])

    expect(next.total_votes).toBe(5)
    expect(next.selected_options).toEqual(['2', '3'])
    expect(next.options.map((item) => item.label)).toEqual(['Segundo', 'Terceiro', 'Primeiro'])
    expect(next.options.find((item) => item.id === '2')).toMatchObject({ votes: 2, percentage: 40 })
    expect(next.options.find((item) => item.id === '3')).toMatchObject({ votes: 2, percentage: 40 })
  })

  it('shows the total votes in the poll card and preserves navigation', async () => {
    const onNavigate = vi.fn()
    render(<PollCard item={poll({ total_votes: 8 })} path="/polls/qual-jogo" onNavigate={onNavigate} />)

    expect(screen.getByText('2 opções · 8 votos')).toBeInTheDocument()
    expect(screen.getByText('aberta')).toBeInTheDocument()
    const dates = document.querySelector('.poll-card__dates')
    const summary = screen.getByText('2 opções · 8 votos')
    expect(dates).not.toBeNull()
    expect(dates!.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.querySelector('.overflow-menu')).toBeNull()
    await screen.getByRole('link').click()
    expect(onNavigate).toHaveBeenCalledWith('/polls/qual-jogo')
  })

  it('keeps the new poll form focused, removes extra options and uses switches', async () => {
    const ui = userEvent.setup()
    render(<PollsPage identifier={null} create user={adminUser} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    expect(screen.queryByRole('heading', { name: 'Criar enquete' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nova enquete' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Todas as enquetes/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover opção 2' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Opção 1' }).parentElement).toHaveClass('field-control')
    expect(screen.getByRole('checkbox', { name: 'Permitir selecionar múltiplas opções' }).closest('label')).toHaveClass('poll-switch')
    expect(screen.getByRole('checkbox', { name: 'Permitir adicionar novas opções depois' }).closest('label')).toHaveClass('poll-switch')

    await ui.click(screen.getByRole('checkbox', { name: 'Permitir adicionar novas opções depois' }))
    expect(screen.queryByRole('button', { name: 'Remover opção 1' })).not.toBeInTheDocument()
    const removeSecondOption = screen.getByRole('button', { name: 'Remover opção 2' })
    expect(removeSecondOption).toBeInTheDocument()
    expect(removeSecondOption.parentElement?.parentElement).toHaveClass('field-control', 'poll-form__option-row--removable')
    await ui.click(removeSecondOption)
    expect(screen.queryByRole('textbox', { name: 'Opção 2' })).not.toBeInTheDocument()

    await ui.click(screen.getByRole('checkbox', { name: 'Permitir adicionar novas opções depois' }))
    expect(screen.getByRole('textbox', { name: 'Opção 2' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover opção 2' })).not.toBeInTheDocument()
  })

  it('does not render the new poll form for a non-admin member', () => {
    render(<PollsPage identifier={null} create user={user} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    expect(screen.getByText('Apenas admins podem criar enquetes.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar enquete' })).not.toBeInTheDocument()
  })

  it('animates the add-option button when opening space for a new option', async () => {
    const ui = userEvent.setup()
    render(<PollsPage identifier={null} create user={adminUser} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await ui.click(screen.getByRole('button', { name: 'Adicionar opção' }))

    expect(screen.getByRole('textbox', { name: 'Opção 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar opção' })).toHaveClass('poll-form__add-option--moving')
    expect(screen.getByRole('textbox', { name: 'Opção 3' }).parentElement).toHaveClass('poll-form__option-row--new')
  })

  it('shows the question requirement only after a submission attempt', async () => {
    vi.mocked(createPoll).mockRejectedValue(new ApiError('The given data was invalid.', 422, undefined, undefined, { question: ['A pergunta precisa ter pelo menos 10 caracteres e 2 palavras.'] }))
    const ui = userEvent.setup()
    render(<PollsPage identifier={null} create user={adminUser} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    const submit = screen.getByRole('button', { name: 'Criar enquete' })
    expect(submit).toBeEnabled()
    expect(screen.queryByText('A pergunta precisa ter pelo menos 10 caracteres e 2 palavras.')).not.toBeInTheDocument()

    await ui.click(submit)

    expect(screen.getByText('A pergunta precisa ter pelo menos 10 caracteres e 2 palavras.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Pergunta' }).parentElement).toHaveClass('poll-form__field--invalid')
    expect(document.querySelector('.field-control__error')).toBeInTheDocument()
    expect(document.querySelector('.poll-form__error')).not.toBeInTheDocument()
    await ui.click(screen.getByRole('checkbox', { name: 'Permitir selecionar múltiplas opções' }))
    expect(document.querySelector('.field-control__error')).not.toBeInTheDocument()
  })

  it('requires the first option even when a later option is filled', async () => {
    vi.mocked(createPoll).mockRejectedValue(new ApiError('The given data was invalid.', 422, undefined, undefined, { 'option.0': ['A opção 1 é obrigatória.'] }))
    const ui = userEvent.setup()
    render(<PollsPage identifier={null} create user={adminUser} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await ui.type(screen.getByRole('textbox', { name: 'Pergunta' }), 'Qual jogo escolheremos?')
    await ui.type(screen.getByRole('textbox', { name: 'Opção 2' }), 'Celeste')
    await ui.click(screen.getByRole('button', { name: 'Criar enquete' }))

    expect(screen.getByText('A opção 1 é obrigatória.')).toBeInTheDocument()
    expect(createPoll).toHaveBeenCalledWith(expect.objectContaining({ options: ['', 'Celeste'], allow_new_options: false }))
  })

  it('submits with one initial option when new options are enabled', async () => {
    vi.mocked(createPoll).mockResolvedValue(poll({ slug: 'nova-enquete' }))
    const ui = userEvent.setup()
    render(<PollsPage identifier={null} create user={adminUser} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await ui.type(screen.getByRole('textbox', { name: 'Pergunta' }), 'Qual jogo escolheremos?')
    await ui.type(screen.getByRole('textbox', { name: 'Opção 1' }), 'Hades')

    const submit = screen.getByRole('button', { name: 'Criar enquete' })
    expect(submit).toBeEnabled()
    await ui.click(screen.getByRole('checkbox', { name: 'Permitir adicionar novas opções depois' }))
    await ui.click(submit)
    await waitFor(() => expect(createPoll).toHaveBeenCalledWith(expect.objectContaining({ options: ['Hades', ''], allow_new_options: true })))
  })

  it('locks the new poll form and shows a spinner while submitting', async () => {
    let resolveCreate: (value: Poll) => void = () => undefined
    vi.mocked(createPoll).mockReturnValue(new Promise<Poll>((resolve) => { resolveCreate = resolve }))
    const onNavigate = vi.fn()
    const ui = userEvent.setup()
    render(<PollsPage identifier={null} create user={adminUser} onLogin={vi.fn()} onNavigate={onNavigate} />)

    await ui.type(screen.getByRole('textbox', { name: 'Pergunta' }), 'Qual jogo escolheremos?')
    await ui.type(screen.getByRole('textbox', { name: 'Opção 1' }), 'Hades')
    await ui.type(screen.getByRole('textbox', { name: 'Opção 2' }), 'Celeste')
    await ui.click(screen.getByRole('button', { name: 'Criar enquete' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Criar enquete' })).toHaveAttribute('aria-busy', 'true'))
    expect(document.querySelector('.poll-form')).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelector('.poll-form')).toHaveClass('poll-form--busy')
    expect(document.querySelector('.poll-submit-button__spinner')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Pergunta' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Opção 1' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Opção 2' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Permitir selecionar múltiplas opções' })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: 'Permitir adicionar novas opções depois' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Adicionar opção' })).toBeDisabled()

    resolveCreate(poll({ slug: 'nova-enquete' }))
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/polls/nova-enquete'))
  })

  it('anchors API validation errors to the returned poll field', async () => {
    vi.mocked(createPoll).mockRejectedValue(new ApiError('The given data was invalid.', 422, undefined, undefined, { 'option.0': ['The options.0 field has a duplicate value.'] }))
    const ui = userEvent.setup()
    render(<PollsPage identifier={null} create user={adminUser} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await ui.type(screen.getByRole('textbox', { name: 'Pergunta' }), 'Qual jogo escolheremos?')
    await ui.type(screen.getByRole('textbox', { name: 'Opção 1' }), 'Hades')
    await ui.type(screen.getByRole('textbox', { name: 'Opção 2' }), 'Celeste')
    await ui.click(screen.getByRole('button', { name: 'Criar enquete' }))

    await waitFor(() => expect(screen.getByText('A opção 1 está repetida.')).toBeInTheDocument())
    expect(screen.getByRole('textbox', { name: 'Opção 1' }).parentElement).toHaveClass('poll-form__field--invalid')
    expect(document.querySelector('.poll-form__error')).not.toBeInTheDocument()
  })

  it('shows an unscoped API error in a tooltip above the submit button', async () => {
    vi.mocked(createPoll).mockRejectedValue(new Error('falha geral'))
    vi.mocked(pollErrorMessage).mockReturnValueOnce('Não foi possível criar a enquete.')
    const ui = userEvent.setup()
    render(<PollsPage identifier={null} create user={adminUser} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await ui.type(screen.getByRole('textbox', { name: 'Pergunta' }), 'Qual jogo escolheremos?')
    await ui.type(screen.getByRole('textbox', { name: 'Opção 1' }), 'Hades')
    await ui.type(screen.getByRole('textbox', { name: 'Opção 2' }), 'Celeste')
    await ui.click(screen.getByRole('button', { name: 'Criar enquete' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível criar a enquete.'))
    expect(screen.getByRole('alert').parentElement).toHaveClass('poll-form__submit-area')
    await ui.click(screen.getByRole('textbox', { name: 'Pergunta' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not expose the audit action from the poll list card', () => {
    render(<PollCard item={poll()} path="/polls/qual-jogo" onNavigate={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'ver auditoria da enquete iniciada' })).not.toBeInTheDocument()
    expect(document.querySelector('.poll-card__dates')).toHaveTextContent('iniciada')
  })

  it('keeps the audit action on the poll detail relative date', async () => {
    const onAudit = vi.fn()
    const ui = userEvent.setup()
    render(<PollDetail poll={poll()} user={user} onLogin={vi.fn()} onAudit={onAudit} onUpdated={vi.fn()} />)

    await ui.click(screen.getByRole('button', { name: 'ver auditoria da enquete iniciada' }))

    expect(onAudit).toHaveBeenCalledOnce()
  })

  it('shows the close action only to an admin while the poll is open', () => {
    const { rerender } = render(<PollDetail poll={poll()} user={adminUser} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'encerrar' })).toBeInTheDocument()

    rerender(<PollDetail poll={poll()} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'encerrar' })).not.toBeInTheDocument()

    rerender(<PollDetail poll={poll({ closed: true, closed_at: '2026-10-20T12:00:00.000Z' })} user={adminUser} onLogin={vi.fn()} onUpdated={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'encerrar' })).not.toBeInTheDocument()
  })

  it('confirms and updates the poll after an admin closes it', async () => {
    const closedPoll = poll({ closed: true, closed_at: '2026-10-27T12:00:00.000Z' })
    vi.mocked(closePoll).mockResolvedValue(closedPoll)
    const onUpdated = vi.fn()
    const ui = userEvent.setup()
    render(<PollDetail poll={poll()} user={adminUser} onLogin={vi.fn()} onUpdated={onUpdated} />)

    await ui.click(screen.getByRole('button', { name: 'encerrar' }))
    expect(screen.getByRole('heading', { name: 'Encerrar esta enquete?' })).toBeInTheDocument()
    expect(screen.getByText('Depois de encerrada, não será possível votar ou adicionar novas opções.')).toBeInTheDocument()

    await ui.click(screen.getAllByRole('button', { name: /encerrar/i })[1])

    await waitFor(() => expect(closePoll).toHaveBeenCalledWith('qual-jogo'))
    expect(onUpdated).toHaveBeenCalledWith(closedPoll)
  })

  it('confirms hiding an option and updates the poll for an admin', async () => {
    const updatedPoll = poll({ options: [option('2', 'Segundo', 1)], total_votes: 1 })
    vi.mocked(hidePollOption).mockResolvedValue(updatedPoll)
    const onUpdated = vi.fn()
    const ui = userEvent.setup()
    render(<PollDetail poll={poll({ allow_new_options: true })} user={adminUser} onLogin={vi.fn()} onUpdated={onUpdated} />)

    await ui.click(screen.getByRole('button', { name: 'Ações da opção Primeiro' }))
    await ui.click(screen.getByRole('button', { name: 'ocultar' }))
    expect(screen.getByRole('heading', { name: 'Ocultar esta opção?' })).toBeInTheDocument()
    expect(screen.getByText('Os votos serão cancelados, mas continuarão registrados na auditoria.')).toBeInTheDocument()

    await ui.click(screen.getByRole('button', { name: 'ocultar' }))

    await waitFor(() => expect(hidePollOption).toHaveBeenCalledWith('qual-jogo', '1'))
    expect(onUpdated).toHaveBeenCalledWith(updatedPoll)
  })

  it('shows an ended status and relative closing time in the card', () => {
    vi.setSystemTime(new Date('2026-10-27T12:00:00.000Z'))
    render(<PollCard item={poll({ closed: true, closed_at: '2026-10-20T12:00:00.000Z' })} path="/polls/qual-jogo" onNavigate={vi.fn()} />)

    expect(screen.getByText('encerrada')).toBeInTheDocument()
    expect(screen.getByText('encerrada há 1 semana')).toBeInTheDocument()
  })

  it('disables voting and option suggestions after a poll is closed', async () => {
    const ui = userEvent.setup()
    render(<PollDetail poll={poll({ closed: true, closed_at: '2026-10-20T12:00:00.000Z', allow_new_options: true })} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    expect(screen.getAllByRole('checkbox').every((control) => control.hasAttribute('disabled'))).toBe(true)
    expect(screen.queryByPlaceholderText('sugira uma nova opção')).not.toBeInTheDocument()
    await ui.click(screen.getAllByRole('checkbox')[0])
    expect(submitPoll).not.toHaveBeenCalled()
  })

  it('shows the polls submenu and a skeleton card while a poll loads', () => {
    render(<><PollsSectionBar visible path="/polls" onNavigate={vi.fn()} /><PollLoading /></>)

    expect(screen.getByRole('link', { name: 'abrir enquetes' })).toBeVisible()
    expect(document.querySelector('.poll-loading')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Carregando enquete…')).toBeInTheDocument()
    expect(document.querySelectorAll('.poll-loading-card')).toHaveLength(3)
    const loadingCard = document.querySelector('.poll-loading-card')
    expect(loadingCard).not.toBeNull()
    const loadingDate = loadingCard!.querySelector('.poll-loading__card-date')
    const loadingMeta = loadingCard!.querySelector('.poll-loading__card-meta')
    expect(loadingDate).not.toBeNull()
    expect(loadingMeta).not.toBeNull()
    expect(loadingDate!.compareDocumentPosition(loadingMeta!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows a detail skeleton while opening a poll', () => {
    render(<PollDetailLoading />)

    expect(document.querySelector('.poll-detail-loading')).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelectorAll('.poll-loading-option')).toHaveLength(4)
    expect(document.querySelectorAll('.poll-loading__option-check')).toHaveLength(4)
    expect(screen.getByText('Carregando enquete…')).toBeInTheDocument()
  })

  it('shows the complete vote and cancellation history in the audit modal', async () => {
    vi.mocked(getPollAudit).mockResolvedValue({
      poll: { id: 'poll-1', slug: 'qual-jogo', question: 'Qual jogo?', creator: { id: 'creator', name: 'Criador' }, created_at: '2026-10-19T12:00:00.000Z', closed_at: '2026-10-23T12:00:00.000Z' },
      events: [
        { id: 'poll-created', type: 'poll_created', actor: { id: 'creator', name: 'Criador' }, at: '2026-10-19T12:00:00.000Z' },
        { id: 'option-created', type: 'option_added', option_id: '1', option_label: 'Primeiro', actor: { id: 'creator', name: 'Criador' }, at: '2026-10-19T12:01:00.000Z' },
        { id: 'vote-created', type: 'vote_recorded', vote_id: 1, option_id: '1', option_label: 'Primeiro', actor: { id: 'user-1', name: 'Luciano Vettoretti' }, at: '2026-10-20T12:00:00.000Z' },
        { id: 'vote-canceled', type: 'vote_canceled', vote_id: 1, option_id: '1', option_label: 'Primeiro', actor: { id: 'user-1', name: 'Luciano Vettoretti' }, at: '2026-10-21T12:00:00.000Z', cancellation_reason: 'replaced' },
        { id: 'anonymous-vote', type: 'vote_recorded', vote_id: 2, option_id: '2', option_label: 'Segundo', actor: null, at: '2026-10-22T12:00:00.000Z' },
        { id: 'poll-closed', type: 'poll_closed', actor: null, at: '2026-10-23T12:00:00.000Z' },
      ],
    })
    render(<PollAuditDialog poll={poll()} onClose={vi.fn()} />)

    expect(await screen.findByText('Registro completo dos votos, alterações e cancelamentos.')).toBeInTheDocument()
    expect(screen.getByText('/gdevs/polls/audit')).toBeInTheDocument()
    expect(screen.getByText('Enquete adicionada')).toBeInTheDocument()
    expect(screen.getByText('Opção adicionada: Primeiro')).toBeInTheDocument()
    expect(screen.getByText('Enquete encerrada')).toBeInTheDocument()
    expect(screen.getAllByText(/Luciano Vettoretti/)).toHaveLength(3)
    expect(screen.getByText('voto sem identificação')).toBeInTheDocument()
    expect(screen.getByText(/substituído por outro voto/)).toBeInTheDocument()

    const filter = screen.getByRole('combobox', { name: 'filtrar auditoria' })
    expect(screen.queryByText('Filtrar auditoria')).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Primeiro' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Luciano Vettoretti' })).toBeInTheDocument()
    fireEvent.change(filter, { target: { value: 'option:1' } })
    expect(screen.getByText('Voto registrado: Primeiro')).toBeInTheDocument()
    expect(screen.queryByText('Voto registrado: Segundo')).not.toBeInTheDocument()
    expect(screen.queryByText('Enquete adicionada')).not.toBeInTheDocument()

    fireEvent.change(filter, { target: { value: 'user:user-1' } })
    expect(screen.getByText('Voto registrado: Primeiro')).toBeInTheDocument()
    expect(screen.getByText('Voto cancelado: Primeiro')).toBeInTheDocument()
    expect(screen.queryByText('Opção adicionada: Primeiro')).not.toBeInTheDocument()
  })

  it('shows audit skeletons while the audit is loading', () => {
    vi.mocked(getPollAudit).mockReturnValue(new Promise(() => undefined))
    render(<PollAuditDialog poll={poll()} onClose={vi.fn()} />)

    expect(screen.queryByText('Carregando auditoria…')).not.toBeInTheDocument()
    expect(document.querySelector('.poll-audit-loading')).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelectorAll('.poll-audit-loading__entry')).toHaveLength(4)
  })

  it('fades the landing list out behind the detail skeleton', async () => {
    vi.mocked(listPolls).mockResolvedValue(pollPage([poll()]))
    const view = render(<PollsPage identifier={null} user={user} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Qual jogo?')).toBeInTheDocument())
    vi.mocked(getPoll).mockReturnValue(new Promise(() => undefined))
    view.rerender(<PollsPage identifier="qual-jogo" user={user} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(document.querySelector('.poll-route-transition__outgoing')).toBeInTheDocument()
      expect(document.querySelector('.poll-detail-loading')).toBeInTheDocument()
    })
  })

  it('does not reload the landing list when the session becomes available', async () => {
    vi.mocked(listPolls).mockResolvedValue(pollPage([poll()]))
    const view = render(<PollsPage identifier={null} user={null} sessionRestoring onLogin={vi.fn()} onNavigate={vi.fn()} />)

    expect(listPolls).not.toHaveBeenCalled()
    view.rerender(<PollsPage identifier={null} user={adminUser} sessionRestoring={false} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Qual jogo?')).toBeInTheDocument())

    expect(screen.getByRole('button', { name: 'Nova enquete' })).toHaveTextContent('+')
    view.rerender(<PollsPage identifier={null} user={user} onLogin={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Nova enquete' })).not.toBeInTheDocument()
    expect(listPolls).toHaveBeenCalledTimes(1)
  })

  it('opens login for the unauthenticated poll landing and leaves it empty after closing', async () => {
    const onLogin = vi.fn()
    render(<PollsPage identifier={null} user={null} sessionRestoring={false} onLogin={onLogin} onNavigate={vi.fn()} />)

    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce())
    expect(listPolls).not.toHaveBeenCalled()
    expect(screen.queryByText('Não autenticado')).not.toBeInTheDocument()
    expect(document.querySelector('.poll-loading')).toBeInTheDocument()
  })

  it('refreshes the landing list and puts newly created polls first', async () => {
    vi.useFakeTimers()
    const existingPoll = poll()
    const newerPoll = poll({ id: 'poll-2', slug: 'nova-enquete', question: 'Nova enquete?', created_at: '2026-10-27T11:00:00.000Z' })
    const updatedExistingPoll = poll({ total_votes: 4, question: 'Qual jogo atualizado?', closed: true, closed_at: '2026-10-27T12:00:00.000Z' })
    vi.mocked(listPolls).mockResolvedValueOnce(pollPage([existingPoll])).mockResolvedValueOnce(pollPage([newerPoll, updatedExistingPoll], { synced_at: '2026-10-27T12:00:01.000Z' }))
    render(<PollsPage identifier={null} user={user} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('Qual jogo?')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })

    expect(screen.getByText('Nova enquete?')).toBeInTheDocument()
    const titles = [...document.querySelectorAll('.poll-card h2')].map((title) => title.textContent)
    expect(titles).toEqual(['Nova enquete?', 'Qual jogo atualizado?'])
    expect(screen.getByText('2 opções · 4 votos')).toBeInTheDocument()
    expect(screen.getByText('encerrada')).toBeInTheDocument()
    expect(getPoll).not.toHaveBeenCalled()
    expect(listPolls).toHaveBeenCalledTimes(2)
  })

  it('loads the next three polls only when the list sentinel becomes visible', async () => {
    let triggerIntersection: () => void = () => undefined
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        triggerIntersection = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    })
    let resolveNextPage: (page: ReturnType<typeof pollPage>) => void = () => undefined
    const firstPage = pollPage([
      poll({ id: 'poll-1', created_at: '2026-10-27T12:00:00.000Z' }),
      poll({ id: 'poll-2', slug: 'segundo', question: 'Segundo?', created_at: '2026-10-27T11:00:00.000Z' }),
      poll({ id: 'poll-3', slug: 'terceiro', question: 'Terceiro?', created_at: '2026-10-27T10:00:00.000Z' }),
    ], { next_cursor: 'cursor-1', has_more: true })
    const nextPage = new Promise<ReturnType<typeof pollPage>>((resolve) => { resolveNextPage = resolve })
    vi.mocked(listPolls).mockResolvedValueOnce(firstPage).mockReturnValueOnce(nextPage)
    render(<PollsPage identifier={null} user={user} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Terceiro?')).toBeInTheDocument())
    expect(listPolls).toHaveBeenCalledWith({ limit: 3 })
    expect(screen.queryByText('Quarto?')).not.toBeInTheDocument()

    await act(async () => { triggerIntersection() })
    expect(document.querySelectorAll('.poll-list--batch-loading .poll-loading-card')).toHaveLength(3)

    resolveNextPage(pollPage([
      poll({ id: 'poll-4', slug: 'quarto', question: 'Quarto?', created_at: '2026-10-27T09:00:00.000Z' }),
      poll({ id: 'poll-5', slug: 'quinto', question: 'Quinto?', created_at: '2026-10-27T08:00:00.000Z' }),
      poll({ id: 'poll-6', slug: 'sexto', question: 'Sexto?', created_at: '2026-10-27T07:00:00.000Z' }),
    ]))
    await waitFor(() => expect(screen.getByText('Sexto?')).toBeInTheDocument())

    expect(listPolls).toHaveBeenNthCalledWith(2, { limit: 3, cursor: 'cursor-1' })
    expect(document.querySelector('.poll-list-loader')).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6)
  })

  it('merges incremental changes at the beginning, middle and end without duplicates', async () => {
    vi.useFakeTimers()
    const initial = [
      poll({ id: 'old-open', created_at: '2026-10-27T08:00:00.000Z' }),
      poll({ id: 'old-closed', slug: 'encerrada-antiga', question: 'Encerrada antiga?', closed: true, closed_at: '2026-10-27T08:00:00.000Z', created_at: '2026-10-27T07:00:00.000Z' }),
    ]
    const changes = [
      poll({ id: 'new-top', slug: 'nova-do-topo', question: 'Nova do topo?', created_at: '2026-10-27T12:00:00.000Z' }),
      poll({ id: 'new-middle', slug: 'nova-do-meio', question: 'Nova do meio?', created_at: '2026-10-27T09:00:00.000Z' }),
      poll({ id: 'new-end', slug: 'nova-do-fim', question: 'Nova do fim?', closed: true, closed_at: '2026-10-27T06:00:00.000Z', created_at: '2026-10-27T08:30:00.000Z' }),
      poll({ id: 'old-open', created_at: '2026-10-27T08:00:00.000Z', total_votes: 4 }),
    ]
    vi.mocked(listPolls).mockResolvedValueOnce(pollPage(initial, { synced_at: '2026-10-27T12:00:00.000Z' })).mockResolvedValueOnce(pollPage(changes, { synced_at: '2026-10-27T12:00:15.000Z' }))
    render(<PollsPage identifier={null} user={user} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    vi.useRealTimers()
    await waitFor(() => expect(screen.getByText('Nova do topo?')).toBeInTheDocument())

    const titles = [...document.querySelectorAll('.poll-card h2')].map((title) => title.textContent)
    expect(titles).toEqual(['Nova do topo?', 'Nova do meio?', 'Qual jogo?', 'Nova do fim?', 'Encerrada antiga?'])
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5)
    expect(screen.getByText('2 opções · 4 votos')).toBeInTheDocument()
  })

  it('moves an already loaded poll to the closed group after incremental refresh', async () => {
    vi.useFakeTimers()
    const movingPoll = poll({ id: 'moving-poll', slug: 'vai-fechar', question: 'Vai fechar?', created_at: '2026-10-27T12:00:00.000Z' })
    const stillOpenPoll = poll({ id: 'still-open', slug: 'continua-aberta', question: 'Continua aberta?', created_at: '2026-10-27T11:00:00.000Z' })
    const oldClosedPoll = poll({ id: 'old-closed', slug: 'encerrada-antiga', question: 'Encerrada antiga?', closed: true, closed_at: '2026-10-27T08:00:00.000Z', created_at: '2026-10-27T10:00:00.000Z' })
    const closedMovingPoll = { ...movingPoll, closed: true, closed_at: '2026-10-27T13:00:00.000Z' }
    vi.mocked(listPolls).mockResolvedValueOnce(pollPage([movingPoll, stillOpenPoll, oldClosedPoll], { synced_at: '2026-10-27T12:00:00.000Z' })).mockResolvedValueOnce(pollPage([closedMovingPoll], { synced_at: '2026-10-27T13:00:15.000Z' }))
    render(<PollsPage identifier={null} user={user} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    vi.useRealTimers()
    await waitFor(() => expect(document.querySelectorAll('.poll-card__status--closed')).toHaveLength(2))

    const titles = [...document.querySelectorAll('.poll-card h2')].map((title) => title.textContent)
    expect(titles).toEqual(['Continua aberta?', 'Vai fechar?', 'Encerrada antiga?'])
    expect(screen.getAllByText('Vai fechar?')).toHaveLength(1)
  })

  it('waits for the session before loading a poll detail', async () => {
    vi.mocked(getPoll).mockResolvedValue(poll())
    const view = render(<PollsPage identifier="qual-jogo" user={null} sessionRestoring onLogin={vi.fn()} onNavigate={vi.fn()} />)

    expect(getPoll).not.toHaveBeenCalled()
    view.rerender(<PollsPage identifier="qual-jogo" user={user} sessionRestoring={false} onLogin={vi.fn()} onNavigate={vi.fn()} />)

    await waitFor(() => expect(getPoll).toHaveBeenCalledTimes(1))
  })

  it('uses the list status marker in the detail without duplicating it as a tag', () => {
    render(<PollDetail poll={poll()} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    expect(screen.getByText('aberta')).toHaveClass('poll-card__status', 'poll-card__status--open')
    expect(screen.getByText('múltipla escolha')).toBeInTheDocument()
    expect(screen.queryByText('ENQUETE DA COMUNIDADE')).not.toBeInTheDocument()
    expect(document.querySelector('.poll-tag--open')).not.toBeInTheDocument()
  })

  it('shows the single-choice tag when multiple selections are disabled', () => {
    render(<PollDetail poll={poll({ allow_multiple: false })} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    expect(screen.getByText('única escolha')).toBeInTheDocument()
    expect(screen.queryByText('múltipla escolha')).not.toBeInTheDocument()
  })

  it('does not show the empty-vote message in the poll detail', () => {
    render(<PollDetail poll={poll({ has_votes: false, total_votes: 0, message: 'Ainda não há votos' })} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    expect(screen.queryByText('Ainda não há votos')).not.toBeInTheDocument()
  })

  it('shakes an option before opening login for visitors', () => {
    vi.useFakeTimers()
    const onLogin = vi.fn()
    render(<PollDetail poll={poll()} user={null} onLogin={onLogin} onUpdated={vi.fn()} />)

    const option = screen.getAllByRole('checkbox')[0]
    fireEvent.click(option)

    expect(option.closest('.poll-option')).toHaveClass('poll-option--login-required')
    expect(onLogin).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(420))
    expect(onLogin).toHaveBeenCalledTimes(1)
  })

  it('keeps other options interactive while a vote is being saved', async () => {
    let resolveFirst: (value: PollSubmissionResponse) => void = () => undefined
    const firstResponse = new Promise<PollSubmissionResponse>((resolve) => { resolveFirst = resolve })
    vi.mocked(submitPoll).mockReturnValueOnce(firstResponse).mockResolvedValueOnce(submitResponse(poll({ selected_options: ['1', '2'] })))
    const ui = userEvent.setup()
    render(<PollDetail poll={poll()} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    const [first, second] = screen.getAllByRole('checkbox')
    await ui.click(first)
    await ui.click(second)

    expect(first).not.toBeDisabled()
    expect(second).not.toBeDisabled()
    expect(first.closest('.poll-option')).toHaveClass('poll-option--vote-pending')
    expect(second.closest('.poll-option')).toHaveClass('poll-option--vote-pending')
    expect(screen.getAllByRole('status', { name: 'Salvando voto' })).toHaveLength(2)

    resolveFirst(submitResponse(poll({ selected_options: ['1'] })))
    await waitFor(() => expect(submitPoll).toHaveBeenCalledTimes(2))
    expect(submitPoll).toHaveBeenNthCalledWith(1, 'qual-jogo', ['1'], [])
    expect(submitPoll).toHaveBeenNthCalledWith(2, 'qual-jogo', ['2'], [])
  })

  it('reverts a failed vote and shakes the changed option', async () => {
    vi.mocked(submitPoll).mockRejectedValue(new Error('falha ao salvar'))
    const ui = userEvent.setup()
    render(<PollDetail poll={poll()} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    const option = screen.getAllByRole('checkbox')[0]
    await ui.click(option)

    await waitFor(() => expect(option.closest('.poll-option')).toHaveClass('poll-option--vote-error'))
    expect(option).not.toBeChecked()
    expect(option.closest('.poll-option')).not.toHaveClass('poll-option--vote-pending')
  })

  it('notifies the standard error modal when a vote cannot be saved', async () => {
    vi.mocked(submitPoll).mockRejectedValue(new Error('falha ao salvar'))
    vi.mocked(pollErrorMessage).mockReturnValue('Não foi possível iniciar uma conexão segura.')
    const onError = vi.fn()
    const ui = userEvent.setup()
    render(<PollDetail poll={poll()} user={user} onLogin={vi.fn()} onError={onError} onUpdated={vi.fn()} />)

    await ui.click(screen.getAllByRole('checkbox')[0])

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Não foi possível iniciar uma conexão segura.'))
  })

  it('renders the standard poll error modal', async () => {
    const onClose = vi.fn()
    const ui = userEvent.setup()
    render(<PollErrorDialog message="Não foi possível iniciar uma conexão segura." onClose={onClose} />)

    expect(screen.getByText('/gdevs/polls/error')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível iniciar uma conexão segura.')
    await ui.click(screen.getByRole('button', { name: 'Entendi' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })

  it('renders a suggestion card and turns it into a votable card after success', async () => {
    const current = poll({ allow_new_options: true })
    const latest = poll({ allow_new_options: true, options: [...current.options, option('3', 'Nova opção', 0)] })
    let resolveAdd: () => void = () => undefined
    const pendingAdd = new Promise<void>((resolve) => { resolveAdd = resolve })
    vi.mocked(addPollOption).mockReturnValue(pendingAdd)
    vi.mocked(getPoll).mockResolvedValue(latest)
    const onUpdated = vi.fn()
    const view = render(<PollDetail poll={current} user={user} onLogin={vi.fn()} onUpdated={onUpdated} />)
    const ui = userEvent.setup()

    const input = screen.getByPlaceholderText('sugira uma nova opção')
    const button = screen.getByRole('button', { name: 'Adicionar opção' })
    expect(button).toHaveTextContent('+')
    expect(document.querySelector('.poll-new-option-card__indicator')).toBeInTheDocument()
    expect(document.querySelector('.poll-new-option-card__indicator')).toHaveClass('poll-new-option-card__indicator--checkbox')
    expect(document.querySelector('.poll-new-option-card__vote-meta')).toBeInTheDocument()
    expect(document.querySelector('.poll-new-option-card__field')).toBeInTheDocument()
    await ui.type(input, 'Nova opção')
    const click = ui.type(input, '{enter}')
    await waitFor(() => expect(button).toBeDisabled())
    resolveAdd()
    await click
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(latest))

    view.rerender(<PollDetail poll={latest} user={user} onLogin={vi.fn()} onUpdated={onUpdated} />)
    expect(screen.getByText('Nova opção').closest('.poll-option')).toHaveClass('poll-option--new')
  })

  it('uses a radio-shaped indicator for single-choice suggestion cards', () => {
    render(<PollDetail poll={poll({ allow_multiple: false, allow_new_options: true })} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    expect(document.querySelector('.poll-new-option-card__indicator')).toHaveClass('poll-new-option-card__indicator--radio')
  })

  it('allows a single-choice voter to withdraw the selected option', async () => {
    const current = poll({ allow_multiple: false, selected_options: ['1'] })
    vi.mocked(submitPoll).mockResolvedValue(submitResponse({ ...current, selected_options: [] }))
    const ui = userEvent.setup()
    function SingleChoiceHarness() {
      const [currentPoll, setCurrentPoll] = useState(current)
      return <PollDetail poll={currentPoll} user={user} onLogin={vi.fn()} onUpdated={setCurrentPoll} />
    }
    render(<SingleChoiceHarness />)

    const radios = screen.getAllByRole('radio')
    expect(radios[0]).toBeChecked()
    await ui.click(radios[0])

    await waitFor(() => expect(submitPoll).toHaveBeenCalledWith('qual-jogo', [], ['1']))
    expect(radios[0]).not.toBeChecked()
  })

  it('shakes the suggestion card and keeps it after an error', async () => {
    vi.mocked(addPollOption).mockRejectedValue(new ApiError('The given data was invalid.', 422, undefined, undefined, { label: ['Já existe uma opção semelhante: "Opção".'] }))
    vi.mocked(pollErrorMessage).mockImplementationOnce((reason) => messageForApiError(reason))
    const ui = userEvent.setup()
    render(<PollDetail poll={poll({ allow_new_options: true })} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    await ui.type(screen.getByPlaceholderText('sugira uma nova opção'), 'Opção com erro')
    await ui.click(screen.getByRole('button', { name: 'Adicionar opção' }))

    await waitFor(() => expect(document.querySelector('.poll-new-option-card')).toHaveClass('poll-new-option-card--error'))
    expect(screen.getByText('Já existe uma opção semelhante: "Opção".')).toBeInTheDocument()
    expect(document.querySelector('.poll-new-option-card__vote-meta')).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('sugira uma nova opção')).toBeDisabled()
    const resetButton = screen.getByRole('button', { name: 'Descartar sugestão' })
    expect(resetButton).toHaveTextContent('×')
    expect(screen.getByDisplayValue('Opção com erro')).toBeInTheDocument()
    await ui.click(resetButton)
    expect(screen.getByPlaceholderText('sugira uma nova opção')).not.toBeDisabled()
    expect(document.querySelector('.poll-new-option-card__vote-meta')).toBeInTheDocument()
  })

  it('marks existing votes and submits only the changed option ids', async () => {
    const current = poll({
      selected_options: ['1'],
      options: [
        option('1', 'Primeiro', 2, [{ id: user.id, name: user.name }, { id: 'other', name: 'Outro Gdev' }]),
        option('2', 'Segundo', 1),
      ],
    })
    vi.mocked(submitPoll).mockResolvedValue(submitResponse({ ...current, selected_options: ['1', '2'] }))
    const ui = userEvent.setup()
    render(<PollDetail poll={current} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
    await ui.click(checkboxes[1])

    await waitFor(() => expect(submitPoll).toHaveBeenCalledWith('qual-jogo', ['2'], []))
  })

  it('offers unvoted open polls after a successful vote and snoozes the toast for 24 hours', async () => {
    const suggestion = pollSuggestion()
    vi.mocked(submitPoll).mockResolvedValue(submitResponse(poll({ selected_options: ['1'] }), [suggestion]))
    vi.mocked(snoozePollSuggestions).mockResolvedValue({ polls: { suggestions: { snooze_until: '2026-10-28T12:00:00Z', not_interested_poll_ids: [] } } })
    const ui = userEvent.setup()
    render(<PollDetail poll={poll()} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    await ui.click(screen.getAllByRole('checkbox')[0])
    expect(await screen.findByText('Você ainda não votou em outras enquetes abertas.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fechar sugestões' })).not.toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Agora não' }))

    await waitFor(() => expect(snoozePollSuggestions).toHaveBeenCalledWith(24))
    expect(screen.queryByText('Você ainda não votou em outras enquetes abertas.')).not.toBeInTheDocument()
  })

  it('opens the suggestions modal and navigates to a selected poll', async () => {
    const suggestion = pollSuggestion()
    const secondSuggestion = pollSuggestion({ id: 'poll-3', slug: 'segunda-enquete', question: 'Outra decisão?' })
    vi.mocked(submitPoll).mockResolvedValue(submitResponse(poll({ selected_options: ['1'] }), [suggestion, secondSuggestion]))
    const onNavigate = vi.fn()
    const ui = userEvent.setup()
    render(<PollDetail poll={poll()} user={user} onLogin={vi.fn()} onNavigate={onNavigate} onUpdated={vi.fn()} />)

    await ui.click(screen.getAllByRole('checkbox')[0])
    await ui.click(await screen.findByRole('button', { name: 'Ver sugestões' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Qual filme assistir?')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByText('aberta')).toHaveLength(2)
    expect(within(dialog).getAllByText(/4 opções · 8 votos/)).toHaveLength(2)
    const cards = within(dialog).getAllByRole('link')
    expect(cards).toHaveLength(2)
    expect(cards.every((card) => card.classList.contains('poll-card--compact') && card.classList.contains('poll-card--with-actions'))).toBe(true)
    expect(dialog.querySelectorAll('.overflow-menu')).toHaveLength(2)
    expect([...dialog.children].some((child) => child.classList.contains('overflow-menu'))).toBe(false)
    expect(within(dialog).queryByText('/gdevs/polls/outra-enquete')).not.toBeInTheDocument()
    await ui.click(within(dialog).getByRole('link', { name: /Qual filme assistir\?/ }))

    expect(onNavigate).toHaveBeenCalledWith('/polls/outra-enquete')
  })

  it('removes a suggestion when the user says they do not want to vote in it', async () => {
    const suggestion = pollSuggestion()
    vi.mocked(submitPoll).mockResolvedValue(submitResponse(poll({ selected_options: ['1'] }), [suggestion]))
    vi.mocked(dismissPollSuggestion).mockResolvedValue({ polls: { suggestions: { snooze_until: null, not_interested_poll_ids: ['poll-2'] } } })
    const ui = userEvent.setup()
    render(<PollDetail poll={poll()} user={user} onLogin={vi.fn()} onUpdated={vi.fn()} />)

    await ui.click(screen.getAllByRole('checkbox')[0])
    await ui.click(await screen.findByRole('button', { name: 'Ver sugestões' }))
    await ui.click(screen.getByRole('button', { name: 'Ações da enquete Qual filme assistir?' }))
    await ui.click(screen.getByRole('button', { name: 'não quero votar nesta enquete' }))

    await waitFor(() => expect(dismissPollSuggestion).toHaveBeenCalledWith('poll-2'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
