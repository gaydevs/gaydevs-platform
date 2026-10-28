// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionSubmenuBar } from './SectionSubmenuBar'

describe('SectionSubmenuBar', () => {
  it('keeps the generic section submenu hidden until its section asks for it', () => {
    const view = render(<SectionSubmenuBar visible={false}>conteúdo</SectionSubmenuBar>)
    const bar = view.container.firstElementChild as HTMLElement

    expect(bar).toHaveClass('section-submenu-bar')
    expect(bar).not.toHaveClass('section-submenu-bar--visible')
    expect(bar).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('conteúdo')).toBeInTheDocument()
  })

  it('exposes the visible state and preserves feature-specific classes', () => {
    const view = render(<SectionSubmenuBar visible className="polls-section-bar">/gdevs/polls</SectionSubmenuBar>)
    const bar = view.container.firstElementChild as HTMLElement

    expect(bar).toHaveClass('section-submenu-bar', 'polls-section-bar', 'section-submenu-bar--visible')
    expect(bar).toHaveAttribute('aria-hidden', 'false')
  })
})
