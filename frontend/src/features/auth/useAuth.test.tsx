// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentSession, logout } from './api'
import { useAuth } from './useAuth'

vi.mock('./api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api')>()
  return { ...original, currentSession: vi.fn(), logout: vi.fn() }
})

function AuthHarness() {
  const auth = useAuth()
  return <div>
    <span>{auth.restoring ? 'restaurando' : auth.user?.name ?? 'visitante'}</span>
    {auth.user && <button type="button" onClick={() => void auth.logout()}>sair</button>}
    <button type="button" onClick={() => void auth.refresh()}>atualizar</button>
  </div>
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('authenticated state', () => {
  it('restores the session and clears it after logout', async () => {
    vi.mocked(currentSession).mockResolvedValue({ id: 'user-id', name: 'Gdev Exemplo' })
    vi.mocked(logout).mockResolvedValue()
    const user = userEvent.setup()

    render(<AuthHarness />)

    expect(await screen.findByText('Gdev Exemplo')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'sair' }))

    await waitFor(() => expect(screen.getByText('visitante')).toBeInTheDocument())
    expect(logout).toHaveBeenCalledOnce()
  })

  it('shows a visitor when the session endpoint returns no session', async () => {
    vi.mocked(currentSession).mockResolvedValue(null)

    render(<AuthHarness />)

    expect(await screen.findByText('visitante')).toBeInTheDocument()
    expect(screen.queryByText('restaurando')).not.toBeInTheDocument()
  })

  it('recovers as a visitor when restoring the session fails', async () => {
    vi.mocked(currentSession).mockRejectedValue(new Error('backend indisponível'))

    render(<AuthHarness />)

    expect(await screen.findByText('visitante')).toBeInTheDocument()
    expect(screen.queryByText('restaurando')).not.toBeInTheDocument()
  })

  it('refreshes the authenticated user on demand', async () => {
    vi.mocked(currentSession)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'user-id', name: 'Gdev Atualizado' })
    const user = userEvent.setup()

    render(<AuthHarness />)
    await screen.findByText('visitante')
    await user.click(screen.getByRole('button', { name: 'atualizar' }))

    expect(await screen.findByText('Gdev Atualizado')).toBeInTheDocument()
    expect(currentSession).toHaveBeenCalledTimes(2)
  })
})
