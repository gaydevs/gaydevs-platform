import type { ReactNode } from 'react'

export function SectionSubmenuBar({ visible, children, className }: { visible: boolean; children: ReactNode; className?: string }) {
  const classes = ['section-submenu-bar', className].filter(Boolean).join(' ')
  return <div className={`${classes}${visible ? ' section-submenu-bar--visible' : ''}`} aria-hidden={!visible}><div className="container">{children}</div></div>
}
