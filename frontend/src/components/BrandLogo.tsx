import type { MouseEventHandler } from 'react'

interface BrandLogoProps {
  className?: string
  wordmark?: string
  suffix?: string
  href?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  linked?: boolean
}

/** Marca navegável compartilhada pelo header e pelo fluxo de login. */
export function BrandLogo({ className, wordmark = 'gaydevs', suffix = '_', href = '#inicio', onClick, linked = true }: BrandLogoProps) {
  const brandIconSrc = `${import.meta.env.BASE_URL}brand-icon-512.png`
  const classes = ['brand-logo', className].filter(Boolean).join(' ')
  const content = <><img src={brandIconSrc} alt="" aria-hidden="true" /><span>{wordmark}{suffix && <span aria-hidden="true">{suffix}</span>}</span></>

  return linked
    ? <a className={classes} href={href} aria-label="voltar ao início" onClick={onClick}>{content}</a>
    : <span className={classes}>{content}</span>
}
