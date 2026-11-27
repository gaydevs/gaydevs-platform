import { useEffect, useState } from 'react'
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
    <a className="poll-inline-link" href={home}>← voltar ao gaydevs</a>
    <h1>Privacidade</h1>
    {failed ? <p role="alert">Não foi possível carregar a política. Recarregue a página ou entre em contato com a administração pelo rodapé.</p> : !terms ? <p role="status">carregando…</p> : <>
      <p>Versão: {terms.version}</p>
      {terms.privacy_sections?.map(s=><section key={s.id} id={s.id}><h2>{s.title}</h2><p>{s.text}</p></section>)}
      <section id="comunidade"><h2>Sobre a comunidade</h2>{terms.consents.filter(c=>['gay_dev','community','values'].includes(c.key)).map(c=><p key={c.key}>{c.text}</p>)}<a href={home.replace(/\/$/,'')+'/#sobre'}>Conheça a proposta do GayDevs</a></section>
      <section id="convivencia"><h2>Regras de convivência</h2>{terms.consents.filter(c=>['sfw','nsfw'].includes(c.key)).map(c=><p key={c.key}>{c.text}</p>)}</section>
      <section><h2>Autorizações</h2>{terms.consents.filter(c=>['personal_data','external_profiles'].includes(c.key)).map(c=><p key={c.key}>{c.text}</p>)}</section>
    </>}
    <a href="#contato" className="poll-inline-link">Falar com a administração</a>
  </article></section>
}
