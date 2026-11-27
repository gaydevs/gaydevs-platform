// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { PendingSaveDialog } from './PendingSaveDialog'

afterEach(cleanup)

function props() {
  return {
    brand: <span>Outra seção</span>, eyebrow: 'RECURSOS',
    savingTitle: 'Salvando recurso', sessionDescription: 'Sessão inválida.',
    onCancel: vi.fn(), onIgnore: vi.fn(), onRetry: vi.fn(), onReload: vi.fn(),
  }
}

test('pending save delegates ignore and cancellation without persistence or navigation dependencies', () => {
  const callbacks = props()
  const previous = document.body.style.overflow
  const { unmount } = render(<PendingSaveDialog {...callbacks} status="saving" />)
  const dialog = screen.getByRole('dialog', { name: 'Salvando recurso' })
  expect(dialog).toHaveTextContent('Outra seção')
  expect(dialog).toHaveTextContent('Alterações pendentes podem não ser salvas')
  expect(within(dialog).getByRole('status')).toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'cancelar saída' })).toHaveFocus()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Ignorar' }))
  expect(callbacks.onIgnore).toHaveBeenCalledOnce()
  expect(callbacks.onCancel).not.toHaveBeenCalled()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(callbacks.onCancel).toHaveBeenCalledOnce()
  fireEvent.click(within(dialog).getByRole('button', { name: 'cancelar saída' }))
  expect(callbacks.onCancel).toHaveBeenCalledTimes(2)
  expect(callbacks.onRetry).not.toHaveBeenCalled()
  unmount()
  expect(document.body.style.overflow).toBe(previous)
})

test('error and session change delegate different recovery actions with the latest callbacks', () => {
  const callbacks = props()
  const { rerender } = render(<PendingSaveDialog {...callbacks} status="error" />)
  const failed = screen.getByRole('dialog', { name: 'Não foi possível salvar' })
  fireEvent.click(within(failed).getByRole('button', { name: 'Tentar de novo' }))
  expect(callbacks.onRetry).toHaveBeenCalledOnce()
  expect(callbacks.onReload).not.toHaveBeenCalled()
  const onCancel = vi.fn()
  rerender(<PendingSaveDialog {...callbacks} onCancel={onCancel} status="session-changed" />)
  const changed = screen.getByRole('dialog', { name: 'Sessão alterada' })
  expect(changed).toHaveTextContent('Sessão inválida.')
  expect(within(changed).queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument()
  fireEvent.click(within(changed).getByRole('button', { name: 'Recarregar' }))
  expect(callbacks.onReload).toHaveBeenCalledOnce()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onCancel).toHaveBeenCalledOnce()
  expect(callbacks.onCancel).not.toHaveBeenCalled()
})
