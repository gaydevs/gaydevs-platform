// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, currentSession, logout, messageForApiError, requestOtp, resolveApiBase, searchUsers, verifyOtp } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0'
})

describe('API client', () => {
  it('derives the API base relationally from the deployed frontend base', () => {
    expect(resolveApiBase('/gaydevs/platform/', 'https://example.test').href)
      .toBe('https://example.test/gaydevs/api/')
  })

  it('does not depend on the current page route', () => {
    expect(resolveApiBase('/gaydevs/platform/', 'https://example.test/another/page').pathname)
      .toBe('/gaydevs/api/')
  })

  it('preserves the server reference on an internal API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: 'Erro interno do servidor.',
      reference: '019a1234-0000-7000-8000-000000000099',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })))

    await expect(searchUsers('Lu')).rejects.toMatchObject({
      message: 'Erro interno do servidor.',
      status: 500,
      reference: '019a1234-0000-7000-8000-000000000099',
    })
  })

  it('maps public API errors without leaking internal details', () => {
    expect(messageForApiError(new ApiError('Código inválido.', 422))).toBe('Código inválido.')
    expect(messageForApiError(new ApiError('Erro interno.', 500))).toBe('Erro interno.')
    expect(messageForApiError(new ApiError('Erro interno.', 500, undefined, 'ref-123')))
      .toBe('Erro interno. Referência: ref-123')
    expect(messageForApiError(new Error('falha de rede'))).toBe('Não foi possível concluir a solicitação.')
  })

  it('sends the CSRF cookie and XSRF header on an OTP request', async () => {
    document.cookie = 'XSRF-TOKEN=token%2Bseguro'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        otp_request_id: 'request-id',
        expires_at: '2026-10-24T12:00:00-03:00',
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestOtp('user-id')).resolves.toMatchObject({ otp_request_id: 'request-id' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain('/sanctum/csrf-cookie')
    const requestInit = fetchMock.mock.calls[1][1] as RequestInit
    expect(requestInit).toMatchObject({ credentials: 'include', method: 'POST', body: JSON.stringify({ user_id: 'user-id' }) })
    expect(new Headers(requestInit.headers).get('X-XSRF-TOKEN')).toBe('token+seguro')
  })

  it('stops a state-changing request when CSRF initialization fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 419 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestOtp('user-id')).rejects.toMatchObject({
      message: 'Não foi possível iniciar uma conexão segura.',
      status: 419,
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('returns undefined for a successful 204 verification and logout', async () => {
    document.cookie = 'XSRF-TOKEN=token'
    const fetchMock = vi.fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(verifyOtp('request-id', '123456')).resolves.toBeUndefined()
    await expect(logout()).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('treats a missing session as a visitor and rethrows other session errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'falha' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(currentSession()).resolves.toBeNull()
    await expect(currentSession()).rejects.toMatchObject({ message: 'falha', status: 503 })
  })
})
