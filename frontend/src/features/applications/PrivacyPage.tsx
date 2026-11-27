import { useEffect, useState } from 'react'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { getTerms, type Terms } from './api'

export function PrivacyPage({home}: {home:string}) {
  const [terms,setTerms] = useState<Terms | null>(null)
  const [failed,setFailed] = useState(false)
  useEffect(()=>{
    let active = true
    getTerms().then(t=>{if(active)setTerms(t)}).catch(()=>{if(active)setFailed(true)})
    return ()=>{active=false}
  },[])
  useEffect(()=>{
    if(terms && window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
  },[terms])
  return <section className="container application-page"><article className="application-panel application-panel--wide">
    <h1>Privacidade</h1>
    {failed ? <p role="alert">Não foi possível carregar a política. Recarregue a página ou entre em contato com a administração pelo rodapé.</p> : !terms ? <div className="application-loading" role="status"><LoadingSpinner /><span>carregando…</span></div> : <>
      <p className="application-version"><strong>Versão:</strong> {terms.version}</p>
      {terms.privacy_sections?.map(s=><section key={s.id} id={s.id}><h2>{s.title}</h2><p>{s.text}</p></section>)}
      <section id="convivencia"><h2>Regras de convivência</h2>{terms.consents.filter(c=>['sfw','nsfw'].includes(c.key)).map(c=><p key={c.key}>{c.text}</p>)}</section>
      <section><h2>Autorizações</h2>{terms.consents.filter(c=>['personal_data','external_profiles'].includes(c.key)).map(c=><p key={c.key}>{c.text}</p>)}</section>
    </>}
  </article></section>
}
