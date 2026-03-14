import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { TrustClient, TrustClientError, AuthenticationError, PaymentRequiredError } from '../src'

const BASE = 'https://test-oracle.example.com'

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers ?? {}),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

function createClient(config: Record<string, unknown> = {}) {
  return new TrustClient({ apiKey: 'test_key', ...config } as any, BASE)
}

describe('TrustClient (API key mode)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('getAgent sends Authorization header and returns profile', async () => {
    const body = { agent: { chainId: 42220, agentId: 5, owner: '0xabc' } }
    globalThis.fetch = mockFetch(200, body)

    const client = createClient()
    const result = await client.getAgent(42220, 5)

    expect(result).toEqual(body)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/42220/5`,
      { headers: { Authorization: 'Bearer test_key' } },
    )
  })

  it('getScore returns trust score', async () => {
    const body = { score: { value: 72, confidence: 'high' }, formula: 'https://...' }
    globalThis.fetch = mockFetch(200, body)

    const client = createClient()
    const result = await client.getScore(42220, 5)

    expect(result.score.value).toBe(72)
  })

  it('getSignals passes status query param', async () => {
    const body = { signals: [], count: 0 }
    globalThis.fetch = mockFetch(200, body)

    const client = createClient()
    await client.getSignals(42220, 5, { status: 'resolved' })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/42220/5/signals?status=resolved`,
      expect.any(Object),
    )
  })

  it('getSignals without options produces clean URL (no query string)', async () => {
    const body = { signals: [], count: 0 }
    globalThis.fetch = mockFetch(200, body)

    const client = createClient()
    await client.getSignals(42220, 5)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/42220/5/signals`,
      expect.any(Object),
    )
  })

  it('getEvents passes limit, offset, kind params', async () => {
    const body = { events: [], pagination: { total: 0, limit: 10, offset: 0, hasMore: false } }
    globalThis.fetch = mockFetch(200, body)

    const client = createClient()
    await client.getEvents(42220, 5, { limit: 10, offset: 20, kind: 'feedback' })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/42220/5/events?limit=10&offset=20&kind=feedback`,
      expect.any(Object),
    )
  })

  it('getEvents without options produces clean URL (no query string)', async () => {
    const body = { events: [], pagination: { total: 0, limit: 25, offset: 0, hasMore: false } }
    globalThis.fetch = mockFetch(200, body)

    const client = createClient()
    await client.getEvents(42220, 5)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/agent/42220/5/events`,
      expect.any(Object),
    )
  })

  it('search passes q, chainId, limit params', async () => {
    const body = { agents: [], count: 0 }
    globalThis.fetch = mockFetch(200, body)

    const client = createClient()
    await client.search({ q: '0xabc', chainId: 42220, limit: 5 })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/search?q=0xabc&chainId=42220&limit=5`,
      expect.any(Object),
    )
  })

  it('search without options produces clean URL (no query string)', async () => {
    const body = { agents: [], count: 0 }
    globalThis.fetch = mockFetch(200, body)

    const client = createClient()
    await client.search()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/search`,
      expect.any(Object),
    )
  })

  it('throws AuthenticationError on 401', async () => {
    globalThis.fetch = mockFetch(401, { error: 'Invalid API key' })
    const client = createClient()
    await expect(client.getAgent(42220, 5)).rejects.toThrow(AuthenticationError)
  })

  it('throws AuthenticationError on 403', async () => {
    globalThis.fetch = mockFetch(403, { error: 'Key disabled' })
    const client = createClient()
    await expect(client.getAgent(42220, 5)).rejects.toThrow(AuthenticationError)
  })

  it('throws TrustClientError on 404', async () => {
    globalThis.fetch = mockFetch(404, { error: 'Agent not found' })
    const client = createClient()
    await expect(client.getAgent(42220, 999)).rejects.toThrow(TrustClientError)
  })

  it('throws TrustClientError on 429', async () => {
    globalThis.fetch = mockFetch(429, { error: 'Rate limit exceeded' })
    const client = createClient()
    const err = await client.getAgent(42220, 5).catch((e) => e)
    expect(err).toBeInstanceOf(TrustClientError)
    expect(err.status).toBe(429)
  })

  it('respects custom baseUrl in config', async () => {
    globalThis.fetch = mockFetch(200, { agents: [], count: 0 })

    const client = new TrustClient(
      { apiKey: 'test_key', baseUrl: 'https://custom.example.com/' } as any,
      BASE,
    )
    await client.search()

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://custom.example.com/api/v1/search',
      expect.any(Object),
    )
  })

  it('throws PaymentRequiredError on 402 without x402 account', async () => {
    globalThis.fetch = mockFetch(402, { error: 'payment required' })
    const client = createClient()
    await expect(client.getScore(42220, 5)).rejects.toThrow(PaymentRequiredError)
  })
})

describe('TrustClient — constructor guards', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('throws when fetch is unavailable in the runtime', () => {
    const saved = globalThis.fetch
    // @ts-expect-error — intentionally removing fetch to test the guard
    globalThis.fetch = undefined

    expect(() => {
      new TrustClient({ apiKey: 'key' } as any, BASE)
    }).toThrow('Fetch API is not available')

    globalThis.fetch = saved
  })

  it('uses custom fetch from config instead of globalThis.fetch', async () => {
    const body = { agents: [], count: 0 }
    const customFetch = mockFetch(200, body)
    globalThis.fetch = mockFetch(500, { error: 'should not be called' })

    const client = new TrustClient(
      { apiKey: 'key', fetch: customFetch } as any,
      BASE,
    )
    await client.search()

    expect(customFetch).toHaveBeenCalledTimes(1)
    expect(customFetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/search`,
      expect.any(Object),
    )
    // globalThis.fetch should NOT have been called
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

describe('TrustClient — handleResponse edge cases', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('falls back to text() when json() fails on error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: () => Promise.reject(new Error('invalid json')),
      text: () => Promise.resolve('Internal Server Error'),
    })

    const client = createClient()
    const err: TrustClientError = await client.getAgent(42220, 5).catch((e) => e)

    expect(err).toBeInstanceOf(TrustClientError)
    expect(err.status).toBe(500)
    expect(err.body).toBe('Internal Server Error')
  })

  it('sets body to undefined when both json() and text() fail', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: new Headers(),
      json: () => Promise.reject(new Error('json fail')),
      text: () => Promise.reject(new Error('text fail')),
    })

    const client = createClient()
    const err: TrustClientError = await client.getAgent(42220, 5).catch((e) => e)

    expect(err).toBeInstanceOf(TrustClientError)
    expect(err.status).toBe(502)
    expect(err.body).toBeUndefined()
  })
})

