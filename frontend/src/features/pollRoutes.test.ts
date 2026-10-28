// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { ApiError } from './auth/api'
import type { Poll } from './pollsApi'
import { changedOptionIds, comparePolls, mergePolls, pollCreateApiFieldErrors, selectionDiff, togglePollSelection } from './pollRoutes'

function poll(id: string, createdAt: string, closed = false): Poll {
  return {
    id,
    slug: id,
    question: id,
    created_at: createdAt,
    creator: { id: 'creator', name: 'Criador' },
    started_at: createdAt,
    started_on: null,
    allow_multiple: false,
    allow_new_options: false,
    closed,
    closed_at: closed ? createdAt : null,
    has_votes: false,
    total_votes: 0,
    message: null,
    selected_options: [],
    options: [],
  }
}

describe('poll route/domain helpers', () => {
  it('sorts open polls before closed polls and newest first within each group', () => {
    const openOld = poll('open-old', '2026-10-25T10:00:00.000Z')
    const openNew = poll('open-new', '2026-10-27T10:00:00.000Z')
    const closedNew = poll('closed-new', '2026-10-28T10:00:00.000Z', true)

    expect([closedNew, openOld, openNew].sort(comparePolls).map((item) => item.id)).toEqual(['open-new', 'open-old', 'closed-new'])
  })

  it('merges refreshes without duplicating cards and keeps updated data', () => {
    const first = poll('first', '2026-10-25T10:00:00.000Z')
    const second = poll('second', '2026-10-24T10:00:00.000Z')
    const updatedFirst = { ...first, question: 'atualizada' }

    const merged = mergePolls([first, second], [updatedFirst, poll('third', '2026-10-26T10:00:00.000Z')])

    expect(merged.map((item) => item.id)).toEqual(['third', 'first', 'second'])
    expect(merged.find((item) => item.id === 'first')?.question).toBe('atualizada')
  })

  it('computes only changed selections for partial vote mutations', () => {
    expect(changedOptionIds(['a', 'b'], ['b', 'c'])).toEqual(['a', 'c'])
    expect(selectionDiff(['a', 'b'], ['b', 'c'])).toEqual({ addedOptions: ['c'], removedOptions: ['a'] })
  })

  it('supports toggle semantics for single and multiple choice polls', () => {
    expect(togglePollSelection(['a'], 'a', false)).toEqual([])
    expect(togglePollSelection(['a'], 'b', false)).toEqual(['b'])
    expect(togglePollSelection(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(togglePollSelection(['a', 'b'], 'a', true)).toEqual(['b'])
  })

  it('translates backend field errors while preserving the option index', () => {
    const reason = new ApiError('validation', 422, undefined, undefined, {
      question: ['The question format is invalid.'],
      'options.1': ['The options.1 field has a duplicate value.'],
      general: ['The request is invalid.'],
    })

    const result = pollCreateApiFieldErrors(reason)

    expect(result?.fields).toEqual(new Set(['question', 'option-1']))
    expect(result?.messages).toEqual({
      question: 'A pergunta precisa ter pelo menos 2 palavras.',
      'option-1': 'A opção 2 está repetida.',
    })
    expect(result?.generalMessage).toBe('Não foi possível validar os dados da enquete.')
  })
})
