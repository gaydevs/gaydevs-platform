import type { AuthenticatedUser } from '../features/auth/api'
import { BrandLogo } from './BrandLogo'

interface AccountHeaderProps {
  user: AuthenticatedUser | null
  restoring: boolean
  brandVisible: boolean
  onLogin: () => void
  onLogout: () => Promise<void>
}

export function AccountHeader({ user, restoring, brandVisible, onLogin, onLogout }: AccountHeaderProps) {
  return <header className={`account-header${brandVisible ? '' : ' account-header--scrolled'}`} aria-label="acesso do gdev">
    <BrandLogo className="account-header__brand" />
    {restoring
      ? <span className="account-header__status">identificando gdev…</span>
      : user
        ? <>
            <span className="account-header__name"><span className="account-header__prefix">gdev</span> <strong>{user.name}</strong></span>
            <button className="account-header__button" type="button" onClick={() => void onLogout()}>sair</button>
          </>
        : <button className="account-header__button account-header__button--primary" type="button" onClick={onLogin}>entrar</button>}
  </header>
}
