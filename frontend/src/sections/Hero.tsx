import { useEffect, useRef } from 'react'
import type { HeroContent, ImageAsset } from '../types/content'
import { ActionLink } from '../components/ActionLink'

interface HeroProps {
  content: HeroContent
  mobile: ImageAsset
  desktop: ImageAsset
  onBrandVisibilityChange?: (visible: boolean) => void
}

export function Hero({ content, mobile, desktop, onBrandVisibilityChange }: HeroProps) {
  const srcSet = (image: ImageAsset) => image.sources.map((source) => `${source.src} ${source.width}w`).join(', ')
  const brandIconSrc = `${import.meta.env.BASE_URL}brand-icon-512.png`
  const brandIcon = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const element = brandIcon.current
    if (!element || !onBrandVisibilityChange) return

    // O header muda de formato quando a marca principal deixa a viewport.
    if (typeof window.IntersectionObserver === 'undefined') {
      const updateVisibility = () => {
        const bounds = element.getBoundingClientRect()
        onBrandVisibilityChange(bounds.bottom > 0 && bounds.top < window.innerHeight)
      }
      updateVisibility()
      window.addEventListener('scroll', updateVisibility, { passive: true })
      return () => window.removeEventListener('scroll', updateVisibility)
    }

    const observer = new IntersectionObserver(([entry]) => {
      onBrandVisibilityChange(entry.isIntersecting)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [onBrandVisibilityChange])

  return <section id="inicio" className="hero" aria-labelledby="hero-title">
    <picture className="hero-art">
      <source media="(min-width: 1024px)" type="image/webp" srcSet={srcSet(desktop)} sizes="100vw" width={desktop.width} height={desktop.height} />
      <source media="(min-width: 1024px)" srcSet={desktop.src} width={desktop.width} height={desktop.height} />
      <source type="image/webp" srcSet={srcSet(mobile)} sizes="(min-width: 768px) 768px, 100vw" width={mobile.width} height={mobile.height} />
      <img src={mobile.src} width={mobile.width} height={mobile.height} alt="" fetchPriority="high" decoding="async" />
    </picture>
    <div className="hero-content container">
      <p className="hero-eyebrow">{content.eyebrow}</p>
      <h1 id="hero-title">
        <img ref={brandIcon} className="hero-brand-icon" src={brandIconSrc} alt="" aria-hidden="true" />
        <span className="hero-title-text">{content.title}<span className="hero-cursor" aria-hidden="true">_</span></span>
      </h1>
      <p className="hero-subtitle">{content.subtitle}</p>
      <p className="hero-description">{content.description}</p>
      <p className="hero-tagline">{content.tagline}</p>
      <ActionLink link={content.cta} />
    </div>
  </section>
}
