// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { useModalLifecycle } from './useModalLifecycle'

afterEach(cleanup)

function Dialog({ name, onClose, disabled = false }: { name: string; onClose: () => void; disabled?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  useModalLifecycle(onClose, ref, 'button')
  return <section ref={ref} tabIndex={-1} role="dialog" aria-label={name}>
    <button>{name} primeiro</button>
    <button disabled>Desabilitado</button>
    <button hidden>Oculto</button>
    <div style={{ display: 'none' }}><button>Invisível</button></div>
    <button tabIndex={-1}>Fora da sequência</button>
    <button disabled={disabled}>{name} último</button>
  </section>
}

test('cycles in both directions, skips disabled and hidden controls, and prevents outside focus', async () => {
  const user = userEvent.setup()
  const close = vi.fn()
  const { rerender, unmount } = render(<><button>Fundo</button><Dialog name="Modal" onClose={close} /></>)
  const first = screen.getByRole('button', { name: 'Modal primeiro' })
  const last = screen.getByRole('button', { name: 'Modal último' })
  expect(first).toHaveFocus()
  await user.tab({ shift: true })
  expect(last).toHaveFocus()
  await user.tab()
  expect(first).toHaveFocus()
  await user.tab()
  expect(last).toHaveFocus()
  screen.getByRole('button', { name: 'Fundo' }).focus()
  expect(first).toHaveFocus()
  rerender(<><button>Fundo</button><Dialog name="Modal" onClose={close} disabled /></>)
  await user.tab()
  expect(first).toHaveFocus()
  await user.tab({ shift: true })
  expect(first).toHaveFocus()
  unmount()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(close).not.toHaveBeenCalled()
})

test('only the top modal handles keyboard and focus, and scroll remains locked until the last closes', async () => {
  const user = userEvent.setup()
  const previous = document.body.style.overflow
  function Harness() {
    const [first, setFirst] = useState(false)
    const [second, setSecond] = useState(false)
    return <>
      <button onClick={() => setFirst(true)}>Abrir primeiro</button>
      {first && <Dialog name="Base" onClose={() => setFirst(false)} />}
      <button onClick={() => setSecond(true)}>Abrir segundo</button>
      {second && <Dialog name="Topo" onClose={() => setSecond(false)} />}
    </>
  }
  render(<Harness />)
  const trigger = screen.getByRole('button', { name: 'Abrir primeiro' })
  await user.click(trigger)
  const first = screen.getByRole('button', { name: 'Base primeiro' })
  expect(first).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Abrir segundo' }))
  const top = screen.getByRole('button', { name: 'Topo primeiro' })
  expect(top).toHaveFocus()
  first.focus()
  expect(top).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog', { name: 'Topo' })).not.toBeInTheDocument()
  expect(first).toHaveFocus()
  expect(document.body.style.overflow).toBe('hidden')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(document.body.style.overflow).toBe(previous)
})

test('a modal without available controls focuses its container and contains tab', async () => {
  const user = userEvent.setup()
  function Empty() {
    const ref = useRef<HTMLElement>(null)
    useModalLifecycle(() => {}, ref)
    return <section ref={ref} tabIndex={-1} role="dialog"><button disabled>Indisponível</button></section>
  }
  render(<><button>Fundo</button><Empty /></>)
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveFocus()
  await user.tab()
  expect(dialog).toHaveFocus()
  await user.tab({ shift: true })
  expect(dialog).toHaveFocus()
})
