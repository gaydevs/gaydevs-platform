import { useEffect, useState } from 'react'
import { community } from '../../data/community'
import { events } from '../../data/events'
import { messageForApiError, type AuthenticatedUser } from '../auth/api'
import { markOnboardingSeen } from './api'
export function OnboardingPage({user,restoring,onLogin,onDone}:{user:AuthenticatedUser|null;restoring:boolean;onLogin:()=>void;onDone:()=>Promise<void>}) {
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const eligible = Boolean(user?.onboarding_eligible)
  const userId = user?.id
  useEffect(() => {
    if (!eligible || !userId || restoring) return
    let active = true
    markOnboardingSeen().catch(e => { if (active) setError(messageForApiError(e)) })
    return () => { active = false }
  }, [eligible, userId, restoring])
  return <section className="container application-page"><div className="application-panel"><p className="polls-eyebrow">/gdevs/onboarding</p><h1>boas-vindas, gdev!</h1>
  {restoring?<p>carregando…</p>:!user?<button className="action-link" onClick={onLogin}>entrar</button>:!user.onboarding_eligible?<p>Onboarding disponível para membros admitidos pelo novo fluxo.</p>:<>
    <h2>primeiro, /gdevs</h2><p>Combine a inclusão manual no grupo principal SFW com o scrum master. Apresente-se: como conheceu o gaydevs, stack, experiência, desafios atuais e seus perfis de LinkedIn, Instagram e GitHub.</p>
    <h2>nossos espaços</h2>{community.map(c=><article key={c.path} className="application-space"><strong>{c.path}</strong><p>{c.label} · {c.description}</p>{c.path.includes('nsfw')&&<p>Único grupo NSFW, opcional. Conteúdo adulto e flerte ficam restritos a esse espaço.</p>}</article>)}
    <h2>iniciativas</h2>{events.map(e=><article key={e.id}><strong>{e.title}</strong><p>{e.paragraphs.join(' ')}</p></article>)}
    {error&&<p role="alert" className="login-error">{error}</p>}
    <button disabled={busy} className="action-link" onClick={async()=>{setBusy(true);setError('');try{await markOnboardingSeen();await onDone()}catch(e){setError(messageForApiError(e))}finally{setBusy(false)}}}>concluir onboarding</button>
  </>}</div></section>
}
