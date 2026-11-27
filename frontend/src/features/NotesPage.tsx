import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SectionSubmenuBar } from '../components/SectionSubmenuBar'
import type { AuthenticatedUser } from './auth/api'
import { getMemberNote, listNoteMembers, saveMemberNote, type MemberNote, type NoteMember } from './notesApi'

function memberInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return [words[0], words.length > 1 ? words.at(-1) : undefined].filter(Boolean).map(word => Array.from(word!)[0]).join('').toLocaleUpperCase('pt-BR')
}

function Avatar({ name }: { name: string }) {
  return <span className="notes-avatar" aria-hidden="true">{memberInitials(name)}</span>
}

export function NotesSectionBar({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  return <SectionSubmenuBar visible><button className="action-link action-link--secondary" type="button" onClick={() => onNavigate(path)}>Anotações</button></SectionSubmenuBar>
}

function inlineMarkdown(line: string): ReactNode[] {
  return line.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={index}>{part.slice(2, -2)}</strong> :
    part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <em key={index}>{part.slice(1, -1)}</em> : part)
}

export function NotePreview({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  for (let index = 0; index < lines.length;) {
    const line = lines[index]
    const list = /^(- |\d+\. )/.exec(line)
    if (list) {
      const ordered = list[0] !== '- '
      const pattern = ordered ? /^\d+\. / : /^- /
      const items: ReactNode[] = []
      const start = index
      while (index < lines.length && pattern.test(lines[index])) {
        items.push(<li key={index}>{inlineMarkdown(lines[index].replace(pattern, ''))}</li>)
        index++
      }
      blocks.push(ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>)
      continue
    }
    const heading = /^#{1,3} (.*)$/.exec(line)
    blocks.push(heading ? <h3 key={index}>{inlineMarkdown(heading[1])}</h3> : <p key={index}>{inlineMarkdown(line)}{line === '' && <br />}</p>)
    index++
  }
  return <div className="notes-preview">{blocks}</div>
}

function NoteList({ base, onNavigate }: { base: string; onNavigate: (path: string) => void }) {
  const [members, setMembers] = useState<NoteMember[] | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    listNoteMembers(controller.signal).then(items => {
      if (!controller.signal.aborted) setMembers([...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id)))
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [])
  return <section className="polls-page polls-page--landing notes-landing container" aria-labelledby="notes-title">
    <div className="section-heading"><h1 id="notes-title">Anotações</h1></div>
    {error ? <p className="poll-error" role="alert">Não foi possível carregar os gdevs.</p> : members === null ? <p role="status">Carregando gdevs…</p> : members.length === 0 ? <p>Nenhum gdev encontrado.</p> :
      <div className="poll-list notes-list">{members.map(member => <button key={member.id} className="poll-card notes-card" type="button" onClick={() => onNavigate(`${base}/${member.id}`)}><Avatar name={member.name} /><span>{member.name}</span></button>)}</div>}
  </section>
}

function NoteEditor({ memberId, base, onNavigate }: { memberId: string; base: string; onNavigate: (path: string) => void }) {
  const [note, setNote] = useState<MemberNote | null>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState(false)
  const editor = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    getMemberNote(memberId, controller.signal).then(result => {
      if (!controller.signal.aborted) { setNote(result); setContent(result.content) }
    }).catch(() => { if (!controller.signal.aborted) setError('Não foi possível carregar a anotação.') })
    return () => controller.abort()
  }, [memberId])
  const format = (prefix: string, suffix = '', line = false) => {
    const field = editor.current
    if (!field) return
    const start = line ? content.lastIndexOf('\n', field.selectionStart - 1) + 1 : field.selectionStart
    const end = field.selectionEnd
    const selection = content.slice(start, end)
    const replacement = line ? selection.split('\n').map(part => prefix + part).join('\n') : prefix + selection + suffix
    const next = content.slice(0, start) + replacement + content.slice(end)
    if (next.length > 10000) return
    setContent(next); setSaved(false)
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length)
    })
  }
  const save = async () => {
    setBusy(true); setError(''); setSaved(false)
    try {
      const updated = await saveMemberNote(memberId, content)
      setNote(updated); setContent(updated.content); setSaved(true)
    } catch { setError('Não foi possível salvar a anotação. Tente novamente.') }
    finally { setBusy(false) }
  }
  return <section className="polls-page container" aria-labelledby="note-title">
    <button className="action-link action-link--secondary" type="button" onClick={() => onNavigate(base)}>Voltar</button>
    {note ? <>
      <div className="notes-heading"><Avatar name={note.member.name} /><h1 id="note-title">{note.member.name}</h1></div>
      <form className="poll-form" onSubmit={event => { event.preventDefault(); void save() }}>
        <label htmlFor={preview ? undefined : "note-content"}>Anotações</label>
        <div className="notes-toolbar" role="group" aria-label="Formatação">
          <button type="button" disabled={busy || preview} aria-label="Negrito" onClick={() => format('**', '**')}><strong>B</strong></button>
          <button type="button" disabled={busy || preview} aria-label="Itálico" onClick={() => format('*', '*')}><em>I</em></button>
          <button type="button" disabled={busy || preview} onClick={() => format('## ', '', true)}>Subtítulo</button>
          <button type="button" disabled={busy || preview} onClick={() => format('- ', '', true)}>Lista</button>
          <button type="button" disabled={busy || preview} onClick={() => format('1. ', '', true)}>Lista numerada</button>
          <button type="button" aria-pressed={preview} onClick={() => setPreview(value => !value)}>{preview ? 'Editar' : 'Visualizar'}</button>
        </div>
        {preview ? <NotePreview content={content} /> : <textarea id="note-content" ref={editor} className="notes-textarea" value={content} disabled={busy} maxLength={10000} onChange={event => { setContent(event.target.value); setSaved(false) }} rows={12} />}
        {error && <p className="poll-error" role="alert">{error}</p>}
        {saved && <p role="status">Anotação salva.</p>}
        <button className="action-link poll-submit-button" type="submit" disabled={busy || content === note.content}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </form>
    </> : <><h1 id="note-title">Anotações</h1>{error ? <p className="poll-error" role="alert">{error}</p> : <p role="status">Carregando…</p>}</>}
  </section>
}

export function NotesPage({ memberId, base, user, restoring, onNavigate }: { memberId: string | null; base: string; user: AuthenticatedUser | null; restoring: boolean; onNavigate: (path: string) => void }) {
  if (restoring) return <section className="polls-page container"><p role="status">Identificando gdev…</p></section>
  if (user?.member_type !== 'admin') return <section className="polls-page container"><p className="poll-error" role="alert">Área restrita.</p></section>
  return memberId ? <NoteEditor key={`${user.id}:${memberId}`} memberId={memberId} base={base} onNavigate={onNavigate} /> : <NoteList key={user.id} base={base} onNavigate={onNavigate} />
}
