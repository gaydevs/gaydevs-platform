import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LinkifiedText } from './LinkifiedText'

describe('LinkifiedText', () => {
  it('converts URLs into safe links opened in a new tab', () => {
    const html = renderToStaticMarkup(<LinkifiedText text="Jogue em https://example.com/game." />)

    expect(html).toContain('href="https://example.com/game"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('https://example.com/game</a>.')
  })

  it('keeps ordinary text unchanged', () => {
    expect(renderToStaticMarkup(<LinkifiedText text="Nenhum link aqui" />)).toBe('Nenhum link aqui')
  })
})
