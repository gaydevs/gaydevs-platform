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

test.each([
  ['image-only clipboard', { types: ['Files'], files: [new File(['image'], 'image.png', { type: 'image/png' })], getData: (): string => '' }],
  ['empty clipboard', { types: ['text/plain'], getData: (): string => '' }],
  ['unavailable clipboard', undefined],
] as const)('%s preserves selected text without emitting onChange', async (_scenario, clipboardData) => {
  const onChange = vi.fn()
  render(<NoteRichEditor content="Texto de teste" onChange={onChange} />)
  const field = await screen.findByRole('textbox', { name: 'Anotações' })
  const editor = (field as HTMLElement & { editor: Editor }).editor
  act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }) })
  expect(editor.state.doc.textBetween(1, 6)).toBe('Texto')
  expect(editor.state.selection.empty).toBe(false)
  fireEvent.paste(field, { clipboardData })
  expect(field).toHaveTextContent('Texto de teste')
  expect(editor.state.doc.textContent).toBe('Texto de teste')
  expect(editor.state.selection.from).toBe(1)
  expect(editor.state.selection.to).toBe(6)
  expect(onChange).not.toHaveBeenCalled()
})

test('pastes plain text at the cursor and emits the updated Markdown', async () => {
  const onChange = vi.fn()
  render(<NoteRichEditor content="Texto de teste" onChange={onChange} />)
  const field = await screen.findByRole('textbox', { name: 'Anotações' })
  const editor = (field as HTMLElement & { editor: Editor }).editor
  act(() => { editor.commands.setTextSelection(6) })
  fireEvent.paste(field, { clipboardData: { types: ['text/plain', 'text/html'], getData: (type: string) => type === 'text/plain' ? ' novo' : '<strong>novo</strong>' } })
  expect(editor.state.doc.textContent).toBe('Texto novo de teste')
  expect(field.querySelector('strong')).toBeNull()
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange.mock.lastCall?.[0].trim()).toBe('Texto novo de teste')
})

test('pastes plain text over a selection and emits the replacement once', async () => {
  const onChange = vi.fn()
  render(<NoteRichEditor content="Texto de teste" onChange={onChange} />)
  const field = await screen.findByRole('textbox', { name: 'Anotações' })
  const editor = (field as HTMLElement & { editor: Editor }).editor
  act(() => { editor.commands.setTextSelection({ from: 1, to: 6 }) })
  fireEvent.paste(field, { clipboardData: { types: ['text/plain'], getData: () => 'Nota' } })
  expect(editor.state.doc.textContent).toBe('Nota de teste')
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange.mock.lastCall?.[0].trim()).toBe('Nota de teste')
})

test('preserves intentionally pasted whitespace as text', async () => {
  const onChange = vi.fn()
  render(<NoteRichEditor content="Texto de teste" onChange={onChange} />)
  const field = await screen.findByRole('textbox', { name: 'Anotações' })
  const editor = (field as HTMLElement & { editor: Editor }).editor
  act(() => { editor.commands.setTextSelection(6) })
  fireEvent.paste(field, { clipboardData: { types: ['text/plain'], getData: () => ' ' } })
  expect(editor.state.doc.textContent).toBe('Texto  de teste')
  expect(onChange).toHaveBeenCalledTimes(1)
})
