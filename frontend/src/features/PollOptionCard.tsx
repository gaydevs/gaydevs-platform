import { OverflowMenu } from '../components/OverflowMenu'
import { LinkifiedText } from '../components/LinkifiedText'
import type { Poll, PollOption } from './pollsApi'
import { pollVoterSummary, voteLabel } from './pollPresentation'

function PollOptionAdminMenu({ option, onHide }: { option: PollOption; onHide: () => void }) {
  return <OverflowMenu label={`Ações da opção ${option.label}`} className="poll-option-admin-menu">
    {(close) => <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); close(); onHide() }}>ocultar</button>}
  </OverflowMenu>
}

export function PollOptionCard({ poll, option, barWidth, isNewOption, needsLogin, votePending, voteError, isSelected, optionRef, onToggle, onAnimationEnd, onHide }: { poll: Poll; option: PollOption; barWidth: number; isNewOption: boolean; needsLogin: boolean; votePending: boolean; voteError: boolean; isSelected: boolean; optionRef: (node: HTMLLabelElement | null) => void; onToggle: () => void; onAnimationEnd: () => void; onHide?: () => void }) {
  return <div className="poll-option-shell">
    <label className={`poll-option${isNewOption ? ' poll-option--new' : ''}${needsLogin ? ' poll-option--login-required' : ''}${votePending ? ' poll-option--vote-pending' : ''}${voteError ? ' poll-option--vote-error' : ''}`} ref={optionRef} aria-busy={votePending || undefined} onAnimationEnd={onAnimationEnd}><input type={poll.allow_multiple ? 'checkbox' : 'radio'} name="poll-option" checked={isSelected} disabled={poll.closed} onClick={(event) => { if (!poll.allow_multiple && isSelected) { event.preventDefault(); onToggle() } }} onChange={onToggle} /><span className="poll-option__content"><strong><LinkifiedText text={option.label} stopPropagation /></strong>{option.creator && <em> adicionada por {option.creator.name}</em>}<small>{option.percentage.toFixed(2)}% · {voteLabel(option.votes)}{option.voters ? pollVoterSummary(option) : ''}{option.anonymous_votes ? ` · ${option.anonymous_votes} voto(s) sem identificação` : ''}</small></span><span className="poll-option__meter" aria-hidden="true"><span style={{ width: `${barWidth}%` }} /></span>{votePending && <span className="poll-option__pending" role="status" aria-label="Salvando voto" />}</label>
    {onHide && <PollOptionAdminMenu option={option} onHide={onHide} />}
  </div>
}
