// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { RestrictedAccessDialog } from './RestrictedAccessDialog'

afterEach(cleanup)

test.each(['home', 'close', 'escape'])('generic restricted dialog invokes the supplied home action via %s', action => {
  const onHome = vi.fn()
  const previous = document.body.style.overflow
  const { unmount } = render(<RestrictedAccessDialog brand={<span>Outra seção</span>} eyebrow="RECURSOS" description="Acesso exclusivo." onHome={onHome} />)
  const dialog = screen.getByRole('dialog', { name: 'Área restrita' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveTextContent('Outra seção')
  expect(dialog).toHaveTextContent('Acesso exclusivo.')
  expect(document.body.style.overflow).toBe('hidden')
  expect(within(dialog).getByRole('button', { name: 'Home' })).toHaveFocus()
  if (action === 'escape') fireEvent.keyDown(window, { key: 'Escape' })
  else fireEvent.click(within(dialog).getByRole('button', { name: action === 'home' ? 'Home' : 'voltar à home' }))
  expect(onHome).toHaveBeenCalledOnce()
  unmount()
  expect(document.body.style.overflow).toBe(previous)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onHome).toHaveBeenCalledOnce()
})
