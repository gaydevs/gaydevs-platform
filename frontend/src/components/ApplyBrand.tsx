export function ApplyBrand({ className }: { className?: string }) {
  return <span className={['polls-brand', className].filter(Boolean).join(' ')}>
    <img src={`${import.meta.env.BASE_URL}apply-icon.svg`} alt="" aria-hidden="true" />
    <span>/gdevs/apply</span>
  </span>
}