describe('TrustClient — decodePaymentRequired error paths', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function makeX402Client() {
    const mockAccount = {
      address: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
      signTypedData: vi.fn().mockResolvedValue('0xsig' as `0x${string}`),
    }
    return new TrustClient({ account: mockAccount }, BASE)
  }

  it('throws PaymentRequiredError when 402 response has no PAYMENT-REQUIRED header', async () => {
    // x402 client gets 402 but with no payment-required header
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: new Headers(), // no payment-required header
      json: () => Promise.resolve({ error: 'payment required' }),
      text: () => Promise.resolve('payment required'),
    })

    const client = makeX402Client()
    await expect(client.getScore(42220, 5)).rejects.toThrow(PaymentRequiredError)
    await expect(client.getScore(42220, 5)).rejects.toThrow('missing PAYMENT-REQUIRED header')
  })

  it('throws PaymentRequiredError when PAYMENT-REQUIRED header is invalid base64', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: new Headers({ 'payment-required': '!!!not-valid-base64!!!' }),
      json: () => Promise.resolve({ error: 'payment required' }),
      text: () => Promise.resolve('payment required'),
    })

    const client = makeX402Client()
    await expect(client.getScore(42220, 5)).rejects.toThrow(PaymentRequiredError)
    await expect(client.getScore(42220, 5)).rejects.toThrow('Failed to decode PAYMENT-REQUIRED header')
  })

  it('throws PaymentRequiredError when accepts array is empty (x402 mode)', async () => {
    const paymentRequired = {
      x402Version: 2,
      accepts: [], // empty accepts
      resource: { url: `${BASE}/api/v1/agent/42220/5/score`, description: 'Trust score', mimeType: 'application/json' },
      error: 'no methods',
    }
    const encoded = btoa(JSON.stringify(paymentRequired))

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: new Headers({ 'payment-required': encoded }),
      json: () => Promise.resolve(paymentRequired),
      text: () => Promise.resolve(JSON.stringify(paymentRequired)),
    })

    const client = makeX402Client()
    await expect(client.getScore(42220, 5)).rejects.toThrow(PaymentRequiredError)
    await expect(client.getScore(42220, 5)).rejects.toThrow('No accepted payment methods')
  })
})

