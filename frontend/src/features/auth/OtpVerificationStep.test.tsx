// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyOtp } from './api'
import { OtpVerificationStep } from './OtpVerificationStep'

vi.mock('./api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api')>()
  return { ...original, verifyOtp: vi.fn() }
})

const otpContext = {
  otp_request_id: 'request-id',
  expires_at: '2026-10-24T12:00:00-03:00',
  user: { id: 'user-id', name: 'G*** E******', email: 'g***@example.test' },
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderStep() {
  return render(<OtpVerificationStep
    otpContext={otpContext}
    onBack={vi.fn()}
    onVerified={vi.fn().mockResolvedValue(undefined)}
  />)
}

describe('OtpVerificationStep', () => {
  it('distributes a pasted code and verifies after six numeric digits', async () => {
    vi.mocked(verifyOtp).mockResolvedValue()
    renderStep()
    const digits = screen.getAllByRole('textbox', { name: /dígito \d do código/ })
    const clipboardData = { getData: () => '12a3456' }

    fireEvent.paste(digits[0], { clipboardData })

    await waitFor(() => expect(verifyOtp).toHaveBeenCalledWith('request-id', '123456'))
    expect(digits.map((input) => (input as HTMLInputElement).value)).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('ignores a paste that contains no numeric characters', () => {
    renderStep()
    const digits = screen.getAllByRole('textbox', { name: /dígito \d do código/ })

    fireEvent.paste(digits[0], { clipboardData: { getData: () => 'abc' } })

    expect(digits[0]).toHaveValue('')
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('removes non-numeric input without submitting a partial code', () => {
    renderStep()
    const digits = screen.getAllByRole('textbox', { name: /dígito \d do código/ })

    fireEvent.change(digits[0], { target: { value: 'x' } })

    expect(digits[0]).toHaveValue('')
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('clears the current digit and moves backward with Backspace', async () => {
    const user = userEvent.setup()
    renderStep()
    const digits = screen.getAllByRole('textbox', { name: /dígito \d do código/ })

    await user.type(digits[0], '1')
    await user.click(digits[0])
    await user.keyboard('{Backspace}')
    expect(digits[0]).toHaveValue('')

    await user.keyboard('{ArrowRight}')
    await user.keyboard('{Backspace}')
    expect(digits[0]).toHaveFocus()
    expect(digits[0]).toHaveValue('')
  })
})
