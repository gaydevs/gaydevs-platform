import { useEffect, useRef, type RefObject } from 'react'

/** Shared lifecycle for the restricted-access and pending-save dialogs. */
export function useModalLifecycle(onClose: () => void, initialFocus: RefObject<HTMLElement | null>, focusSelector?: string) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const target = focusSelector ? initialFocus.current?.querySelector<HTMLElement>(focusSelector) : initialFocus.current
    target?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', escape)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', escape)
    }
  }, [initialFocus, focusSelector])
}
