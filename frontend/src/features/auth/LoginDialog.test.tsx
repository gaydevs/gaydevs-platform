// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
// @ts-expect-error Node.js filesystem access is only used by this Vitest test.
import { readFileSync } from 'node:fs'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, requestOtp, searchUsers, verifyOtp } from './api'
import { useLoginHash } from './useLoginHash'
import { LoginDialog } from './LoginDialog'

const globalStylesheet = readFileSync('src/styles/global.css', 'utf8')

vi.mock('./api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api')>()
  return {
    ...original,
    requestOtp: vi.fn(),
    searchUsers: vi.fn(),
    verifyOtp: vi.fn(),
  }
})

function LoginHarness({ authenticated = vi.fn() }: { authenticated?: () => Promise<unknown> }) {
  const login = useLoginHash()

  return <>
    <p>estado da página preservado</p>
    <button type="button" onClick={login.open}>entrar</button>
    {login.step && <LoginDialog
      step={login.step}
      onStepChange={login.showStep}
      onClose={login.close}
      onAuthenticated={authenticated}
    />}
  </>
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  sessionStorage.clear()
  vi.mocked(searchUsers).mockResolvedValue([])
  vi.mocked(requestOtp).mockResolvedValue({
    otp_request_id: '019a1234-0000-7000-8000-000000000001',
    expires_at: '2026-10-22T20:10:00-03:00',
  })
  vi.mocked(verifyOtp).mockResolvedValue()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LoginDialog', () => {
  it('keeps the autocomplete layered above the dialog without clipping it', async () => {
    vi.mocked(searchUsers).mockResolvedValue([
      { id: 'user-id', name: 'Gdev Exemplo', email: 'gdev@example.test' },
    ])
    const user = userEvent.setup()
    render(<LoginHarness />)

    await user.click(screen.getByRole('button', { name: 'entrar' }))
    await user.type(screen.getByRole('combobox', { name: 'nome ou e-mail' }), 'Gdev')

    const dialog = screen.getByRole('dialog')
    const results = await screen.findByRole('listbox')
    expect(dialog).not.toHaveClass('login-dialog--scrollable')
    expect(dialog).toContainElement(results)
    expect(globalStylesheet).toMatch(/\.login-overlay\s*\{[^}]*z-index:\s*30;/)
    expect(globalStylesheet).toMatch(/\.login-dialog\s*\{[^}]*overflow:\s*visible;/)
    expect(globalStylesheet).toMatch(/\.login-results\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*2;/)
  })

  it('opens and closes over the current page while synchronizing #login', async () => {
    const user = userEvent.setup()
    render(<LoginHarness />)

    await user.click(screen.getByRole('button', { name: 'entrar' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    const modalBrand = within(dialog).getByText('/gdevs/login', { exact: true })
    expect(modalBrand.closest('a')).not.toBeInTheDocument()
    expect(modalBrand).toHaveTextContent('/gdevs/login')
    expect(dialog.querySelector('.login-field__prefix')).toHaveTextContent('gdev')
    const modalHeader = dialog.querySelector('.modal-header')
    expect(modalHeader).toContainElement(within(dialog).getByRole('button', { name: 'fechar login' }))
    expect(modalHeader?.querySelector('.modal-header__divider')).toBeInTheDocument()
    expect(window.location.hash).toBe('#login')
    expect(screen.getByText('estado da página preservado')).toBeInTheDocument()
    await user.type(screen.getByRole('combobox', { name: 'nome ou e-mail' }), 'Alex')

    await user.click(screen.getByRole('button', { name: 'fechar login' }))

    expect(screen.getByRole('dialog')).toHaveClass('login-dialog--closing')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(window.location.hash).toBe('')
    expect(screen.getByText('estado da página preservado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'entrar' }))

    expect(screen.getByRole('combobox', { name: 'nome ou e-mail' })).toHaveValue('')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('reopens directly from the login URL', () => {
    window.history.replaceState(null, '', '#login')

    render(<LoginHarness />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'entrar sem senha' })).toBeInTheDocument()
  })

  it('searches masked users, requests an OTP and authenticates without leaving the page', async () => {
    vi.mocked(searchUsers).mockResolvedValue([
      { id: 'user-id', name: 'Lu***** V*********', email: 'lu*****.v*********@g****.com' },
    ])
    const authenticated = vi.fn().mockResolvedValue({ id: 'user-id', name: 'Gdev Exemplo' })
    const user = userEvent.setup()
    render(<LoginHarness authenticated={authenticated} />)

    await user.click(screen.getByRole('button', { name: 'entrar' }))
    expect(screen.getByRole('combobox', { name: 'nome ou e-mail' })).toHaveFocus()
    await user.type(screen.getByRole('combobox', { name: 'nome ou e-mail' }), 'Lu')
    expect(screen.queryByText('Busque seu nome ou o início do seu e-mail. Seus dados continuam mascarados.')).not.toBeInTheDocument()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    const result = await screen.findByRole('option', { name: /Lu\*{5} V\*{9}/ })
    await user.click(result)

    await waitFor(() => {
      expect(requestOtp).toHaveBeenCalledWith('user-id')
      expect(window.location.hash).toBe('#login/otp')
    })
    const modalBrand = within(screen.getByRole('dialog')).getByText('/gdevs/login/verify-otp', { exact: true })
    expect(modalBrand.closest('a')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'enviar código por e-mail' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'entrar' })).not.toBeInTheDocument()

    const digitInputs = screen.getAllByRole('textbox', { name: /dígito \d do código/ })
    await user.type(digitInputs[0], '123456')
    expect(digitInputs.map((input) => (input as HTMLInputElement).value)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(document.activeElement).toBe(digitInputs[5])

    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith('019a1234-0000-7000-8000-000000000001', '123456'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(verifyOtp).toHaveBeenCalledWith('019a1234-0000-7000-8000-000000000001', '123456')
    expect(authenticated).toHaveBeenCalledOnce()
    expect(window.location.hash).toBe('')
    expect(screen.getByText('estado da página preservado')).toBeInTheDocument()
  })

  it('clears the login state when returning to search and discourages password-manager autofill', async () => {
    vi.mocked(searchUsers).mockResolvedValue([
      { id: 'user-id', name: 'Al** M*******', email: 'al**@f*******.test' },
    ])
    const user = userEvent.setup()
    render(<LoginHarness />)

    await user.click(screen.getByRole('button', { name: 'entrar' }))
    const searchInput = screen.getByRole('combobox', { name: 'nome ou e-mail' })
    expect(searchInput).toHaveAttribute('type', 'search')
    expect(searchInput).toHaveAttribute('autocomplete', 'off')
    expect(searchInput).toHaveAttribute('data-bwignore', 'true')
    expect(searchInput).toHaveAttribute('data-1p-ignore', 'true')
    expect(searchInput).toHaveAttribute('data-lpignore', 'true')
    expect(searchInput).toHaveAttribute('data-form-type', 'other')
    await user.type(searchInput, 'Alex')
    await user.click(await screen.findByRole('option', { name: /Al\*{2} M\*{7}/ }))

    await waitFor(() => expect(window.location.hash).toBe('#login/otp'))
    const digitInputs = screen.getAllByRole('textbox', { name: /dígito \d do código/ })
    expect(sessionStorage.getItem('gaydevs.login.otp')).not.toBeNull()
    for (const input of digitInputs) {
      expect(input).toHaveAttribute('autocomplete', 'off')
      expect(input).toHaveAttribute('data-bwignore', 'true')
      expect(input).toHaveAttribute('data-1p-ignore', 'true')
      expect(input).toHaveAttribute('data-lpignore', 'true')
    }

    await user.type(digitInputs[0], '123')
    await user.click(screen.getByRole('button', { name: 'voltar para a busca' }))

    expect(window.location.hash).toBe('#login')
    expect(screen.getByRole('combobox', { name: 'nome ou e-mail' })).toHaveValue('')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(sessionStorage.getItem('gaydevs.login.otp')).toBeNull()
  })

  it('shakes, clears and focuses the first digit after an invalid OTP', async () => {
    vi.mocked(searchUsers).mockResolvedValue([
      { id: 'user-id', name: 'Al** M*******', email: 'al**@f*******.test' },
    ])
    vi.mocked(verifyOtp).mockRejectedValue(new ApiError('Código inválido.', 422))
    const user = userEvent.setup()
    render(<LoginHarness />)

    await user.click(screen.getByRole('button', { name: 'entrar' }))
    await user.type(screen.getByRole('combobox', { name: 'nome ou e-mail' }), 'Alex')
    await user.click(await screen.findByRole('option', { name: /Al\*{2} M\*{7}/ }))
    await waitFor(() => expect(window.location.hash).toBe('#login/otp'))

    const digitInputs = screen.getAllByRole('textbox', { name: /dígito \d do código/ })
    await user.type(digitInputs[0], '123456')

    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido.')
    expect(digitInputs.map((input) => (input as HTMLInputElement).value)).toEqual(['', '', '', '', '', ''])
    expect(document.activeElement).toBe(digitInputs[0])
    expect(digitInputs[0].closest('fieldset')).toHaveClass('login-code--shake')
    expect(screen.queryByRole('button', { name: 'limpar' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'entrar' })).not.toBeInTheDocument()
  })

  it('closes suggestions while requesting an OTP and keeps errors clear of the autocomplete', async () => {
    vi.mocked(searchUsers).mockResolvedValue([
      { id: 'user-id', name: 'Al** M*******', email: 'al**@f*******.test' },
    ])
    let rejectRequest!: (error: unknown) => void
    vi.mocked(requestOtp).mockImplementation(() => new Promise((_, reject) => { rejectRequest = reject }))
    const user = userEvent.setup()
    render(<LoginHarness />)

    await user.click(screen.getByRole('button', { name: 'entrar' }))
    await user.type(screen.getByRole('combobox', { name: 'nome ou e-mail' }), 'Alex')
    await user.click(await screen.findByRole('option', { name: /Al\*{2} M\*{7}/ }))

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'nome ou e-mail' }))
      .toHaveValue('Al** M*******')
    expect(screen.getByRole('combobox', { name: 'nome ou e-mail' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('enviando código')

    rejectRequest(new ApiError('Não foi possível enviar o código.', 503))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível enviar o código.')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'nome ou e-mail' }))
      .toHaveValue('Al** M*******')
    expect(screen.getByRole('combobox', { name: 'nome ou e-mail' })).toBeEnabled()
    expect(screen.getByPlaceholderText('digite seu nome ou e-mail')).toBeInTheDocument()
    expect(screen.queryByText('nome ou e-mail')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'limpar busca' }))
    expect(screen.getByRole('combobox', { name: 'nome ou e-mail' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'nome ou e-mail' })).toHaveFocus()

    await user.click(screen.getByRole('combobox', { name: 'nome ou e-mail' }))

    expect(screen.getByRole('combobox', { name: 'nome ou e-mail' })).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('clears a failed selection when the search field is clicked again', async () => {
    vi.mocked(searchUsers).mockResolvedValue([
      { id: 'user-id', name: 'Al** M*******', email: 'al**@f*******.test' },
    ])
    vi.mocked(requestOtp).mockRejectedValue(new ApiError('Não foi possível enviar o código.', 503))
    const user = userEvent.setup()
    render(<LoginHarness />)

    await user.click(screen.getByRole('button', { name: 'entrar' }))
    await user.type(screen.getByRole('combobox', { name: 'nome ou e-mail' }), 'Alex')
    await user.click(await screen.findByRole('option', { name: /Al\*{2} M\*{7}/ }))
    await screen.findByRole('alert')

    const searchInput = screen.getByRole('combobox', { name: 'nome ou e-mail' })
    await user.click(searchInput)

    expect(searchInput).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('restores the OTP step from its URL and session context', () => {
    sessionStorage.setItem('gaydevs.login.otp', JSON.stringify({
      otp_request_id: 'request-id',
      expires_at: '2026-10-22T20:10:00-03:00',
      user: { id: 'user-id', name: 'G*** E******', email: 'g***@e******.com' },
    }))
    window.history.replaceState(null, '', '#login/otp')

    render(<LoginHarness />)

    expect(screen.getByRole('heading', { name: 'digite o código' })).toBeInTheDocument()
    expect(screen.getByText('g***@e******.com')).toBeInTheDocument()
  })

  it('falls back to the search step when the saved OTP context is malformed', async () => {
    sessionStorage.setItem('gaydevs.login.otp', '{não é json')
    window.history.replaceState(null, '', '#login/otp')

    render(<LoginHarness />)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'entrar sem senha' })).toBeInTheDocument())
    expect(window.location.hash).toBe('#login')
  })

  it('shows the correlation reference without exposing internal error details', async () => {
    vi.mocked(searchUsers).mockRejectedValue(new ApiError(
      'Erro interno do servidor.',
      500,
      undefined,
      '019a1234-0000-7000-8000-000000000099',
    ))
    const user = userEvent.setup()
    render(<LoginHarness />)

    await user.click(screen.getByRole('button', { name: 'entrar' }))
    await user.type(screen.getByRole('combobox', { name: 'nome ou e-mail' }), 'Lu')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Erro interno do servidor. Referência: 019a1234-0000-7000-8000-000000000099',
    )
  })
})
