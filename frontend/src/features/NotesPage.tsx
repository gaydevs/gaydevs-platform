import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { SectionSubmenuBar } from '../components/SectionSubmenuBar'
import { NotesBrand } from '../components/NotesBrand'
import { ModalHeader } from '../components/ModalHeader'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { useSectionBrandVisibility } from '../components/useSectionBrandVisibility'
import { ApiError, type AuthenticatedUser } from './auth/api'
import { getMemberNote, listNoteMembers, type MemberNote, type NoteMember } from './notesApi'
import { NoteListLoading, NoteDetailLoading, NoteEditorLoading } from './NotesLoadingStates'
import { useNoteAutosave, type RegisterLeaveGuard, type SaveStatus } from './useNoteAutosave'

const NoteRichEditor = lazy(() => import('./NoteRichEditor').then(module => ({ default: module.NoteRichEditor })))

function memberInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return [words[0], words.length > 1 ? words.at(-1) : undefined].filter(Boolean).map(word => Array.from(word!)[0]).join('').toLocaleUpperCase('pt-BR')
}

function Avatar({ name }: { name: string }) {
  return <span className="notes-avatar" aria-hidden="true">{memberInitials(name)}</span>
}

export function NotesSectionBar({ visible, path, onNavigate }: { visible: boolean; path: string; onNavigate: (path: string) => void }) {
  return <SectionSubmenuBar visible={visible} className="polls-section-bar"><NotesBrand href={path} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault(); onNavigate(path)
  }} /></SectionSubmenuBar>
}

function NoteList({ actorId, base, onNavigate, onBrandVisibilityChange }: { actorId: string; base: string; onNavigate: (path: string) => void; onBrandVisibilityChange?: (visible: boolean) => void }) {
  const [members, setMembers] = useState<NoteMember[] | null>(null)
  const [error, setError] = useState('')
  const brand = useRef<HTMLImageElement>(null)
  useSectionBrandVisibility({ brandRef: brand, onVisibilityChange: onBrandVisibilityChange })
  useEffect(() => {
    const controller = new AbortController()
    listNoteMembers(actorId, controller.signal).then(items => {
      if (!controller.signal.aborted) setMembers([...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id)))
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof ApiError && error.status === 409 ? 'Sessão alterada. Recarregue a página.' : 'Não foi possível carregar os gdevs.') })
    return () => controller.abort()
  }, [actorId])
  return <section className="polls-page polls-page--landing container" aria-labelledby="notes-title">
    <div className="section-heading polls-landing-heading"><h1 className="polls-hero-title" id="notes-title"><NotesBrand className="polls-hero-brand" linked={false} iconRef={brand} /></h1></div>
    {error ? <p className="poll-error" role="alert">{error}</p> : members === null ? <NoteListLoading /> : members.length === 0 ? <p className="poll-empty">Nenhum gdev encontrado.</p> :
      <div className="poll-list notes-list">{members.map(member => <button key={member.id} className="poll-card notes-card" type="button" onClick={() => onNavigate(`${base}/${member.id}`)}><Avatar name={member.name} /><span className="notes-card__body"><span className="notes-card__name">{member.name}</span>{member.preview?.trim() && <span className="notes-card__preview">{member.preview}</span>}</span></button>)}</div>}
  </section>
}

