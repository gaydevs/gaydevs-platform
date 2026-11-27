// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PendingSaveDialog } from '../components/PendingSaveDialog'
import { RestrictedAccessDialog } from '../components/RestrictedAccessDialog'
import { LoginDialog } from './auth/LoginDialog'
import { PollAuditDialog, PollCloseDialog, PollErrorDialog, PollHideOptionDialog } from './PollDialogs'
import { PollSuggestionsDialog } from './PollSuggestions'
import { closePoll, getPollAudit, type Poll } from './pollsApi'

vi.mock('./pollsApi', async importOriginal => ({
  ...await importOriginal<typeof import('./pollsApi')>(),
  closePoll: vi.fn(),
  getPollAudit: vi.fn(),
}))

const option = { id: '1', label: 'Primeiro', votes: 1, percentage: 100, voters: [] }
const poll: Poll = {
  id: 'poll', slug: 'poll', question: 'Qual jogo?', created_at: null,
  creator: { id: 'user', name: 'Gdev' }, started_at: '2026-10-20T12:00:00Z',
  started_on: null, allow_multiple: true, allow_new_options: false,
  closed: false, closed_at: null, has_votes: true, total_votes: 1, message: null,
  selected_options: [], options: [option],
}
beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(getPollAudit).mockResolvedValue({
    poll: { id: poll.id, slug: poll.slug, question: poll.question, creator: poll.creator!, created_at: null, closed_at: null },
    events: [{ id: '1', type: 'poll_created', actor: null, at: null }],
  })
})
afterEach(() => { cleanup(); vi.resetAllMocks() })

const noop = () => {}
const asyncNoop = async () => {}
const noteProps = { brand: <span>Marca</span>, eyebrow: 'TESTE', onHome: noop, description: 'Restrito' }
const saveProps = { brand: <span>Marca</span>, eyebrow: 'TESTE', savingTitle: 'Salvando', sessionDescription: 'Sessão alterada', onCancel: noop, onIgnore: noop, onRetry: noop, onReload: noop }

test.each([
  ['login', <LoginDialog step="search" onStepChange={noop} onClose={noop} onAuthenticated={asyncNoop} />, 'fechar login', 'nome ou e-mail'],
  ['acesso restrito', <RestrictedAccessDialog {...noteProps} />, 'voltar à home', 'Home'],
  ['salvamento', <PendingSaveDialog {...saveProps} status="saving" />, 'cancelar saída', 'Ignorar'],
  ['erro', <PollErrorDialog message="erro" onClose={noop} />, 'fechar erro', 'Entendi'],
  ['encerramento', <PollCloseDialog poll={poll} onClose={noop} onClosed={noop} />, 'fechar confirmação', 'Encerrar'],
  ['ocultação', <PollHideOptionDialog poll={poll} option={option} onClose={noop} onHidden={noop} />, 'fechar confirmação', 'ocultar'],
  ['auditoria', <PollAuditDialog poll={poll} onClose={noop} />, 'fechar auditoria', 'filtrar auditoria'],
  ['sugestões', <PollSuggestionsDialog suggestions={[]} onClose={noop} onNavigate={noop} basePath="/polls" onDismissSuggestion={asyncNoop} onSnooze={asyncNoop} onError={noop} />, 'fechar sugestões', 'Agora não'],
] as const)('contains focus in the actual %s modal', async (_name, component, firstLabel, lastLabel) => {
  const user = userEvent.setup()
  render(<><button>Fundo anterior</button>{component}<button>Fundo posterior</button></>)
  const dialog = screen.getByRole('dialog')
  const first = within(dialog).getByRole('button', { name: firstLabel })
  const last = await within(dialog).findByRole(_name === 'login' || _name === 'auditoria' ? 'combobox' : 'button', { name: lastLabel })
  last.focus()
  await user.tab()
  expect(first).toHaveFocus()
  await user.tab({ shift: true })
  expect(last).toHaveFocus()
  screen.getByRole('button', { name: 'Fundo posterior' }).focus()
  expect(first).toHaveFocus()
})

test('busy confirmation excludes disabled actions and preserves the existing Escape restriction', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  vi.mocked(closePoll).mockReturnValue(new Promise(() => undefined))
  render(<PollCloseDialog poll={poll} onClose={onClose} onClosed={noop} />)
  await user.click(screen.getByRole('button', { name: 'Encerrar' }))
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Encerrar' })).toBeDisabled()
  const close = screen.getByRole('button', { name: 'fechar confirmação' })
  await user.tab()
  expect(close).toHaveFocus()
  await user.tab({ shift: true })
  expect(close).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).not.toHaveClass('login-dialog--closing')
})
