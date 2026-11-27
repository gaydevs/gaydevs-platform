import { useEffect, useRef } from 'react'
interface Widget { render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void }
declare global { interface Window { turnstile?: Widget } }
let script: Promise<Widget> | undefined
function loadWidget(): Promise<Widget> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (!script) script = new Promise((resolve, reject) => {
    const tag = document.createElement('script')
    tag.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    tag.async = true
    tag.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile indisponível'))
    tag.onerror = () => reject(new Error('Turnstile indisponível'))
    document.head.append(tag)
  }).catch((error: unknown) => { script = undefined; throw error }) as Promise<Widget>
  return script
}
export function Turnstile({sitekey, action, onToken, onError}: {sitekey: string; action: string; onToken: (token: string) => void; onError: () => void}) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let active = true
    let widget: Widget | undefined
    let id: string | undefined
    loadWidget().then(api => {
      if (!active || !host.current) return
      widget = api
      id = api.render(host.current, {sitekey, action, theme:'dark', size:'flexible', callback: onToken, 'expired-callback': () => onToken(''), 'error-callback': () => { onToken(''); onError() }})
    }).catch(() => { if (active) onError() })
    return () => {active = false; if (id !== undefined) widget?.remove(id)}
  }, [sitekey, action, onToken, onError])
  return <div ref={host} aria-label="proteção antispam" />
}
