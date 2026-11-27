import { useEffect, useState } from 'react'
import { ActionLink } from '../../components/ActionLink'
import { messageForApiError, type AuthenticatedUser } from '../auth/api'
import * as api from './api'
import type { Detail, Page } from './api'
const labels: Record<string,string> = {email:'E-mail',first_name:'Nome',last_name:'Sobrenome',whatsapp:'WhatsApp',linkedin:'LinkedIn',github:'GitHub',instagram:'Instagram',referral_source:'Origem',collaboration_interest:'Interesse em colaboração',github_skip_confirmed:'Confirmou ausência de GitHub'}
export function AdminApplications({id,user,restoring,base,onNavigate,onLogin}:{id?:string;user:AuthenticatedUser|null;restoring:boolean;base:string;onNavigate:(p:string)=>void;onLogin:()=>void}) {
  const [page,setPage]=useState(1)
  const [list,setList]=useState<Page|null>(null)
  const [detail,setDetail]=useState<Detail|null>(null)
  const [notes,setNotes]=useState('')
  const [decision,setDecision]=useState<'approve'|'reject'|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [reload,setReload]=useState(0)
  const allowed=user?.member_type==='admin'
  useEffect(()=>{if(!allowed)return;let active=true
    const task=id?api.getApplication(id).then(d=>{if(active){setDetail(d);setNotes(d.admin_notes??'')}}):api.listApplications(page).then(d=>{if(active)setList(d)})
    task.catch(e=>{if(active)setError(messageForApiError(e))})
    return()=>{active=false}
  },[id,page,allowed,reload])
  const run=async(task:()=>Promise<void>)=>{setBusy(true);setError('');try{await task()}catch(e){setError(messageForApiError(e))}finally{setBusy(false)}}
  const current=detail?.id===id?detail:null
  return <section className="container application-page"><div className="application-panel application-panel--wide"><p className="polls-eyebrow">/admin/applications</p><h1>{id?'análise de candidatura':'candidaturas pendentes'}</h1>
  {restoring?<p role="status">carregando…</p>:!allowed?<><p>Acesso exclusivo para admins ativos.</p>{!user&&<button className="action-link" onClick={onLogin}>entrar</button>}</>:<>
  {error&&<><p role="alert" className="login-error">{error}</p><button className="application-text-button" onClick={()=>{setError('');setReload(v=>v+1)}}>tentar novamente</button></>}
  {id?<><button className="application-text-button" onClick={()=>onNavigate(base)}>← voltar à fila</button>
    {!current?<p role="status">{error?'Não foi possível carregar a candidatura.':'carregando candidatura…'}</p>:<>
      <p className="polls-eyebrow">{current.status}</p>
      <dl className="application-data">{Object.entries(current.fields).map(([k,v])=><div key={k}><dt>{labels[k]??k}</dt><dd>{typeof v==='boolean'?(v?'Sim':'Não'):v??'—'}{typeof v==='string'&&['linkedin','github','instagram'].includes(k)&&v.startsWith('https://')&&<> · <a href={v} target="_blank" rel="noopener noreferrer">abrir perfil</a></>}</dd></div>)}</dl>
      {current.whatsapp_url&&<ActionLink link={{label:'abrir WhatsApp',href:current.whatsapp_url}} secondary/>}
      <h2>aceites</h2><ul>{current.consents.map(c=><li key={c.consent_key+c.version}>{c.consent_key} · {c.version} · {new Date(c.accepted_at).toLocaleString('pt-BR')}</li>)}</ul>
      <p>Notificação: {current.notification_status??'—'} · Submetida: {new Date(current.submitted_at).toLocaleString('pt-BR')}</p>
      {current.reviewed_at&&<p>Decisão: {new Date(current.reviewed_at).toLocaleString('pt-BR')} · {current.reviewed_by}</p>}
      <label className="application-field">Observações internas<textarea maxLength={10000} disabled={busy||current.status!=='pending'} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      {current.status==='pending'&&<><button className="action-link action-link--secondary" disabled={busy} onClick={()=>void run(async()=>setDetail(await api.saveNotes(id,current.revision,notes)))}>salvar observações</button>
      {!decision?<div className="application-actions"><button className="action-link" disabled={busy} onClick={()=>setDecision('approve')}>aprovar</button><button className="action-link action-link--secondary" disabled={busy} onClick={()=>setDecision('reject')}>recusar</button></div>:<div role="group" aria-label="confirmar decisão"><p>Confirma {decision==='approve'?'aprovar e criar o membro ativo':'recusar a candidatura'}?</p><div className="application-actions"><button className="action-link" disabled={busy} onClick={()=>void run(async()=>{await api.decideApplication(id,decision);setDecision(null);setDetail(await api.getApplication(id))})}>confirmar decisão</button><button className="action-link action-link--secondary" disabled={busy} onClick={()=>setDecision(null)}>cancelar</button></div></div>}</>}
    </>}</>:!list || list.current_page!==page?<p role="status">{error?'Não foi possível carregar a fila.':'carregando fila…'}</p>:<>{list.data.length===0?<p>Nenhuma candidatura pendente.</p>:<div className="poll-list">{list.data.map(a=><button key={a.id} className="poll-card application-list-item" onClick={()=>onNavigate(base+'/'+a.id)}><strong>{a.first_name} {a.last_name}</strong><p>{new Date(a.submitted_at).toLocaleString('pt-BR')}</p></button>)}</div>}<div className="application-actions"><button className="action-link action-link--secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>anterior</button><span>Página {page} de {list.last_page}</span><button className="action-link action-link--secondary" disabled={page>=list.last_page} onClick={()=>setPage(p=>p+1)}>próxima</button></div></>}
  </>}</div></section>
}
