export function NoteListLoading() {
  return <div className="poll-list notes-list notes-list-loading" role="status" aria-busy="true" aria-label="Carregando gdevs">
    {[0, 1, 2].map(index => <div className="poll-card notes-card poll-loading-card" key={index} aria-hidden="true">
      <span className="notes-avatar notes-loading-avatar poll-loading__shine" />
      <span className="notes-card__body notes-loading-body">
        <span className="notes-card__name notes-loading-name"><span className="poll-loading__shine" /></span>
        {index !== 1 && <span className="notes-loading-preview poll-loading__shine" />}
      </span>
    </div>)}
  </div>
}

export function NoteEditorLoading() {
  return <div className="notes-editor notes-editor-loading" role="status" aria-busy="true" aria-label="Carregando editor">
    <div className="notes-editor-content" aria-hidden="true">
      {[0, 1, 2].map(index => <span className="notes-loading-line poll-loading__shine" key={index} />)}
    </div>
  </div>
}

export function NoteDetailLoading() {
  return <div className="notes-detail-loading" role="status" aria-busy="true" aria-label="Carregando anotação">
    <div className="section-heading notes-detail-heading" aria-hidden="true">
      <div className="notes-heading">
        <span className="notes-avatar notes-loading-avatar poll-loading__shine" />
        <span className="notes-loading-detail-name poll-loading__shine" />
      </div>
    </div>
    <div className="poll-form notes-form"><NoteEditorLoading /></div>
  </div>
}
