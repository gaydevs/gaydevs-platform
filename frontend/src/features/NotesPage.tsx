import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { SectionAuthGate } from '../components/SectionAuthGate'
import { SectionSubmenuBar } from '../components/SectionSubmenuBar'
import { NotesBrand } from '../components/NotesBrand'
import { RestrictedAccessDialog } from '../components/RestrictedAccessDialog'
import { PendingSaveDialog } from '../components/PendingSaveDialog'
import { useSectionBrandVisibility } from '../components/useSectionBrandVisibility'
import { ApiError, type AuthenticatedUser } from './auth/api'
import { getMemberNote, type MemberNote } from './notesApi'
import { NoteListLoading, NoteDetailLoading, NoteEditorLoading } from './NotesLoadingStates'
import { useNoteList } from './useNoteList'
import { useNoteAutosave, type RegisterLeaveGuard } from './useNoteAutosave'

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

function NoteList({ actorId, base, onNavigate, onBrandVisibilityChange, onHome }: { actorId: string; base: string; onHome: () => void; onNavigate: (path: string) => void; onBrandVisibilityChange?: (visible: boolean) => void }) {
  const { members, error, restricted } = useNoteList(actorId)
  const brand = useRef<HTMLImageElement>(null)
  useSectionBrandVisibility({ brandRef: brand, onVisibilityChange: onBrandVisibilityChange })
  if (restricted) return <RestrictedView memberId={null} onHome={onHome} />
  return <section className="polls-page polls-page--landing container" aria-labelledby="notes-title">
    <div className="section-heading polls-landing-heading"><h1 className="polls-hero-title" id="notes-title"><NotesBrand className="polls-hero-brand" linked={false} iconRef={brand} /></h1></div>
    {error ? <p className="poll-error" role="alert">{error}</p> : members === null ? <NoteListLoading /> : members.length === 0 ? <p className="poll-empty">Nenhum gdev encontrado.</p> :
      <div className="poll-list notes-list">{members.map(member => <button key={member.id} className="poll-card notes-card" type="button" onClick={() => onNavigate(`${base}/${member.id}`)}><Avatar name={member.name} /><span className="notes-card__body"><span className="notes-card__name">{member.name}</span>{member.preview?.trim() && <span className="notes-card__preview">{member.preview}</span>}</span></button>)}</div>}
  </section>
}

function LoadedNote({ actorId, note, registerGuard }: { actorId: string; note: MemberNote; registerGuard?: RegisterLeaveGuard }) {
  const autosave = useNoteAutosave(actorId, note.member.id, note.content, registerGuard)
  return <>
    <div className="section-heading notes-detail-heading">
      <div className="notes-heading"><Avatar name={note.member.name} /><h1 id="note-title">{note.member.name}</h1></div>
    </div>
    {autosave.status === 'session-changed' ? <p className="poll-error" role="alert">Sessão alterada. Recarregue a página e autentique-se novamente.</p> : <div className="poll-form notes-form"><Suspense fallback={<NoteEditorLoading />}><NoteRichEditor content={note.content} onChange={autosave.change} /></Suspense></div>}
    {autosave.leaveOpen && <PendingSaveDialog
      brand={<NotesBrand wordmark="/gdevs/notes" linked={false} />}
      eyebrow="ANOTAÇÕES"
      status={autosave.status}
      savingTitle="Salvando anotação"
      sessionDescription="A anotação não foi enviada para outra conta. Recarregue a página e autentique-se novamente."
      onCancel={autosave.cancelLeave}
      onIgnore={autosave.ignoreLeave}
      onRetry={autosave.retry}
      onReload={() => window.location.reload()}
    />}
  </>
}

function NoteEditor({ actorId, memberId, registerGuard, onHome }: { actorId: string; memberId: string; registerGuard?: RegisterLeaveGuard; onHome: () => void }) {
  const [note, setNote] = useState<MemberNote | null>(null)
  const [error, setError] = useState('')
  const [restricted, setRestricted] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    getMemberNote(actorId, memberId, controller.signal).then(result => {
      if (!controller.signal.aborted) setNote(result)
    }).catch(error => {
      if (controller.signal.aborted) return
      if (error instanceof ApiError && error.status === 403) setRestricted(true)
      else setError(error instanceof ApiError && error.status === 409 ? 'Sessão alterada. Recarregue a página.' : 'Não foi possível carregar a anotação.')
    })
    return () => controller.abort()
  }, [actorId, memberId])
  if (restricted) return <RestrictedView memberId={memberId} onHome={onHome} />
  return <section className="polls-page container" aria-labelledby={note ? "note-title" : undefined}>
    {note ? <LoadedNote actorId={actorId} note={note} registerGuard={registerGuard} /> : error ? <p className="poll-error" role="alert">{error}</p> : <NoteDetailLoading />}
  </section>
}

function NotesSkeleton({ memberId }: { memberId: string | null }) {
  return memberId
    ? <section className="polls-page container"><NoteDetailLoading /></section>
    : <section className="polls-page polls-page--landing container"><div className="section-heading polls-landing-heading"><h1 className="polls-hero-title"><NotesBrand className="polls-hero-brand" linked={false} /></h1></div><NoteListLoading /></section>
}

function RestrictedView({ memberId, onHome, loginOpen = false }: { memberId: string | null; onHome: () => void; loginOpen?: boolean }) {
  return <><NotesSkeleton memberId={memberId} />{!loginOpen && <RestrictedAccessDialog brand={<NotesBrand linked={false} />} eyebrow="ANOTAÇÕES" description="Esta área é exclusiva para administradores." onHome={onHome} />}</>
}

export function NotesPage({ memberId, base, user, restoring, onLogin, loginOpen = false, onNavigate, onBrandVisibilityChange, registerGuard }: { memberId: string | null; base: string; user: AuthenticatedUser | null; restoring: boolean; onLogin?: () => void; loginOpen?: boolean; onNavigate: (path: string) => void; onBrandVisibilityChange?: (visible: boolean) => void; registerGuard?: RegisterLeaveGuard }) {
  const skeleton = <NotesSkeleton memberId={memberId} />
  const onHome = () => onNavigate(base.slice(0, -'/notes'.length) || '/')
  if (restoring) return skeleton
  if (!user) return <SectionAuthGate mode="required" authenticated={false} restoring={false} fallback={skeleton} onRequireLogin={onLogin}>{null}</SectionAuthGate>
  if (user.member_type !== 'admin') return <RestrictedView memberId={memberId} onHome={onHome} loginOpen={loginOpen} />
  return memberId ? <NoteEditor key={`${user.id}:${memberId}`} actorId={user.id} memberId={memberId} registerGuard={registerGuard} onHome={onHome} /> : <NoteList key={user.id} actorId={user.id} base={base} onNavigate={onNavigate} onBrandVisibilityChange={onBrandVisibilityChange} onHome={onHome} />
}
