import type { MouseEventHandler, Ref } from 'react'

interface PollsBrandProps {
  className?: string
  wordmark?: string
  href?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  linked?: boolean
  iconRef?: Ref<HTMLImageElement>
}

/** Marca visual da seção de enquetes, reutilizada na landing e no cabeçalho. */
export function PollsBrand({ className, wordmark, href = '#', onClick, linked = true, iconRef }: PollsBrandProps) {
  const classes = ['polls-brand', className].filter(Boolean).join(' ')
  const content = <><img ref={iconRef} src={`${import.meta.env.BASE_URL}polls-icon.svg`} alt="" aria-hidden="true" /><span>{wordmark ?? '/gdevs/polls'}</span></>

  return linked
    ? <a className={classes} href={href} aria-label="abrir enquetes" onClick={onClick}>{content}</a>
    : <span className={classes}>{content}</span>
}
