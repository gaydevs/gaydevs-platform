// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { OnboardingPage } from './OnboardingPage'
import { markOnboardingSeen } from './api'
vi.mock('./api',()=>({markOnboardingSeen:vi.fn()}))
afterEach(()=>{cleanup();vi.resetAllMocks()})
test('admitted member sees current spaces and initiatives and marks onboarding viewed',async()=>{
  vi.mocked(markOnboardingSeen).mockResolvedValue(undefined)
  const done=vi.fn().mockResolvedValue(undefined)
  render(<OnboardingPage user={{id:'test',name:'Test',onboarding_eligible:true,onboarding_required:true}} restoring={false} onLogin={vi.fn()} onDone={done}/>)
  expect(screen.getByText('/gdevs/off-topic-nsfw')).toBeVisible()
  expect(screen.getByText(/comitiva gaydevs/)).toBeVisible()
  await waitFor(()=>expect(markOnboardingSeen).toHaveBeenCalled())
  await userEvent.setup().click(screen.getByRole('button',{name:'concluir onboarding'}))
  await waitFor(()=>expect(done).toHaveBeenCalled())
})
test('legacy member does not mark onboarding viewed',()=>{
  render(<OnboardingPage user={{id:'old',name:'Old'}} restoring={false} onLogin={vi.fn()} onDone={vi.fn()}/>)
  expect(screen.getByText(/disponível para membros admitidos/)).toBeVisible()
  expect(markOnboardingSeen).not.toHaveBeenCalled()
})
