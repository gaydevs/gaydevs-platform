export interface NoteMember { id: string; name: string; preview?: string }
export interface MemberNote { member: NoteMember; content: string; version: number }

export function isMemberNote(value: unknown, id: string): value is MemberNote {
  if (!value || typeof value !== 'object') return false
  const note = value as Partial<MemberNote>
  return note.member?.id === id && typeof note.member.name === 'string'
    && typeof note.content === 'string' && typeof note.version === 'number'
    && Number.isSafeInteger(note.version) && note.version >= 0
    && (note.version !== 0 || note.content === '')
}

export class NoteVersionConflict extends Error {
  constructor(public readonly note: MemberNote) {
    super('A anotação foi alterada em outra gravação.')
    this.name = 'NoteVersionConflict'
  }
}
