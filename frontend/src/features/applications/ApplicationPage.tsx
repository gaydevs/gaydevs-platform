import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { FieldControl } from '../../components/FieldControl'
import { ActionLink } from '../../components/ActionLink'
import { applicationBenefits, publicLinks, footer } from '../../data/site'
import { ApiError, messageForApiError, type OtpRequest } from '../auth/api'
import * as api from './api'
import { emptyFields, handleValue, matchingSuggestions, prefixes, progress, steps, titles } from './presentation'
import { Turnstile } from './Turnstile'
import type { Fields, Session, Step, Terms, Config } from './api'

export function ApplicationPage({home, onLogin, onMemberRefresh}: {home: string; onLogin: () => void; onMemberRefresh: () => Promise<unknown>}) {
  const [config, setConfig] = useState<Config | null>(null)
  const [terms, setTerms] = useState<Terms | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [fields, setFields] = useState<Fields>(emptyFields)
  const [step, setStep] = useState<Step>('identification')
  const [accepts, setAccepts] = useState<Record<string,string>>({})
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<OtpRequest | null>(null)
  const [token, setToken] = useState('')
  const [widgetKey, setWidgetKey] = useState(0)
  const [until, setUntil] = useState(0)
  const [clock, setClock] = useState(Date.now)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profileNotice, setProfileNotice] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string,string[]>>({})
  const [member, setMember] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const restore = useCallback((s: Session | null) => {
    setSession(s); setFields(s?.status==='draft' && s.fields ? {...s.fields, ...Object.fromEntries(Object.keys(prefixes).map(key=>[key,handleValue(key as keyof typeof prefixes,s.fields![key as keyof typeof prefixes]??'')]))} : emptyFields)
    setStep(s?.current_step && s.current_step !== 'submitted' ? s.current_step : 'identification')
    setAccepts(Object.fromEntries((s?.status==='draft' ? s.consents ?? [] : []).map(c => [c.consent_key,c.version])))
    setConfirmSkip(s?.fields?.github_skip_confirmed ?? false)
  }, [])
  const reload = useCallback(async () => {
    const [settings, texts, s] = await Promise.all([api.getConfig(), api.getTerms(), api.getCandidate()])
    setConfig(settings); setTerms(texts); restore(s)
  }, [restore])
  useEffect(() => { let active = true; Promise.all([api.getConfig(),api.getTerms(),api.getCandidate()]).then(([c,t,s]) => {
    if (active) {setConfig(c);setTerms(t);restore(s)}
  }).catch(e => {if(active)setError(messageForApiError(e))}).finally(() => {if(active)setLoading(false)})
    return () => {active=false}
  },[restore])
  useEffect(() => { const timer=window.setInterval(() => setClock(Date.now()),1000);return () => window.clearInterval(timer) },[])
  const hasChallenge = Boolean(challenge)
  useEffect(() => {heading.current?.focus()},[step,session?.status,hasChallenge])
  const update = (key: keyof Fields, value: string | boolean) => setFields(f => ({...f,[key]:value}))
  const captchaError = useCallback(() => setError('Não foi possível carregar a proteção antispam. Tente novamente.'),[])
  const run = async (task: () => Promise<void>) => {
    setBusy(true);setError('');setFieldErrors({})
    try {await task()}
    catch(e) {
      setError(messageForApiError(e))
      if(e instanceof ApiError) {
        setFieldErrors(e.errors ?? {})
        if(e.status===401) {restore(null);setChallenge(null);setCode('');setToken('');setWidgetKey(k=>k+1)}
        if(e.status===409) {try {await reload()} catch { /* preserve original error */ }}
      }
    } finally {setBusy(false)}
  }
  const requestCode = () => run(async () => {
    try {setChallenge(await api.issueCode(email,token,accepts.personal_data ?? ''));setCode('');setUntil(Date.now()+(config?.cooldown ?? 60)*1000)}
    finally {setToken('');setWidgetKey(k=>k+1)}
  })
  const verify = () => run(async () => {
    if(!challenge)return
    const result=await api.verifyCode(challenge.otp_request_id,code,accepts.personal_data ?? '')
    setCode('');setChallenge(null);setEmail('');setToken('')
    if(result.status==='member'){setMember(true);return}
    restore(await api.getCandidate());await onMemberRefresh()
  })
  const accepted = (key:string) => accepts[key]===terms?.version
  const homeHref = home.endsWith('/') ? home : `${home}/`
  const consent = (keys:string[], text:string, href?:string, linkText='ler detalhes') => <div key={keys.join(',')}><label className="application-check"><input type="checkbox" checked={keys.every(accepted)} required onChange={e=>setAccepts(a=>({...a,...Object.fromEntries(keys.map(key=>[key,e.target.checked ? terms!.version : '']))}))}/><span>{text}</span></label>{href && <a className="poll-inline-link" href={href}>{linkText}{href.startsWith('#privacy') ? '' : ' ↗'}</a>}</div>
  const privacyConsent = () => <label className="application-check"><input type="checkbox" checked={accepted('personal_data')} required onChange={e=>setAccepts(a=>({...a,personal_data:e.target.checked ? terms!.version : ''}))}/><span>Autorizo o tratamento dos meus dados pessoais conforme a <a className="poll-inline-link" href="#privacy">política de privacidade</a>.</span></label>
  const profileConsent = () => consent(['external_profiles'],'Autorizo a consulta e coleta de dados dos perfis informados.','#privacy','consulta de perfis')
  const save = () => run(async () => {
    if(!session || !terms)return
    const revision=session.revision!
    let payload:object = {revision}
    if(step==='identification')payload={revision,first_name:fields.first_name,last_name:fields.last_name,whatsapp:fields.whatsapp}
    if(step==='profiles')payload={revision,linkedin:handleValue('linkedin',fields.linkedin??''),github:handleValue('github',fields.github??''),instagram:handleValue('instagram',fields.instagram??''),github_skip_confirmed:confirmSkip,consents:accepts}
    if(step==='origin')payload={revision,referral_source:fields.referral_source,collaboration_interest:fields.collaboration_interest}
    if(step==='terms')payload={revision,consents:accepts}
    if(step==='ready') {const result=await api.submitApplication(revision);setSession(s=>({...s,...result}));setFields(emptyFields);setAccepts({});return}
    const result=await api.saveStep(step,payload)
    if(step==='profiles')setProfileNotice(Object.values(result.profile_checks??{}).includes('inconclusive') ? 'Alguns perfis não puderam ser confirmados automaticamente. Você pode continuar.' : '')
    setSession(s=>({...s,...result}));if(result.fields)setFields({...result.fields,...Object.fromEntries(Object.keys(prefixes).map(key=>[key,handleValue(key as keyof typeof prefixes,result.fields![key as keyof typeof prefixes]??'')]))})
    setStep(steps[steps.indexOf(step)+1])
  })
  const input = (key: keyof Fields, label:string, type='text', required=true) => <label className="application-field">{label}<FieldControl name={key} type={type} required={required} value={String(fields[key]??'')} onChange={e=>update(key,e.target.value)} aria-invalid={Boolean(fieldErrors[key])}/>{fieldErrors[key]?.map(m=><small className="application-error" key={m}>{m}</small>)}</label>
  const social = (network:keyof typeof prefixes,label:string,required=false) => <label className="application-field">{label}<span className="application-prefix"><span>{prefixes[network]}</span><FieldControl name={network} required={required} value={fields[network]??''} onChange={e=>{update(network,e.target.value);if(network==='github')setConfirmSkip(false)}} onBlur={e=>update(network,handleValue(network,e.target.value))} onPaste={e=>{e.preventDefault();update(network,handleValue(network,e.clipboardData.getData('text')));if(network==='github')setConfirmSkip(false)}} aria-invalid={Boolean(fieldErrors[network])}/></span>{fieldErrors[network]?.map(m=><small className="application-error" key={m}>{m}</small>)}</label>
  const percent=progress(session,Boolean(challenge))
  const remaining=Math.max(0,Math.ceil((until-clock)/1000))
  const headingText = member || session?.status==='approved' ? 'já é gdev?' : session?.status==='rejected' ? 'candidatura encerrada' : session?.status==='pending' ? 'candidatura enviada!' : session?.status==='draft' ? titles[step] : challenge ? 'confirme seu e-mail' : 'quero ser um gdev'
  const form = (e: FormEvent) => {e.preventDefault();void (session?.status==='draft'? save():challenge?verify():requestCode())}
  return <section className="container application-page"><div className="application-panel">
    <a className="poll-inline-link" href={homeHref}>← voltar ao gaydevs</a>
    <p className="polls-eyebrow">/gdevs/apply</p><h1 ref={heading} tabIndex={-1}>{headingText}</h1>
    {(session?.status === 'draft' || session?.status === 'pending') && <div className="application-progress"><progress aria-label="progresso da candidatura" max={100} value={percent}/><span>{percent}%</span></div>}
    {loading ? <p role="status">carregando…</p> : <>
    {profileNotice && session?.status==='draft' && <p role="status">{profileNotice}</p>}
    {error && <p role="alert" className="login-error">{error}</p>}
    {member || session?.status==='approved' ? <><p>Entre com o login de membro para acessar a plataforma.</p><button className="action-link" onClick={onLogin}>entrar</button></> :
    session?.status==='rejected' ? <><p>Você pode iniciar uma nova candidatura confirmando seu e-mail.</p><button className="action-link" onClick={()=>void run(async()=>{await api.exitCandidate();restore(null)})}>nova candidatura</button></> :
    session?.status==='pending' ? <p>Aguarde a avaliação da administração. Chame o scrum master pelo WhatsApp para conversar sobre seu ingresso.</p> :
    !config?.enabled || !terms ? <><p>Cadastro temporariamente indisponível.</p><button className="action-link action-link--secondary" onClick={()=>void run(reload)}>tentar novamente</button></> :
    session?.status==='draft' && !session.consents?.some(c=>c.consent_key==='personal_data' && c.version===terms.version) ? <><p>Confirme novamente seu e-mail para aceitar a versão atual da política de privacidade.</p><button className="action-link" onClick={()=>void run(async()=>{await api.exitCandidate();restore(null);setChallenge(null);setToken('')})}>confirmar e-mail novamente</button></> :
    <form className="application-form" onSubmit={form}>
      <fieldset disabled={busy} className="application-fieldset">
      {!session ? <>
        {!challenge ? <><div className="application-intro"><p>Entre para uma comunidade de gays e devs. <a href={homeHref}>Conheça nossa proposta.</a></p>
          <ul className="application-benefits">{applicationBenefits.map(benefit=><li key={benefit}>{benefit}</li>)}</ul></div>
        <label className="application-field">E-mail<FieldControl type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
        {privacyConsent()}</> :
        <><p>Enviamos um código para seu e-mail. Ele expira em 10 minutos.</p><label className="application-field">Código de confirmação<FieldControl required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label></>}
        {(!challenge || remaining===0) && config.sitekey && <Turnstile key={widgetKey} sitekey={config.sitekey} action={config.action??'application_otp'} onToken={setToken} onError={captchaError}/>}
        {challenge && <><button type="button" className="action-link action-link--secondary" disabled={remaining>0||!token} onClick={()=>void requestCode()}>{remaining>0?`reenviar em ${remaining}s`:'reenviar código'}</button><button type="button" className="application-text-button" onClick={()=>{setChallenge(null);setCode('');setToken('');setWidgetKey(k=>k+1)}}>alterar e-mail</button></>}
      </> : <>
        {step==='identification' && <>{input('first_name','Nome')}{input('last_name','Sobrenome')}{input('whatsapp','WhatsApp com DDD','tel')}</>}
        {step==='profiles' && <>{social('linkedin','LinkedIn *',true)}{social('github','GitHub')}{!fields.github && <label className="application-check"><input type="checkbox" checked={confirmSkip} required onChange={e=>setConfirmSkip(e.target.checked)}/><span>O GitHub ajuda os gdevs a conhecer seus projetos. Confirmo que quero continuar sem ele.</span></label>}{social('instagram','Instagram')}{profileConsent()}</>}
        {step==='origin' && <><label className="application-field">Como conheceu o gaydevs?<FieldControl required maxLength={255} value={fields.referral_source??''} onFocus={()=>setSuggestOpen(true)} onChange={e=>{update('referral_source',e.target.value);setSuggestOpen(true)}}/></label>{suggestOpen && <div className="application-suggestions" aria-label="sugestões de origem">{matchingSuggestions(fields.referral_source??'').map(s=><button type="button" key={s} onClick={()=>{update('referral_source',s);setSuggestOpen(false)}}>{s}</button>)}</div>}<p>Escolha uma sugestão ou escreva sua própria resposta.</p><fieldset className="application-fieldset"><legend>Quer colaborar com a plataforma?</legend>{[true,false].map(v=><label className="application-check" key={String(v)}><input required type="radio" name="collaboration" checked={fields.collaboration_interest===v} onChange={()=>update('collaboration_interest',v)}/>{v?'Sim':'Não'}</label>)}</fieldset></>}
        {step==='terms' && <><p>Acompanhe a comunidade e o scrum master:</p><div className="application-actions">{[...publicLinks,...footer.authorLinks].map(l=><ActionLink key={l.href} link={l} secondary/>)}</div>{consent(['gay_dev'],'Sou gay e trabalho ou estudo desenvolvimento de software.')}{consent(['community','values'],'Conheço a proposta e os valores da comunidade.',homeHref+'#sobre','sobre a comunidade')}{consent(['sfw','nsfw'],'Aceito as regras dos grupos SFW e NSFW.','#privacy','regras de convivência')}{privacyConsent()}{profileConsent()}</>}
        {step==='ready' && <p>Revise os dados se necessário. Ao enviar, sua candidatura ficará disponível para avaliação da administração.</p>}
      </>}
      <div className="application-actions">
        {session && steps.indexOf(step)>0 && <button type="button" className="action-link action-link--secondary" onClick={()=>{setFieldErrors({});setError('');setStep(steps[steps.indexOf(step)-1])}}>voltar</button>}
        <button className="action-link" type="submit" disabled={busy||(!session&&!challenge&&(!token||!accepted('personal_data')))||(!session&&Boolean(challenge)&&code.length!==6)}>{busy?'aguarde…':session?step==='ready'?'enviar candidatura':'continuar':challenge?'confirmar código':'enviar código'}</button>
      </div></fieldset>
    </form>}
    {session?.whatsapp_url && ['draft','pending'].includes(session.status) && <ActionLink link={{label:'falar com o scrum master',href:session.whatsapp_url}} secondary/>}
    {session && <button type="button" className="application-text-button" onClick={()=>void run(async()=>{await api.exitCandidate();restore(null);setChallenge(null);setToken('')})}>sair da candidatura</button>}
    </>}
  </div></section>
}
