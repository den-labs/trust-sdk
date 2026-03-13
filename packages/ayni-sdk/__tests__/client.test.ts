import { describe, it, expect, vi, afterEach } from 'vitest'
import { Ayni, AyniError, AuthenticationError, PaymentRequiredError } from '../src'

const BASE = 'https://ayni.vercel.app'

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers ?? {}),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

describe('Ayni client (API key mode)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('getAgent sends Authorization header and returns profile', async () => {
    const body = { agent: { chainId: 43114, agentId: 1, owner: '0xabc' } }
    globalThis.fetch = mockFetch(200, body)

    const ayni = new Ayni({ apiKey: 'ay_test123' })
    const result = await ayni.getAgent(43114, 1)

    expect(result).toEqual(body)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/43114/1`,
      { headers: { Authorization: 'Bearer ay_test123' } },
    )
  })

  it('getScore returns trust score', async () => {
    const body = { score: { value: 85, confidence: 'high' }, formula: 'https://...' }
    globalThis.fetch = mockFetch(200, body)

    const ayni = new Ayni({ apiKey: 'ay_test123' })
    const result = await ayni.getScore(43114, 1)

    expect(result.score.value).toBe(85)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/43114/1/score`,
      expect.any(Object),
    )
  })

  it('getSignals passes status query param', async () => {
    const body = { signals: [], count: 0 }
    globalThis.fetch = mockFetch(200, body)

    const ayni = new Ayni({ apiKey: 'ay_test123' })
    await ayni.getSignals(43114, 1, { status: 'resolved' })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/43114/1/signals?status=resolved`,
      expect.any(Object),
    )
  })

  it('getEvents passes limit, offset, kind params', async () => {
    const body = { events: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }
    globalThis.fetch = mockFetch(200, body)

    const ayni = new Ayni({ apiKey: 'ay_test123' })
    await ayni.getEvents(43114, 1, { limit: 10, offset: 20, kind: 'feedback' })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/43114/1/events?limit=10&offset=20&kind=feedback`,
      expect.any(Object),
    )
  })

  it('search passes q, chainId, limit params', async () => {
    const body = { agents: [], count: 0 }
    globalThis.fetch = mockFetch(200, body)

    const ayni = new Ayni({ apiKey: 'ay_test123' })
    await ayni.search({ q: '0xabc', chainId: 43114, limit: 5 })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/search?q=0xabc&chainId=43114&limit=5`,
      expect.any(Object),
    )
  })

  it('search with no options sends no query params', async () => {
    const body = { agents: [], count: 0 }
    globalThis.fetch = mockFetch(200, body)

    const ayni = new Ayni({ apiKey: 'ay_test123' })
    await ayni.search()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/search`,
      expect.any(Object),
    )
  })

  it('throws AuthenticationError on 401', async () => {
    globalThis.fetch = mockFetch(401, { error: 'Invalid API key' })

    const ayni = new Ayni({ apiKey: 'ay_bad' })
    await expect(ayni.getAgent(43114, 1)).rejects.toThrow(AuthenticationError)
  })

  it('throws AyniError on 404', async () => {
    globalThis.fetch = mockFetch(404, { error: 'Agent not found' })

    const ayni = new Ayni({ apiKey: 'ay_test123' })
    await expect(ayni.getAgent(43114, 999)).rejects.toThrow(AyniError)
  })

  it('throws AyniError on 429', async () => {
    globalThis.fetch = mockFetch(429, { error: 'Rate limit exceeded' })

    const ayni = new Ayni({ apiKey: 'ay_test123' })
    const err = await ayni.getAgent(43114, 1).catch((e) => e)
    expect(err).toBeInstanceOf(AyniError)
    expect(err.status).toBe(429)
  })

  it('respects custom baseUrl', async () => {
    globalThis.fetch = mockFetch(200, { agents: [], count: 0 })

    const ayni = new Ayni({ apiKey: 'ay_test123', baseUrl: 'https://custom.example.com/' })
    await ayni.search()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://custom.example.com/api/v1/search',
      expect.any(Object),
    )
  })

  it('throws PaymentRequiredError on 402 without x402 account', async () => {
    globalThis.fetch = mockFetch(402, { error: 'payment required' })

    const ayni = new Ayni({ apiKey: 'ay_test123' })
    await expect(ayni.getScore(43114, 1)).rejects.toThrow(PaymentRequiredError)
  })
})

describe('Ayni client (x402 mode)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('retries with X-PAYMENT header on 402', async () => {
    const paymentRequired = {
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: 'eip155:43114',
        amount: '500',
        asset: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
        payTo: '0xPayTo',
        maxTimeoutSeconds: 30,
        extra: { assetTransferMethod: 'eip3009', name: 'USD Coin', version: '2' },
      }],
      resource: { url: 'https://ayni.vercel.app/api/v1/agent/43114/1/score', description: 'Trust score', mimeType: 'application/json' },
      error: 'missing payment header',
    }

    const encoded = btoa(JSON.stringify(paymentRequired))
    const scoreBody = { score: { value: 92, confidence: 'high' }, formula: 'https://...' }

    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 402,
          headers: new Headers({ 'payment-required': encoded }),
          json: () => Promise.resolve(paymentRequired),
          text: () => Promise.resolve(JSON.stringify(paymentRequired)),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve(scoreBody),
        text: () => Promise.resolve(JSON.stringify(scoreBody)),
      })
    })

    const mockAccount = {
      address: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
      signTypedData: vi.fn().mockResolvedValue('0xsig' as `0x${string}`),
    }

    const ayni = new Ayni({ account: mockAccount })
    const result = await ayni.getScore(43114, 1)

    expect(result.score.value).toBe(92)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    const secondCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(secondCall[1].headers['X-PAYMENT']).toBeDefined()
    expect(mockAccount.signTypedData).toHaveBeenCalledOnce()
    const signArgs = mockAccount.signTypedData.mock.calls[0][0]
    expect(signArgs.domain.chainId).toBe(43114)
    expect(signArgs.primaryType).toBe('TransferWithAuthorization')
  })
})
