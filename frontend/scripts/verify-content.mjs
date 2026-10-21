import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const approvedPath = process.argv[2]
const approved = approvedPath ? (await readFile(resolve(approvedPath), 'utf8')).replace(/\r/g, '') : null
const normalize = (text) => text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
const toIsoDate = (date) => {
  const [day, month, year] = date.split('.')
  return `${year}-${month}-${day}`
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx')
  const html = renderToStaticMarkup(createElement(App))
  const text = normalize(html
    .replace(/<(?:p|h[1-6]|li|figcaption|pre|dt|dd|div)\b[^>]*>/g, ' ')
    .replace(/<\/(?:p|h[1-6]|li|figcaption|pre|dt|dd|div)>/g, ' ')
    .replace(/<\/time>/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))

  const { timeline } = await server.ssrLoadModule('/src/data/timeline.ts')
  const { lore } = await server.ssrLoadModule('/src/data/lore.ts')
  const { photos } = await server.ssrLoadModule('/src/data/photos.ts')
  const { events } = await server.ssrLoadModule('/src/data/events.ts')
  const { community } = await server.ssrLoadModule('/src/data/community.ts')

  assert.equal((html.match(/<h1\b/g) || []).length, 1)
  assert.equal((html.match(/<section\b/g) || []).length, 9)
  assert.ok(!/GayDevs?|lorem ipsum/.test(html))
  assert.ok(timeline.length > 0)
  assert.equal(lore.length, 2)
  assert.equal(photos.length, 6)
  assert.equal(events.length, 5)
  assert.equal(community.length, 4)

  if (!approved) {
    console.log(`PASS: baseline de conteúdo — ${timeline.length} entradas na timeline, ${lore.length} perfis, ${photos.length} fotos, ${events.length} formatos, ${community.length} espaços, nove seções e um h1.`)
  } else {
    const contentStart = approved.indexOf('## 1. Hero')
    assert.ok(contentStart >= 0, 'Approved content must contain ## 1. Hero')
    const content = approved.slice(contentStart)
    const snippets = []
    for (const block of content.matchAll(/(?:^>[^\n]*(?:\n|$))+/gm)) {
      snippets.push(...block[0].split(/\n>\s*\n/).map((paragraph) => normalize(paragraph.replace(/^> ?/gm, ''))).filter(Boolean))
    }
    for (const item of content.matchAll(/^- (.+)$/gm)) snippets.push(normalize(item[1]))
    for (const heading of content.matchAll(/^### (.+)$/gm)) snippets.push(normalize(heading[1]))
    for (const block of content.matchAll(/```(?:text|bash|json)\n([\s\S]*?)```/g)) {
      for (const line of block[1].split('\n').filter((line) => line.trim())) snippets.push(normalize(line))
    }
    assert.deepEqual(snippets.filter((snippet) => !text.includes(snippet)), [], 'Approved content missing or changed in rendered HTML')

    const log = content.split('## 5. git log gaydevs')[1].split('## 6.')[0]
    const expectedTimeline = [...log.matchAll(/^(\d{2}\.\d{2}\.\d{4}) {2}(\w+)\n([^\n]+)(?:\n([^\n`]+))?/gm)].map((match) => ({ date: toIsoDate(match[1]), type: match[2], title: match[3], ...(match[4] ? { description: match[4] } : {}) }))
    assert.deepEqual(timeline, expectedTimeline, 'Timeline fields/order differ')

    const expectedLore = [...content.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => JSON.parse(match[1]))
    assert.deepEqual(lore.map((profile) => profile.attributes), expectedLore, 'Lore JSON differs')

    const photoSection = content.split('## 6. gaydevs na prática')[1].split('## 7.')[0]
    assert.deepEqual(photos.map((photo) => photo.caption), [...photoSection.matchAll(/^- (.+)$/gm)].map((match) => match[1]), 'Photo order/captions differ')

    const eventSection = content.split('## 4. Eventos')[1].split('## 5.')[0]
    assert.deepEqual(events.map((format) => format.title), [...eventSection.matchAll(/^### (.+)$/gm)].map((match) => match[1]), 'Event formats/order differ')

    const communitySection = content.split('## 7. Como o gaydevs se organiza')[1].split('## 8.')[0]
    assert.deepEqual(community.map((space) => space.commands.join('\n')), [...communitySection.matchAll(/```bash\n([\s\S]*?)\n```/g)].map((match) => match[1]), 'Community commands/order differ')

    console.log(`PASS: audit editorial — ${snippets.length} trechos, ${timeline.length} entradas na timeline, lore, fotos, eventos, comandos, nove seções e um h1.`)
  }
} finally {
  await server.close()
}
