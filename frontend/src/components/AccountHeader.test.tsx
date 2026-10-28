// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountHeader } from './AccountHeader'

afterEach(() => {
  cleanup()
})

describe('AccountHeader', () => {
  it('shows the restoration status before the session is known', () => {
    render(<AccountHeader
      user={null}
      restoring
      brandVisible
      onLogin={vi.fn()}
      onLogout={vi.fn().mockResolvedValue(undefined)}
      onNavigate={vi.fn()}
    />)

    expect(screen.getByText('identificando gdev…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'entrar' })).not.toBeInTheDocument()
  })

  it('opens login for a visitor and keeps the floating header state', async () => {
    const onLogin = vi.fn()
    const user = userEvent.setup()
    render(<AccountHeader
      user={null}
      restoring={false}
      brandVisible
      onLogin={onLogin}
      onLogout={vi.fn().mockResolvedValue(undefined)}
      onNavigate={vi.fn()}
    />)

    const header = screen.getByRole('banner', { name: 'acesso do gdev' })
    expect(header).not.toHaveClass('account-header--scrolled')
    await user.click(screen.getByRole('button', { name: 'entrar' }))
    expect(onLogin).toHaveBeenCalledOnce()
  })

  it('shows the user, logout action and brand when the page is scrolled', async () => {
    const onLogout = vi.fn().mockResolvedValue(undefined)
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<AccountHeader
      user={{ id: 'user-id', name: 'Gdev Exemplo' }}
      restoring={false}
      brandVisible={false}
      onLogin={vi.fn()}
      onLogout={onLogout}
      onNavigate={onNavigate}
    />)

    const header = screen.getByRole('banner', { name: 'acesso do gdev' })
    expect(header).toHaveClass('account-header--scrolled')
    const brand = screen.getByRole('link', { name: 'voltar ao início' })
    expect(brand).toHaveTextContent('gaydevs_')
    expect(brand).toHaveAttribute('href', '#inicio')
    expect(screen.getByText('gdev')).toHaveClass('account-header__prefix')
    expect(screen.getByText('Gdev Exemplo')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'abrir menu' }))
    expect(screen.getByRole('button', { name: 'enquetes' })).toBeInTheDocument()
    await user.click(document.body)
    expect(screen.queryByRole('button', { name: 'enquetes' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'abrir menu' }))
    expect(screen.getByRole('button', { name: 'home' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'enquetes' }))
    expect(onNavigate).toHaveBeenCalledWith('/polls')

    await user.click(screen.getByRole('button', { name: 'abrir menu' }))
    await user.click(screen.getByRole('button', { name: 'sair' }))
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('returns to the landing page from a poll route', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    window.history.pushState(null, '', '/gaydevs/platform/polls')

    render(<AccountHeader
      user={{ id: 'user-id', name: 'Gdev Exemplo' }}
      restoring={false}
      brandVisible={false}
      onLogin={vi.fn()}
      onLogout={vi.fn().mockResolvedValue(undefined)}
      onNavigate={onNavigate}
    />)

    const logo = screen.getByRole('link', { name: 'voltar ao início' })
    expect(logo).toHaveAttribute('href', '/gaydevs/platform/')
    await user.click(logo)
    expect(onNavigate).toHaveBeenCalledWith('/gaydevs/platform/')
    window.history.pushState(null, '', '/')
  })
})
