import { useEffect, useRef, useState } from 'react'
import { FieldActionButton } from '../../components/FieldActionButton'
import { FieldControl } from '../../components/FieldControl'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { messageForApiError, requestOtp, searchUsers, type MaskedUser } from './api'
import type { OtpLoginContext } from './types'

const SEARCH_DELAY_MS = 250

interface UserSearchStepProps {
  onOtpRequested: (context: OtpLoginContext) => void
}

/** Permite localizar um usuário mascarado e solicitar o primeiro OTP. */
export function UserSearchStep({ onOtpRequested }: UserSearchStepProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MaskedUser[]>([])
  const [searching, setSearching] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [clearSelectionOnClick, setClearSelectionOnClick] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchInput = useRef<HTMLInputElement>(null)

  /** Limpa a busca pelo controle visual próprio, sem depender do navegador. */
  const clearSearch = () => {
    setQuery('')
    setResults([])
    setSearching(false)
    setSuggestionsOpen(false)
    setClearSelectionOnClick(false)
    setError(null)
    searchInput.current?.focus()
  }

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length === 0) return

    // O debounce reduz chamadas enquanto a pessoa ainda está digitando.
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setSearching(true)
      searchUsers(normalized, controller.signal)
        .then(setResults)
        .catch((requestError: unknown) => {
          if (!controller.signal.aborted) setError(messageForApiError(requestError))
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, SEARCH_DELAY_MS)

    // Uma nova busca cancela a anterior para evitar resultados fora de ordem.
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [query])

  /** Envia somente o UUID selecionado; o nome mascarado serve apenas à interface. */
  const requestAccess = async (user: MaskedUser) => {
    // A lista fecha imediatamente; o campo fica bloqueado até a resposta do backend.
    // `user.name` veio da busca já mascarado pelo backend.
    setQuery(user.name)
    setResults([])
    setSuggestionsOpen(false)
    setClearSelectionOnClick(false)
    setRequesting(true)
    setError(null)

    try {
      const otp = await requestOtp(user.id)
      onOtpRequested({ ...otp, user })
    } catch (requestError) {
      // Após a falha, o próximo clique no campo poderá limpar a seleção e tentar novamente.
      setClearSelectionOnClick(true)
      setError(messageForApiError(requestError))
    } finally {
      setRequesting(false)
    }
  }

  const suggestionsVisible = suggestionsOpen && query.trim().length > 0

  return <div className="login-dialog__panel login-dialog__panel--search">
    <p className="login-dialog__eyebrow">área dos gdevs</p>
    <h2 id="login-title">entrar sem senha</h2>

    <div className="login-autocomplete">
      <div className="login-field">
        <FieldControl
            ref={searchInput}
            autoFocus
            type="search"
            role="combobox"
            aria-label="nome ou e-mail"
            aria-autocomplete="list"
            aria-controls="login-user-results"
            aria-expanded={suggestionsVisible}
            aria-busy={requesting}
            value={query}
            disabled={requesting}
            onChange={(event) => {
              // Digitar novamente inicia uma nova consulta e remove o erro anterior.
              setQuery(event.target.value)
              setResults([])
              setSearching(false)
              setSuggestionsOpen(true)
              setClearSelectionOnClick(false)
              setError(null)
            }}
            onClick={() => {
              if (!clearSelectionOnClick) return
              setQuery('')
              setClearSelectionOnClick(false)
              setError(null)
            }}
            inputMode="search"
            autoComplete="off"
            data-bwignore="true"
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            placeholder="digite seu nome ou e-mail"
          before={<span className="login-field__prefix">gdev</span>}
          after={query && !requesting ? <FieldActionButton variant="remove" small aria-label="limpar busca" onClick={clearSearch} /> : requesting ? <LoadingSpinner className="login-field__spinner" /> : null}
        />
      </div>
      {requesting && <span className="sr-only" role="status">enviando código</span>}

      {suggestionsVisible && <div id="login-user-results" className="login-results" role="listbox" aria-live="polite">
        {searching && <p role="status">buscando…</p>}
        {!searching && results.length === 0 && !error && <p>nenhum gdev encontrado.</p>}
        {results.map((user) => <button
          className="login-result"
          type="button"
          role="option"
          key={user.id}
          aria-selected="false"
          disabled={requesting}
          onClick={() => void requestAccess(user)}
        >
          <strong>{user.name}</strong>
          <span>&lt;{user.email}&gt;</span>
        </button>)}
      </div>}
    </div>

    {error && <p className="login-error" role="alert">{error}</p>}
  </div>
}
