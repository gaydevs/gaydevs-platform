import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { NoteEditorLoading } from './NotesLoadingStates'

const extensions = [
  StarterKit.configure({ link: false, underline: false, strike: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false, heading: { levels: [1, 2, 3] } }),
  Markdown.configure({ markedOptions: { gfm: false } }),
]

export function NoteRichEditor({ content, onChange }: { content: string; onChange: (value: string) => void }) {
  const editor = useEditor({
    extensions,
    // Neutralize HTML before the Markdown parser can interpret it.
    content: content.replace(/</g, '&lt;'),
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: {
      attributes: { role: 'textbox', 'aria-label': 'Anotações', 'aria-multiline': 'true', class: 'notes-editor-content' },
      transformPastedHTML: () => '',
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain')
        if (text) view.dispatch(view.state.tr.insertText(text))
        return true
      },
      handleDrop: (_view, event) => {
        event.preventDefault()
        return true
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getMarkdown()),
  })
  const active = useEditorState({
    editor,
    selector: ({ editor }) => editor ? {
      bold: editor.isActive('bold'), italic: editor.isActive('italic'), heading1: editor.isActive('heading', { level: 1 }), heading2: editor.isActive('heading', { level: 2 }), heading3: editor.isActive('heading', { level: 3 }),
      bullet: editor.isActive('bulletList'), ordered: editor.isActive('orderedList'),
    } : null,
  })
  if (!editor) return <NoteEditorLoading />
  return <div className="notes-editor">
    <BubbleMenu editor={editor} options={{ placement: 'top', offset: 8 }} >
      <div className="notes-bubble-menu" role="toolbar" aria-label="Formatação">
        <button type="button" aria-label="Negrito" aria-pressed={active?.bold} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></button>
        <button type="button" aria-label="Itálico" aria-pressed={active?.italic} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></button>
        {([1, 2, 3] as const).map(level => <button key={level} type="button" aria-label={`Título H${level}`} aria-pressed={active?.[`heading${level}`]} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level }).run()}>H{level}</button>)}
        <button type="button" aria-label="Lista" aria-pressed={active?.bullet} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()}>• ≡</button>
        <button type="button" aria-label="Lista numerada" aria-pressed={active?.ordered} onMouseDown={e => e.preventDefault()} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. ≡</button>
      </div>
    </BubbleMenu>
    <EditorContent editor={editor} />
  </div>
}
