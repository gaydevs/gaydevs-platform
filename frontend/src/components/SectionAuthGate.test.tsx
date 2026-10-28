// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SectionAuthGate } from './SectionAuthGate'

describe('SectionAuthGate', () => {
  it('requests login once and keeps the required section behind its fallback', () => {
    const onRequireLogin = vi.fn()
    render(<SectionAuthGate mode="required" authenticated={false} restoring={false} fallback={<p>carregando</p>} onRequireLogin={onRequireLogin}>conteúdo privado</SectionAuthGate>)

    expect(screen.getByText('carregando')).toBeInTheDocument()
    expect(screen.queryByText('conteúdo privado')).not.toBeInTheDocument()
    expect(onRequireLogin).toHaveBeenCalledTimes(1)
  })

  it('does not open login for a public preview', () => {
    const onRequireLogin = vi.fn()
    render(<SectionAuthGate mode="preview" authenticated={false} restoring={false} fallback={<p>carregando</p>} onRequireLogin={onRequireLogin}>prévia pública</SectionAuthGate>)

    expect(screen.getByText('prévia pública')).toBeInTheDocument()
    expect(onRequireLogin).not.toHaveBeenCalled()
  })
})
