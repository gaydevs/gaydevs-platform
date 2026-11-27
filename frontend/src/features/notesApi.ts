import { request } from './auth/api'

export interface NoteMember { id: string; name: string; preview?: string }
export interface MemberNote { member: NoteMember; content: string }

export async function listNoteMembers(actorId: string, signal?: AbortSignal): Promise<NoteMember[]> {
  return (await request<{ members: NoteMember[] }>('notes', { signal, headers: { 'X-Notes-Actor': actorId }, cache: 'no-store' })).members
}
export function getMemberNote(actorId: string, id: string, signal?: AbortSignal): Promise<MemberNote> {
  return request<MemberNote>(`notes/${encodeURIComponent(id)}`, { signal, headers: { 'X-Notes-Actor': actorId }, cache: 'no-store' })
}
export function saveMemberNote(actorId: string, id: string, content: string, signal?: AbortSignal): Promise<MemberNote> {
  return request<MemberNote>(`notes/${encodeURIComponent(id)}`, { signal, headers: { 'X-Notes-Actor': actorId }, method: 'PUT', body: JSON.stringify({ content }), cache: 'no-store' }, true)
}
