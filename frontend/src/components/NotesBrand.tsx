import type { MouseEventHandler, Ref } from 'react'

export function NotesBrand({ className, wordmark = '/gdevs/notes', href = '#', onClick, linked = true, iconRef }: {
  className?: string; wordmark?: string; href?: string; onClick?: MouseEventHandler<HTMLAnchorElement>; linked?: boolean; iconRef?: Ref<HTMLImageElement>
}) {
  const classes = ['polls-brand', 'notes-brand', className].filter(Boolean).join(' ')
  const content = <><img ref={iconRef} src={`${import.meta.env.BASE_URL}notes-icon.svg`} alt="" aria-hidden="true" /><span>{wordmark}</span></>
  return linked ? <a className={classes} href={href} aria-label="abrir anotações" onClick={onClick}>{content}</a> : <span className={classes}>{content}</span>
}
