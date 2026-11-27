import { useEffect, useRef, type RefObject } from 'react'

const focusableSelector = 'a[href], area[href], button, input, select, textarea, iframe, summary, [contenteditable="true"], [tabindex]'
const modalStack: HTMLElement[] = []
let previousOverflow = ''

function tabbableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
    .filter(element => {
      if (element.tabIndex < 0 || element.matches(':disabled, input[type="hidden"]') || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
      for (let current: HTMLElement | null = element; current; current = current.parentElement) {
        const style = window.getComputedStyle(current)
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
        if (current === dialog) break
      }
      return true
    })
    .sort((a, b) => (a.tabIndex || Number.MAX_SAFE_INTEGER) - (b.tabIndex || Number.MAX_SAFE_INTEGER))
}

/** Shared focus containment, Escape handling and scroll lock for every modal. */
export function useModalLifecycle(onClose: (() => void) | undefined, dialogRef: RefObject<HTMLElement | null>, focusSelector?: string) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement && !dialog.contains(document.activeElement)
      ? document.activeElement : null
    if (modalStack.length === 0) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    modalStack.push(dialog)
    const isTop = () => modalStack.at(-1) === dialog
    const focusEdge = (backward = false) => {
      const elements = tabbableElements(dialog)
      const target = (backward ? elements.at(-1) : elements[0]) ?? dialog
      target.focus()
    }

    const initial = focusSelector ? dialog.querySelector<HTMLElement>(focusSelector) : null
    if (initial && tabbableElements(dialog).includes(initial)) initial.focus()
    else if (!dialog.contains(document.activeElement)) focusEdge()

    const keydown = (event: KeyboardEvent) => {
      if (!isTop() || event.defaultPrevented) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      const elements = tabbableElements(dialog)
      const index = elements.indexOf(document.activeElement as HTMLElement)
      if (index === -1 || (event.shiftKey ? index === 0 : index === elements.length - 1)) {
        event.preventDefault()
        focusEdge(event.shiftKey)
      }
    }
    const containFocus = (event: FocusEvent) => {
      if (isTop() && event.target instanceof Node && !dialog.contains(event.target)) focusEdge()
    }
    window.addEventListener('keydown', keydown)
    document.addEventListener('focusin', containFocus)
    return () => {
      const wasTop = isTop()
      window.removeEventListener('keydown', keydown)
      document.removeEventListener('focusin', containFocus)
      const index = modalStack.lastIndexOf(dialog)
      if (index !== -1) modalStack.splice(index, 1)
      if (modalStack.length === 0) document.body.style.overflow = previousOverflow
      if (wasTop) {
        const top = modalStack.at(-1)
        if (previousFocus?.isConnected && (!top || top.contains(previousFocus))) previousFocus.focus()
        else if (top && !top.contains(document.activeElement)) (tabbableElements(top)[0] ?? top).focus()
      }
    }
  }, [dialogRef, focusSelector])
}
