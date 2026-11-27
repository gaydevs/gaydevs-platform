import { ApiError, request } from './auth/api'
import { isMemberNote, NoteVersionConflict, type MemberNote, type NoteMember } from './noteVersion'
export type { MemberNote, NoteMember } from './noteVersion'

export async function listNoteMembers(actorId: string, signal?: AbortSignal): Promise<NoteMember[]> {
  return (await request<{ members: NoteMember[] }>('notes', { signal, headers: { 'X-Notes-Actor': actorId }, cache: 'no-store' })).members
}
function checkedNote(value: unknown, id: string): MemberNote {
  if (!isMemberNote(value, id)) throw new Error('Resposta de anotação inválida.')
  return value
}
export async function getMemberNote(actorId: string, id: string, signal?: AbortSignal): Promise<MemberNote> {
  return checkedNote(await request<unknown>(`notes/${encodeURIComponent(id)}`, { signal, headers: { 'X-Notes-Actor': actorId }, cache: 'no-store' }), id)
}
export async function saveMemberNote(actorId: string, id: string, content: string, expectedVersion: number, signal?: AbortSignal): Promise<MemberNote> {
  const result = checkedNote(await request<unknown>(`notes/${encodeURIComponent(id)}`, { signal, headers: { 'X-Notes-Actor': actorId }, method: 'PUT', body: JSON.stringify({ content, expected_version: expectedVersion }), cache: 'no-store' }, true, (status, body) => {
    if (status !== 409 || !body || typeof body !== 'object' || !('reason' in body) || body.reason !== 'note_version_conflict') return
    if ('note' in body && isMemberNote(body.note, id) && body.note.version !== expectedVersion) return new NoteVersionConflict(body.note)
    return new ApiError('Resposta de conflito inválida.', 409)
  }), id)
  if (result.version !== expectedVersion + 1 || result.content !== content) throw new Error('Revisão de anotação inválida.')
  return result
}
