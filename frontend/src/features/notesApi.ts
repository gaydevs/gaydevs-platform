import { request } from './auth/api'

export interface NoteMember { id: string; name: string; preview?: string }
export interface MemberNote { member: NoteMember; content: string }

export async function listNoteMembers(signal?: AbortSignal): Promise<NoteMember[]> {
  return (await request<{ members: NoteMember[] }>('notes', { signal, cache: 'no-store' })).members
}
export function getMemberNote(id: string, signal?: AbortSignal): Promise<MemberNote> {
  return request<MemberNote>(`notes/${encodeURIComponent(id)}`, { signal, cache: 'no-store' })
}
export function saveMemberNote(id: string, content: string): Promise<MemberNote> {
  return request<MemberNote>(`notes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ content }), cache: 'no-store' }, true)
}
