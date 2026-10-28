import { useEffect, useRef, useState, type ReactNode } from 'react'

type OverflowMenuContent = ReactNode | ((close: () => void) => ReactNode)

interface OverflowMenuProps {
  label: string
  children: OverflowMenuContent
  className?: string
}

export function OverflowMenu({ label, children, className = '' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  const close = () => setOpen(false)
  const content = typeof children === 'function' ? children(close) : children

  return <div className={`overflow-menu${className ? ` ${className}` : ''}`} ref={menuRef} onClick={(event) => event.stopPropagation()}>
    <button className="overflow-menu__trigger" type="button" aria-label={label} aria-expanded={open} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen((current) => !current) }}>⋯</button>
    {open && <div className="overflow-menu__popover" onClick={(event) => { event.stopPropagation(); setOpen(false) }}>{content}</div>}
  </div>
}
