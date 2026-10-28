import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { AuthenticatedUser } from '../features/auth/api'
import { BrandLogo } from './BrandLogo'

interface AccountHeaderProps {
  user: AuthenticatedUser | null
  restoring: boolean
  brandVisible: boolean
  onLogin: () => void
  onLogout: () => Promise<void>
  onNavigate: (path: string) => void
}

export function AccountHeader({ user, restoring, brandVisible, onLogin, onLogout, onNavigate }: AccountHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pollsMarker = '/polls'
  const pollsIndex = window.location.pathname.indexOf(pollsMarker)
  const pollsPath = pollsIndex >= 0 ? window.location.pathname.slice(0, pollsIndex) + pollsMarker : `${window.location.pathname.replace(/\/$/, '')}/polls`
  const homePath = pollsIndex >= 0 ? `${window.location.pathname.slice(0, pollsIndex) || '/'}/`.replace(/\/{2,}/g, '/') : '#inicio'
  const goHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (pollsIndex < 0 || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(homePath)
  }
  useEffect(() => {
    if (!menuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)

    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [menuOpen])

  return <header className={`account-header${brandVisible ? '' : ' account-header--scrolled'}`} aria-label="acesso do gdev">
    <BrandLogo className="account-header__brand" href={homePath} onClick={goHome} />
    {restoring
      ? <span className="account-header__status">identificando gdev…</span>
      : user
        ? <>
            <span className="account-header__name"><span className="account-header__prefix">gdev</span> <strong>{user.name}</strong></span>
            <div ref={menuRef} className="account-header__menu">
              <button className="account-header__button" type="button" aria-label="abrir menu" aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((open) => !open)}>menu</button>
              {menuOpen && <nav className="account-header__menu-popover" aria-label="menu do gdev">
                <button type="button" onClick={() => { setMenuOpen(false); onNavigate(homePath) }}>home</button>
                <button type="button" onClick={() => { setMenuOpen(false); onNavigate(pollsPath) }}>enquetes</button>
                <button type="button" onClick={() => { setMenuOpen(false); void onLogout() }}>sair</button>
              </nav>}
            </div>
          </>
        : <button className="account-header__button account-header__button--primary" type="button" onClick={onLogin}>entrar</button>}
  </header>
}
