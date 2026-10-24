import { useCallback, useEffect, useState } from 'react'
import { currentSession, logout as requestLogout, type AuthenticatedUser } from './api'

/** Carrega a sessão atual e expõe ações de atualizar e encerrar o login. */
export function useAuth() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [restoring, setRestoring] = useState(true)
  useEffect(() => {
    let active = true
    // A resposta pode chegar depois do unmount; active evita setState nesse caso.
    currentSession().then((sessionUser) => { if (active) setUser(sessionUser) }).catch(() => { if (active) setUser(null) }).finally(() => { if (active) setRestoring(false) })
    return () => { active = false }
  }, [])
  /** Reconsulta a sessão após uma autenticação bem-sucedida. */
  const refresh = useCallback(async () => { const sessionUser = await currentSession(); setUser(sessionUser); return sessionUser }, [])
  /** Encerra a sessão no backend e limpa o usuário local. */
  const logout = useCallback(async () => { await requestLogout(); setUser(null) }, [])
  return { user, restoring, refresh, logout }
}
