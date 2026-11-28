// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { AdminApplications } from './AdminApplications'
import * as api from './api'
import { emptyFields } from './presentation'
import type { Detail } from './api'
vi.mock('./api',()=>({listApplications:vi.fn(),getApplication:vi.fn(),saveNotes:vi.fn(),decideApplication:vi.fn()}))
afterEach(()=>{cleanup();vi.resetAllMocks()})
const admin={id:'admin',name:'Admin',member_type:'admin'}
const detail:Detail={id:'candidate',status:'pending',first_name:'Test',last_name:'Candidate',submitted_at:'2026-11-27T12:00:00Z',revision:1,fields:{...emptyFields,referral_source:'Origem livre',email:'test@example.test'},consents:[],admin_notes:null,whatsapp_url:null,reviewed_at:null,reviewed_by:null,notification_status:'pending'}
test('member cannot query admin API',()=>{
  render(<AdminApplications user={{...admin,member_type:'member'}} restoring={false} base="/admin/applications" onNavigate={vi.fn()} onLogin={vi.fn()}/>)
  expect(screen.getByText('Acesso exclusivo para admins ativos.')).toBeVisible()
  expect(api.listApplications).not.toHaveBeenCalled()
})
test('admin sees data and confirms decision explicitly',async()=>{
  const ui=userEvent.setup()
  vi.mocked(api.getApplication).mockResolvedValue(detail)
  vi.mocked(api.decideApplication).mockResolvedValue({status:'approved'})
  render(<AdminApplications id="candidate" user={admin} restoring={false} base="/admin/applications" onNavigate={vi.fn()} onLogin={vi.fn()}/>)
  expect(await screen.findByText('Origem livre')).toBeVisible()
  await ui.click(screen.getByRole('button',{name:'aprovar'}))
  expect(api.decideApplication).not.toHaveBeenCalled()
  vi.mocked(api.getApplication).mockResolvedValue({...detail,status:'approved'})
  await ui.click(screen.getByRole('button',{name:'confirmar decisão'}))
  await waitFor(()=>expect(api.decideApplication).toHaveBeenCalledWith('candidate','approve'))
  expect(await screen.findByText('approved')).toBeVisible()
})
