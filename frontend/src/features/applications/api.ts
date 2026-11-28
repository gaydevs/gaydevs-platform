import { request, ApiError } from '../auth/api'
import type { OtpRequest } from '../auth/api'

export type Step = 'identification' | 'profiles' | 'origin' | 'terms' | 'ready'
export type Status = 'draft' | 'pending' | 'approved' | 'rejected'
export interface Fields {
  email: string; first_name: string | null; last_name: string | null; whatsapp: string | null
  linkedin: string | null; github: string | null; instagram: string | null; referral_source: string | null
  collaboration_interest: boolean | null; github_skip_confirmed: boolean
}
export interface Consent { consent_key: string; version: string; accepted_at: string }
export interface Terms { version: string; privacy_notice: string; privacy_sections?: {id:string; title:string; text:string}[]; consents: {key: string; version: string; text: string}[] }
export interface Config { enabled: boolean; sitekey?: string; action?: string; cooldown?: number }
export interface Session { status: Status; current_step?: Step | 'submitted'; revision?: number; fields?: Fields; whatsapp_url?: string; consents?: Consent[]; terms_version?: string; profile_checks?: Record<string, 'valid' | 'invalid' | 'inconclusive'> }
export interface Summary { id: string; first_name: string; last_name: string; submitted_at: string; status: Status }
export interface Detail extends Summary { revision: number; fields: Fields; consents: Consent[]; admin_notes: string | null; whatsapp_url: string | null; reviewed_at: string | null; reviewed_by: string | null; notification_status: string | null }
export interface Page { data: Summary[]; current_page: number; last_page: number }
const change = <T>(path: string, body: object, method = 'POST') => request<T>(path, {method, body: JSON.stringify(body)}, true)
export const getConfig = () => request<Config>('applications/config')
export const getTerms = () => request<Terms>('applications/terms')
export async function getCandidate(): Promise<Session | null> {
  try { return await request<Session>('applications/session') }
  catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e }
}
export const issueCode = (email: string, token: string, version: string) => change<OtpRequest>('applications/otp', {email, turnstile_token: token, consents:{personal_data:version}})
export const verifyCode = (id: string, code: string, version: string) => change<{status: Status | 'member'}>('applications/verify', {otp_request_id: id, code, consents:{personal_data:version}})
export const saveStep = (step: Step, data: object) => change<Session>('applications/steps/' + step, data, 'PATCH')
export const submitApplication = (revision: number) => change<Session>('applications/submit', {revision})
export const exitCandidate = () => change<void>('applications/logout', {})
export const listApplications = (page: number) => request<Page>('admin/applications?page=' + page)
export const getApplication = (id: string) => request<Detail>('admin/applications/' + encodeURIComponent(id))
export const saveNotes = (id: string, revision: number, admin_notes: string) => change<Detail>('admin/applications/' + encodeURIComponent(id) + '/notes', {revision, admin_notes}, 'PATCH')
export const decideApplication = (id: string, decision: 'approve' | 'reject') => change<{status: Status}>('admin/applications/' + encodeURIComponent(id) + '/' + decision, {})
export const markOnboardingSeen = () => change<void>('me/onboarding/seen', {})
