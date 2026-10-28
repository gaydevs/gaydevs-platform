import type { MouseEvent, ReactNode } from 'react'

const URL_PATTERN = /https?:\/\/[^\s<]+/gi

function splitTrailingPunctuation(value: string): { href: string; trailing: string } {
  const match = value.match(/[.,!?;:]+$/)
  if (!match) return { href: value, trailing: '' }
  return { href: value.slice(0, -match[0].length), trailing: match[0] }
}

export function LinkifiedText({ text, stopPropagation = false }: { text: string; stopPropagation?: boolean }) {
  const parts: ReactNode[] = []
  let cursor = 0
  let linkIndex = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const rawUrl = match[0]
    const start = match.index ?? 0
    const { href, trailing } = splitTrailingPunctuation(rawUrl)
    parts.push(text.slice(cursor, start))
    parts.push(<a key={`${href}-${linkIndex}`} className="poll-inline-link" href={href} target="_blank" rel="noopener noreferrer" onClick={(event: MouseEvent<HTMLAnchorElement>) => { if (stopPropagation) event.stopPropagation() }}>{href}</a>)
    parts.push(trailing)
    cursor = start + rawUrl.length
    linkIndex += 1
  }

  parts.push(text.slice(cursor))
  return <>{parts}</>
}
