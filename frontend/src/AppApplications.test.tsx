// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { useAuth } from './features/auth/useAuth'
import { useLoginHash } from './features/auth/useLoginHash'
import * as api from './features/applications/api'
vi.mock('./features/auth/useAuth',()=>({useAuth:vi.fn()}))
vi.mock('./features/auth/useLoginHash',()=>({useLoginHash:vi.fn()}))
vi.mock('./features/applications/api',()=>({getConfig:vi.fn(),getTerms:vi.fn(),getCandidate:vi.fn(),listApplications:vi.fn(),markOnboardingSeen:vi.fn()}))
beforeEach(()=>{
  vi.spyOn(window,'scrollTo').mockImplementation(()=>undefined)
  vi.mocked(useAuth).mockReturnValue({user:null,restoring:false,refresh:vi.fn(),logout:vi.fn()})
  vi.mocked(useLoginHash).mockReturnValue({step:null,open:vi.fn(),showStep:vi.fn(),close:vi.fn()})
  vi.mocked(api.getConfig).mockResolvedValue({enabled:true,sitekey:'test'})
  vi.mocked(api.getTerms).mockResolvedValue({version:'v1',privacy_notice:'Aviso',consents:[]})
  vi.mocked(api.getCandidate).mockResolvedValue(null)
  vi.mocked(api.markOnboardingSeen).mockResolvedValue(undefined)
})
afterEach(()=>{cleanup();vi.resetAllMocks();window.history.replaceState(null,'','/')})
test('landing CTA uses platform base and is distinct from member login',async()=>{
  window.history.replaceState(null,'','/gaydevs/platform/')
  render(<App/>)
  expect(await screen.findByRole('link',{name:'quero ser um gdev'})).toHaveAttribute('href','/gaydevs/platform/apply')
  expect(screen.getByRole('button',{name:'entrar'})).toBeVisible()
}, 15000)
test('disabled config hides CTA',async()=>{
  vi.mocked(api.getConfig).mockResolvedValue({enabled:false})
  window.history.replaceState(null,'','/gaydevs/platform/')
  render(<App/>)
  await waitFor(()=>expect(api.getConfig).toHaveBeenCalled())
  expect(screen.queryByRole('link',{name:'quero ser um gdev'})).not.toBeInTheDocument()
})
test('admin deep link and menu remain scoped to platform base',async()=>{
  window.history.replaceState(null,'','/gaydevs/platform/admin/applications')
  vi.mocked(useAuth).mockReturnValue({user:{id:'admin',name:'Admin',member_type:'admin'},restoring:false,refresh:vi.fn(),logout:vi.fn()})
  vi.mocked(api.listApplications).mockResolvedValue({data:[],current_page:1,last_page:1})
  render(<App/>)
  expect(await screen.findByText('Nenhuma candidatura pendente.')).toBeVisible()
  await userEvent.setup().click(screen.getByRole('button',{name:'abrir menu'}))
  expect(screen.getByRole('button',{name:'candidaturas'})).toBeVisible()
})
test('first authentication of admitted member opens onboarding',async()=>{
  window.history.replaceState(null,'','/gaydevs/platform/')
  vi.mocked(useAuth).mockReturnValue({user:{id:'member',name:'New',member_type:'member',onboarding_eligible:true,onboarding_required:true},restoring:false,refresh:vi.fn(),logout:vi.fn()})
  render(<App/>)
  expect(await screen.findByRole('heading',{name:'boas-vindas, gdev!'})).toBeVisible()
  expect(window.location.pathname).toBe('/gaydevs/platform/onboarding')
  await waitFor(()=>expect(api.markOnboardingSeen).toHaveBeenCalled())
})