function SaveDialog({ status, cancel, retry }: { status: SaveStatus; cancel: () => void; retry: () => void }) {
  const cancelButton = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef(cancel)
  useEffect(() => { cancelRef.current = cancel }, [cancel])
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelButton.current?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelRef.current() }
    window.addEventListener('keydown', escape)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', escape) }
  }, [])
  const changed = status === 'session-changed'
  const failed = status === 'error'
  return <div className="login-overlay" role="presentation">
    <section className="login-dialog poll-close-dialog" role="dialog" aria-modal="true" aria-labelledby="notes-save-title">
      <ModalHeader closeLabel="cancelar saída" onClose={cancel}><NotesBrand wordmark="/gdevs/notes" linked={false} /></ModalHeader>
      <div className="poll-close-dialog__body">
        <p className="login-dialog__eyebrow">ANOTAÇÕES</p>
        <h2 id="notes-save-title">{changed ? 'Sessão alterada' : failed ? 'Não foi possível salvar' : 'Salvando anotação'}</h2>
        <p className="poll-close-dialog__description">{changed ? 'A anotação não foi enviada para outra conta. Recarregue a página e autentique-se novamente.' : failed ? 'Seu texto continua na ficha. Tente novamente antes de sair.' : 'Aguarde o salvamento para continuar.'}</p>
        <div className="poll-close-dialog__actions">
          <button ref={cancelButton} className="action-link action-link--secondary" type="button" onClick={cancel}>Cancelar</button>
          {changed ? <button className="action-link" type="button" onClick={() => window.location.reload()}>Recarregar</button> : failed ? <button className="action-link" type="button" onClick={retry}>Tentar de novo</button> : <span role="status" className="notes-saving-spinner"><LoadingSpinner /></span>}
        </div>
      </div>
    </section>
  </div>
}

function LoadedNote({ actorId, note, registerGuard }: { actorId: string; note: MemberNote; registerGuard?: RegisterLeaveGuard }) {
  const autosave = useNoteAutosave(actorId, note.member.id, note.content, registerGuard)
  return <>
    <div className="section-heading notes-detail-heading">
      <div className="notes-heading"><Avatar name={note.member.name} /><h1 id="note-title">{note.member.name}</h1></div>
    </div>
    {autosave.status === 'session-changed' ? <p className="poll-error" role="alert">Sessão alterada. Recarregue a página e autentique-se novamente.</p> : <div className="poll-form notes-form"><Suspense fallback={<NoteEditorLoading />}><NoteRichEditor content={note.content} onChange={autosave.change} /></Suspense></div>}
    {autosave.leaveOpen && <SaveDialog status={autosave.status} cancel={autosave.cancelLeave} retry={autosave.retry} />}
  </>
}

function NoteEditor({ actorId, memberId, registerGuard }: { actorId: string; memberId: string; registerGuard?: RegisterLeaveGuard }) {
  const [note, setNote] = useState<MemberNote | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    getMemberNote(actorId, memberId, controller.signal).then(result => {
      if (!controller.signal.aborted) setNote(result)
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof ApiError && error.status === 409 ? 'Sessão alterada. Recarregue a página.' : 'Não foi possível carregar a anotação.') })
    return () => controller.abort()
  }, [actorId, memberId])
  return <section className="polls-page container" aria-labelledby={note ? "note-title" : undefined}>
    {note ? <LoadedNote actorId={actorId} note={note} registerGuard={registerGuard} /> : error ? <p className="poll-error" role="alert">{error}</p> : <NoteDetailLoading />}
  </section>
}

export function NotesPage({ memberId, base, user, restoring, onNavigate, onBrandVisibilityChange, registerGuard }: { memberId: string | null; base: string; user: AuthenticatedUser | null; restoring: boolean; onNavigate: (path: string) => void; onBrandVisibilityChange?: (visible: boolean) => void; registerGuard?: RegisterLeaveGuard }) {
  if (restoring) return memberId
    ? <section className="polls-page container"><NoteDetailLoading /></section>
    : <section className="polls-page polls-page--landing container"><div className="section-heading polls-landing-heading"><h1 className="polls-hero-title"><NotesBrand className="polls-hero-brand" linked={false} /></h1></div><NoteListLoading /></section>
  if (user?.member_type !== 'admin') return <section className="polls-page container"><p className="poll-error" role="alert">Área restrita.</p></section>
  return memberId ? <NoteEditor key={`${user.id}:${memberId}`} actorId={user.id} memberId={memberId} registerGuard={registerGuard} /> : <NoteList key={user.id} actorId={user.id} base={base} onNavigate={onNavigate} onBrandVisibilityChange={onBrandVisibilityChange} />
}
