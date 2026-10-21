import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActionLink } from './ActionLink'

describe('ActionLink', () => {
  it('abre link externo em nova aba com rel seguro', () => {
    const html = renderToStaticMarkup(<ActionLink link={{ label: 'GitHub', href: 'https://github.com/gaydevs' }} />)

    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('mantém link interno na mesma aba', () => {
    const html = renderToStaticMarkup(<ActionLink link={{ label: 'Sobre', href: '#sobre' }} />)

    expect(html).not.toContain('target="_blank"')
    expect(html).not.toContain('rel="noopener noreferrer"')
  })
})
