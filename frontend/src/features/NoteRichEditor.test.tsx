// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { Editor } from '@tiptap/core'
import { afterEach, expect, test, vi } from 'vitest'
import { NoteRichEditor } from './NoteRichEditor'

// jsdom has no selection geometry. Keep the real editor and commands,
// replacing only the floating menu positioning wrapper.
vi.mock('@tiptap/react/menus', () => ({
  BubbleMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

// Supply the missing Range geometry used by ProseMirror's focus/scroll.
Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [new DOMRect()] })
Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() })
afterEach(cleanup)

test.each([1, 2, 3] as const)('H%i applies and removes the correct heading, with Markdown round-trip', async level => {
  const onChange = vi.fn()
  const { unmount } = render(<NoteRichEditor content="Texto de teste" onChange={onChange} />)
  const field = await screen.findByRole('textbox', { name: 'Anotações' }, { timeout: 5000 })
  const editor = (field as HTMLElement & { editor: Editor }).editor
  act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }) })
  const button = screen.getByRole('button', { name: 'Título H' + level })
  expect(button).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(button)
  await waitFor(() => expect(field.querySelector('h' + level)).toHaveTextContent('Texto de teste'))
  await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
  for (const other of [1, 2, 3].filter(value => value !== level)) {
    expect(screen.getByRole('button', { name: 'Título H' + other })).toHaveAttribute('aria-pressed', 'false')
  }
  const markdown = '#'.repeat(level) + ' Texto de teste'
  expect(onChange.mock.lastCall?.[0].trim()).toBe(markdown)
  fireEvent.click(button)
  await waitFor(() => expect(field.querySelector('p')).toHaveTextContent('Texto de teste'))
  expect(onChange.mock.lastCall?.[0].trim()).toBe('Texto de teste')
  unmount()
  render(<NoteRichEditor content={markdown} onChange={vi.fn()} />)
  expect(await screen.findByRole('heading', { level, name: 'Texto de teste' })).toBeInTheDocument()
})

test.each([
  ['Negrito', 'strong', '**Texto** de teste'],
  ['Itálico', 'em', '*Texto* de teste'],
  ['Lista', 'ul li', '- Texto de teste'],
  ['Lista numerada', 'ol li', '1. Texto de teste'],
])('%s toggles formatting and survives reopening', async (label, selector, expected) => {
  const onChange = vi.fn()
  const { unmount } = render(<NoteRichEditor content="Texto de teste" onChange={onChange} />)
  const field = await screen.findByRole('textbox', { name: 'Anotações' })
  const editor = (field as HTMLElement & { editor: Editor }).editor
  act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }) })
  const button = screen.getByRole('button', { name: label })
  fireEvent.click(button)
  await waitFor(() => expect(field.querySelector(selector)).not.toBeNull())
  await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
  const markdown = onChange.mock.lastCall?.[0]
  expect(markdown.trim()).toBe(expected)
  fireEvent.click(button)
  await waitFor(() => expect(field.querySelector(selector)).toBeNull())
  expect(onChange.mock.lastCall?.[0].trim()).toBe('Texto de teste')
  unmount()
  render(<NoteRichEditor content={markdown} onChange={vi.fn()} />)
  expect((await screen.findByRole('textbox', { name: 'Anotações' })).querySelector(selector)).not.toBeNull()
})

test('clearing editor emits an empty note', async () => {
  const onChange = vi.fn()
  render(<NoteRichEditor content="Texto" onChange={onChange} />)
  const field = await screen.findByRole('textbox', { name: 'Anotações' })
  act(() => { (field as HTMLElement & { editor: Editor }).editor.commands.clearContent() })
  expect(onChange).toHaveBeenLastCalledWith('')
})
