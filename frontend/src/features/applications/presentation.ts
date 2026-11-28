import type { Fields, Session, Step } from './api'
export const steps: Step[] = ['identification', 'profiles', 'origin', 'terms', 'ready']
export const titles: Record<Step, string> = {identification: 'quem é você?', profiles: 'seus perfis', origin: 'como chegou até aqui?', terms: 'nossos combinados', ready: 'tudo pronto?'}
export const progress = (session: Session | null, challenge: boolean) => session?.status === 'pending' ? 100 : session?.status === 'draft' ? ({identification:45, profiles:60, origin:75, terms:85, ready:95, submitted:100}[session.current_step ?? 'identification']) : challenge ? 20 : 0
export const suggestions = ['App de relacionamento (Tinder, Scruff, Grindr etc.)','Rede social (Instagram, Facebook, TikTok etc.)','Amigos','Trabalho','Evento de tecnologia','Pesquisa na internet']
const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
export const matchingSuggestions = (value: string) => suggestions.filter(item => fold(item).includes(fold(value.trim())))
export const prefixes = {linkedin:'linkedin.com/in/', github:'github.com/', instagram:'instagram.com/'}
export function handleValue(network: keyof typeof prefixes, value: string): string {
  const clean = value.trim()
  const stripped = clean.replace(/^https:\/\//i, '').replace(/^www\./i, '')
  if (stripped.toLowerCase().startsWith(prefixes[network])) return stripped.slice(prefixes[network].length).replace(/\/$/, '')
  return clean.replace(/^@/, '')
}
export const emptyFields: Fields = {email:'', first_name:null, last_name:null, whatsapp:null, linkedin:null, github:null, instagram:null, referral_source:null, collaboration_interest:null, github_skip_confirmed:false}
export function platformRoute(path: string) {
  const base = path.match(/^(.*?)(?:\/polls(?:\/|$)|\/apply\/?$|\/admin\/applications(?:\/|$)|\/onboarding\/?$)/)?.[1] ?? path.replace(/\/$/, '')
  const relative = path.slice(base.length).replace(/^\/|\/$/g, '')
  return {base, relative, path: (segment: string) => (base || '') + '/' + segment}
}
