import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { BrandLogo } from '../../components/BrandLogo'
import { ModalHeader } from '../../components/ModalHeader'
import { getTerms, type Terms } from './api'

export function PrivacyPage({onClose}: {onClose: () => void}) {
  const [terms,setTerms] = useState<Terms | null>(null)
  const [failed,setFailed] = useState(false)
  const [closing,setClosing] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const closeDialog = useCallback(() => {
    if (closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 220)
  },[closing,onClose])
  useEffect(()=>{
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if(event.key==='Escape') closeDialog() }
    window.addEventListener('keydown',closeOnEscape)
    return ()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',closeOnEscape)}
  },[closeDialog])
  useEffect(()=>()=>{if(closeTimer.current!==null)window.clearTimeout(closeTimer.current)},[])
  useEffect(()=>{
    let active = true
    getTerms().then(t=>{if(active)setTerms(t)}).catch(()=>{if(active)setFailed(true)})
    return ()=>{active=false}
  },[])
  useEffect(()=>{
    if(terms && window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
  },[terms])
  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => { if(event.target===event.currentTarget)closeDialog() }
  return <div className={`login-overlay${closing?' login-overlay--closing':''}`} role="presentation" onMouseDown={closeFromBackdrop}><section className={`login-dialog poll-audit-dialog privacy-dialog${!terms?' privacy-dialog--loading':''}${closing?' login-dialog--closing':''}`} role="dialog" aria-modal="true" aria-labelledby="privacy-title">
    <ModalHeader closeLabel="fechar política de privacidade" onClose={closeDialog}><BrandLogo wordmark="/gdevs/privacy" suffix="" linked={false} /></ModalHeader>
    <div className="poll-audit-dialog__body">
    <h2 id="privacy-title">Privacidade</h2>
    {failed ? <p role="alert">Não foi possível carregar a política. Recarregue a página ou entre em contato com a administração pelo rodapé.</p> : !terms ? <div className="privacy-loading" role="status" aria-busy="true"><span className="sr-only">Carregando política de privacidade…</span>{[0,1,2,3,4].map(section=><div className="privacy-loading__section" aria-hidden="true" key={section}>{section===0&&<span className="poll-loading__shine privacy-loading__version"/>}<span className="poll-loading__shine privacy-loading__heading"/><span className="poll-loading__shine privacy-loading__line"/><span className="poll-loading__shine privacy-loading__line"/><span className="poll-loading__shine privacy-loading__line"/><span className="poll-loading__shine privacy-loading__line privacy-loading__line--short"/></div>)}</div> : <>
      <p className="application-version"><strong>Versão:</strong> {terms.version}</p>
      {terms.privacy_sections?.map(s=><section key={s.id} id={s.id}><h2>{s.title}</h2><p>{s.text}</p></section>)}
      <section id="convivencia"><h2>Regras de convivência</h2>{terms.consents.filter(c=>['sfw','nsfw'].includes(c.key)).map(c=><p key={c.key}>{c.text}</p>)}</section>
      <section><h2>Autorizações</h2>{terms.consents.filter(c=>['personal_data','external_profiles'].includes(c.key)).map(c=><p key={c.key}>{c.text}</p>)}</section>
    </>}
  </div></section></div>
}
