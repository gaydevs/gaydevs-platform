// Only entries created by this shared writer have a trustworthy physical offset.
// Legacy entries and native hash entries deliberately start a new chain.
export const PLATFORM_HISTORY_CHANGE = 'gdevs:history-change'

type Position = { chain: string; index: number; key: string; href: string }
export type HistoryLocation = { href: string; position: Position | null }

function token() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('')
}

export function readHistory(): HistoryLocation {
  const href = window.location.href
  const position = window.history.state?.gdevsHistory as Position | undefined
  return {
    href,
    position: position && typeof position.chain === 'string' && Number.isSafeInteger(position.index)
      && typeof position.key === 'string' && position.href === href ? position : null,
  }
}

export function ensureHistory(): HistoryLocation {
  const current = readHistory()
  if (current.position) return current
  const position = { chain: token(), index: 0, key: token(), href: current.href }
  window.history.replaceState({ ...window.history.state, gdevsHistory: position }, '')
  return { href: current.href, position }
}

export function pushHistory(url: string) {
  const current = ensureHistory().position!
  const href = new URL(url, window.location.href).href
  const position = { chain: current.chain, index: current.index + 1, key: token(), href }
  window.history.pushState({ gdevsHistory: position }, '', href)
  window.dispatchEvent(new Event(PLATFORM_HISTORY_CHANGE))
}

export function replaceHistory(url: string) {
  const current = ensureHistory().position!
  const href = new URL(url, window.location.href).href
  window.history.replaceState({ ...window.history.state, gdevsHistory: { ...current, href } }, '', href)
  window.dispatchEvent(new Event(PLATFORM_HISTORY_CHANGE))
}

export function historyDelta(source: HistoryLocation, target: HistoryLocation) {
  const a = source.position, b = target.position
  return a && b && a.chain === b.chain ? b.index - a.index : 0
}

export function sameEntry(a: HistoryLocation, b: HistoryLocation) {
  return a.href === b.href && Boolean(a.position && b.position && a.position.key === b.position.key)
}
