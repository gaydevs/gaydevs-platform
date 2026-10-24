// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loginStepFromHash, useLoginHash } from './useLoginHash'

function HashHarness() {
  const login = useLoginHash()

  return <>
    <output data-testid="step">{login.step ?? 'closed'}</output>
    <button type="button" onClick={login.open}>abrir</button>
    <button type="button" onClick={() => login.showStep('otp')}>mostrar otp</button>
    <button type="button" onClick={login.close}>fechar</button>
  </>
}

beforeEach(() => {
  window.history.replaceState(null, '', '/pagina?aba=eventos#secao')
})

afterEach(() => {
  cleanup()
})

describe('useLoginHash', () => {
  it('accepts only the hashes used by the login flow', () => {
    expect(loginStepFromHash('#login')).toBe('search')
    expect(loginStepFromHash('#login/otp')).toBe('otp')
    expect(loginStepFromHash('#conteudo')).toBeNull()
    expect(loginStepFromHash('')).toBeNull()
  })

  it('preserves and restores the original URL when opening and closing', async () => {
    const user = userEvent.setup()
    render(<HashHarness />)

    await user.click(screen.getByRole('button', { name: 'abrir' }))
    expect(screen.getByTestId('step')).toHaveTextContent('search')
    expect(window.location.href).toContain('/pagina?aba=eventos#login')

    await user.click(screen.getByRole('button', { name: 'mostrar otp' }))
    expect(screen.getByTestId('step')).toHaveTextContent('otp')
    expect(window.location.hash).toBe('#login/otp')

    await user.click(screen.getByRole('button', { name: 'fechar' }))
    expect(screen.getByTestId('step')).toHaveTextContent('closed')
    expect(window.location.href).toContain('/pagina?aba=eventos#secao')
  })

  it('synchronizes with hashchange and popstate navigation', async () => {
    render(<HashHarness />)
    expect(screen.getByTestId('step')).toHaveTextContent('closed')

    window.history.pushState(null, '', '/pagina?aba=eventos#login')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await waitFor(() => expect(screen.getByTestId('step')).toHaveTextContent('search'))

    window.history.pushState(null, '', '/pagina?aba=eventos#login/otp')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await waitFor(() => expect(screen.getByTestId('step')).toHaveTextContent('otp'))

    window.history.pushState(null, '', '/pagina?aba=eventos#outra-coisa')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await waitFor(() => expect(screen.getByTestId('step')).toHaveTextContent('closed'))
  })

  it('does not push a second login entry when already open', async () => {
    window.history.replaceState(null, '', '/pagina?aba=eventos#login')
    const user = userEvent.setup()
    render(<HashHarness />)
    const before = window.history.length

    await user.click(screen.getByRole('button', { name: 'abrir' }))

    expect(window.history.length).toBe(before)
    expect(screen.getByTestId('step')).toHaveTextContent('search')
  })
})
