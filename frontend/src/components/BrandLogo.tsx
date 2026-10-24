interface BrandLogoProps {
  className?: string
  wordmark?: string
  suffix?: string
}

/** Marca navegável compartilhada pelo header e pelo fluxo de login. */
export function BrandLogo({ className, wordmark = 'gaydevs', suffix = '_' }: BrandLogoProps) {
  const brandIconSrc = `${import.meta.env.BASE_URL}brand-icon-512.png`
  const classes = ['brand-logo', className].filter(Boolean).join(' ')

  return <a className={classes} href="#inicio" aria-label="voltar ao início">
    <img src={brandIconSrc} alt="" aria-hidden="true" />
    <span>{wordmark}{suffix && <span aria-hidden="true">{suffix}</span>}</span>
  </a>
}
