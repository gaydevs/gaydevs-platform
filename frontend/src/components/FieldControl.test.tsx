// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FieldControl } from './FieldControl'

describe('FieldControl', () => {
  it('keeps adornments inside the shared field shell and forwards the input props', () => {
    render(<FieldControl aria-label="busca" placeholder="Digite" before="gdev" after={<button type="button">limpar</button>} />)

    const input = screen.getByRole('textbox', { name: 'busca' })
    expect(input).toHaveAttribute('placeholder', 'Digite')
    expect(input.parentElement).toHaveClass('field-control', 'field-control--before', 'field-control--after')
    expect(input.parentElement).toContainElement(screen.getByRole('button', { name: 'limpar' }))
    expect(screen.getByText('gdev')).toHaveClass('field-control__before')
  })

  it('supports a compact shell for fields embedded in cards', () => {
    render(<FieldControl aria-label="opção" variant="compact" />)

    expect(screen.getByRole('textbox', { name: 'opção' }).parentElement).toHaveClass('field-control--compact')
  })
})
