import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DenScope, DenScopeError, AuthenticationError, PaymentRequiredError } from '../src'

const BASE = 'https://denscope.vercel.app'

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers ?? {}),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

describe('DenScope client (API key mode)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('getAgent sends Authorization header and returns profile', async () => {
    const body = { agent: { chainId: 42220, agentId: 5, owner: '0xabc' } }
    globalThis.fetch = mockFetch(200, body)

    const ds = new DenScope({ apiKey: 'ds_test123' })
    const result = await ds.getAgent(42220, 5)

    expect(result).toEqual(body)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/42220/5`,
      { headers: { Authorization: 'Bearer ds_test123' } },
    )
  })

  it('getScore returns trust score', async () => {
    const body = { score: { value: 72, confidence: 'high' }, formula: 'https://...' }
    globalThis.fetch = mockFetch(200, body)

    const ds = new DenScope({ apiKey: 'ds_test123' })
    const result = await ds.getScore(42220, 5)

    expect(result.score.value).toBe(72)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/42220/5/score`,
      expect.any(Object),
    )
  })

  it('getSignals passes status query param', async () => {
    const body = { signals: [], count: 0 }
    globalThis.fetch = mockFetch(200, body)

    const ds = new DenScope({ apiKey: 'ds_test123' })
    await ds.getSignals(42220, 5, { status: 'resolved' })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/42220/5/signals?status=resolved`,
      expect.any(Object),
    )
  })

  it('getEvents passes limit, offset, kind params', async () => {
    const body = { events: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }
    globalThis.fetch = mockFetch(200, body)

    const ds = new DenScope({ apiKey: 'ds_test123' })
    await ds.getEvents(42220, 5, { limit: 10, offset: 20, kind: 'feedback' })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/42220/5/events?limit=10&offset=20&kind=feedback`,
      expect.any(Object),
    )
  })

  it('search passes q, chainId, limit params', async () => {
    const body = { agents: [], count: 0 }
    globalThis.fetch = mockFetch(200, body)

    const ds = new DenScope({ apiKey: 'ds_test123' })
    await ds.search({ q: '0xabc', chainId: 42220, limit: 5 })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/search?q=0xabc&chainId=42220&limit=5`,
      expect.any(Object),
    )
  })

  it('search with no options sends no query params', async () => {
    const body = { agents: [], count: 0 }
    globalThis.fetch = mockFetch(200, body)

    const ds = new DenScope({ apiKey: 'ds_test123' })
    await ds.search()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/search`,
      expect.any(Object),
    )
  })

  it('throws AuthenticationError on 401', async () => {
    globalThis.fetch = mockFetch(401, { error: 'Invalid API key' })

    const ds = new DenScope({ apiKey: 'ds_bad' })
    await expect(ds.getAgent(42220, 5)).rejects.toThrow(AuthenticationError)
  })

  it('throws AuthenticationError on 403', async () => {
    globalThis.fetch = mockFetch(403, { error: 'Key disabled' })

    const ds = new DenScope({ apiKey: 'ds_disabled' })
    await expect(ds.getAgent(42220, 5)).rejects.toThrow(AuthenticationError)
  })

  it('throws DenScopeError on 404', async () => {
    globalThis.fetch = mockFetch(404, { error: 'Agent not found' })

    const ds = new DenScope({ apiKey: 'ds_test123' })
    await expect(ds.getAgent(42220, 999)).rejects.toThrow(DenScopeError)
  })

  it('throws DenScopeError on 429', async () => {
    globalThis.fetch = mockFetch(429, { error: 'Rate limit exceeded' })

    const ds = new DenScope({ apiKey: 'ds_test123' })
    const err = await ds.getAgent(42220, 5).catch((e) => e)
    expect(err).toBeInstanceOf(DenScopeError)
    expect(err.status).toBe(429)
  })

  it('respects custom baseUrl', async () => {
    globalThis.fetch = mockFetch(200, { agents: [], count: 0 })

    const ds = new DenScope({ apiKey: 'ds_test123', baseUrl: 'https://custom.example.com/' })
    await ds.search()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://custom.example.com/api/v1/search',
      expect.any(Object),
    )
  })

  it('throws PaymentRequiredError on 402 without x402 account', async () => {
    globalThis.fetch = mockFetch(402, { error: 'payment required' })

    const ds = new DenScope({ apiKey: 'ds_test123' })
    await expect(ds.getScore(42220, 5)).rejects.toThrow(PaymentRequiredError)
  })
})

describe('DenScope client (x402 mode)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('retries with X-PAYMENT header on 402', async () => {
    const paymentRequired = {
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: 'eip155:42220',
        amount: '1000',
        asset: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
        payTo: '0xPayTo',
        maxTimeoutSeconds: 30,
        extra: { assetTransferMethod: 'eip3009', name: 'USD Coin', version: '2' },
      }],
      resource: { url: 'https://denscope.vercel.app/api/v1/agent/42220/5/score', description: 'Trust score', mimeType: 'application/json' },
      error: 'missing payment header',
    }

    const encoded = btoa(JSON.stringify(paymentRequired))
    const scoreBody = { score: { value: 80, confidence: 'high' }, formula: 'https://...' }

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

    const ds = new DenScope({ account: mockAccount })
    const result = await ds.getScore(42220, 5)

    expect(result.score.value).toBe(80)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    // Second call should have X-PAYMENT header
    const secondCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(secondCall[1].headers['X-PAYMENT']).toBeDefined()
    // signTypedData should have been called with EIP-712 params
    expect(mockAccount.signTypedData).toHaveBeenCalledOnce()
    const signArgs = mockAccount.signTypedData.mock.calls[0][0]
    expect(signArgs.domain.name).toBe('USD Coin')
    expect(signArgs.domain.verifyingContract).toBe('0xcebA9300f2b948710d2653dD7B07f33A8B32118C')
    expect(signArgs.primaryType).toBe('TransferWithAuthorization')
  })
})
