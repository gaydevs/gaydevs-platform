import { useEffect, type RefObject } from 'react'

interface SectionBrandVisibilityOptions {
  brandRef: RefObject<Element | null>
  enabled?: boolean
  onVisibilityChange?: (visible: boolean) => void
}

/** Observa a marca principal de uma seção para alternar entre o título grande e a barra fixa. */
export function useSectionBrandVisibility({ brandRef, enabled = true, onVisibilityChange }: SectionBrandVisibilityOptions) {
  useEffect(() => {
    const element = brandRef.current
    if (!enabled || !element || !onVisibilityChange) return

    const updateVisibility = () => {
      const bounds = element.getBoundingClientRect()
      onVisibilityChange(bounds.bottom > 0 && bounds.top < window.innerHeight)
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    window.addEventListener('resize', updateVisibility)
    return () => {
      window.removeEventListener('scroll', updateVisibility)
      window.removeEventListener('resize', updateVisibility)
    }
  }, [brandRef, enabled, onVisibilityChange])
}
