// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldActionButton } from './FieldActionButton'

describe('FieldActionButton', () => {
  it('renders the shared remove action', () => {
    render(<FieldActionButton variant="remove" aria-label="remover opção" />)

    expect(screen.getByRole('button', { name: 'remover opção' })).toHaveClass('field-action-button', 'field-action-button--remove')
    expect(screen.getByRole('button', { name: 'remover opção' })).toHaveTextContent('×')
  })

  it('supports the smaller action used by the login field', () => {
    render(<FieldActionButton variant="remove" small aria-label="limpar busca" />)

    expect(screen.getByRole('button', { name: 'limpar busca' })).toHaveClass('field-action-button--small')
  })
})