describe('TrustClient (x402 mode)', () => {
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
      resource: { url: `${BASE}/api/v1/agent/42220/5/score`, description: 'Trust score', mimeType: 'application/json' },
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

    const client = new TrustClient({ account: mockAccount }, BASE)
    const result = await client.getScore(42220, 5)

    expect(result.score.value).toBe(80)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    const secondCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1]
    expect(secondCall[1].headers['X-PAYMENT']).toBeDefined()
    expect(mockAccount.signTypedData).toHaveBeenCalledOnce()
  })
})

describe('TrustClient — timeout and AbortSignal', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('completes normally and cleans up timeout', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    const body = { agents: [], count: 0 }
    const customFetch = mockFetch(200, body)

    const client = new TrustClient(
      { apiKey: 'key', fetch: customFetch, timeoutMs: 5000 } as any,
      BASE,
    )
    await client.search()

    expect(customFetch).toHaveBeenCalledTimes(1)
    // Verify signal was passed to fetch
    const callArgs = customFetch.mock.calls[0]
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal)
    // clearTimeout should have been called during cleanup
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('aborts request when timeoutMs elapses', async () => {
    vi.useFakeTimers()

    // fetch that never resolves until aborted
    const customFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (init.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }
      })
    })

    const client = new TrustClient(
      { apiKey: 'key', fetch: customFetch, timeoutMs: 100 } as any,
      BASE,
    )

    const promise = client.search()
    vi.advanceTimersByTime(100)

    await expect(promise).rejects.toThrow()

    vi.useRealTimers()
  })

  it('aborts request when external signal fires', async () => {
    const controller = new AbortController()

    const customFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (init.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }
      })
    })

    const client = new TrustClient(
      { apiKey: 'key', fetch: customFetch, signal: controller.signal, timeoutMs: 60000 } as any,
      BASE,
    )

    const promise = client.search()
    controller.abort()

    await expect(promise).rejects.toThrow()
  })

  it('immediately aborts when signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort() // pre-aborted

    const customFetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (init.signal?.aborted) {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
          return
        }
        if (init.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }
      })
    })

    const client = new TrustClient(
      { apiKey: 'key', fetch: customFetch, signal: controller.signal, timeoutMs: 60000 } as any,
      BASE,
    )

    await expect(client.search()).rejects.toThrow()
  })

  it('passes no signal when timeoutMs is not set and no external signal provided', async () => {
    const body = { agents: [], count: 0 }
    const customFetch = mockFetch(200, body)

    const client = new TrustClient(
      { apiKey: 'key', fetch: customFetch } as any,
      BASE,
    )
    await client.search()

    const callArgs = customFetch.mock.calls[0]
    // When no timeoutMs and no signal, requestInit should not have signal
    expect(callArgs[1].signal).toBeUndefined()
  })

  it('passes external signal directly when timeoutMs is not set', async () => {
    const controller = new AbortController()
    const body = { agents: [], count: 0 }
    const customFetch = mockFetch(200, body)

    const client = new TrustClient(
      { apiKey: 'key', fetch: customFetch, signal: controller.signal } as any,
      BASE,
    )
    await client.search()

    const callArgs = customFetch.mock.calls[0]
    expect(callArgs[1].signal).toBe(controller.signal)
  })
})
