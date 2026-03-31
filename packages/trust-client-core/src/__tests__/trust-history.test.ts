import { describe, it, expect, vi } from 'vitest'
import { TrustClient } from '../client'

const BASE_URL = 'https://test.example.com'

function createClient(apiKey = 'test_key') {
  const mockFetch = vi.fn()
  const client = new TrustClient({ apiKey, fetch: mockFetch }, BASE_URL)
  return { client, mockFetch }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const MOCK_HISTORY_RESPONSE = {
  chainId: 42220,
  agentId: 7,
  window: '30d',
  history: [
    {
      periodStart: '2025-11-01T00:00:00Z',
      periodEnd: '2025-11-30T23:59:59Z',
      score: 82,
      confidence: 'high',
      feedbackCount: 18,
      positiveRatio: 0.94,
      openIncidents: 0,
    },
    {
      periodStart: '2025-12-01T00:00:00Z',
      periodEnd: '2025-12-31T23:59:59Z',
      score: 79,
      confidence: 'medium',
      feedbackCount: 12,
      positiveRatio: 0.83,
      openIncidents: 1,
    },
    {
      periodStart: '2026-01-01T00:00:00Z',
      periodEnd: '2026-01-31T23:59:59Z',
      score: 61,
      confidence: 'low',
      feedbackCount: 4,
      positiveRatio: 0.5,
      openIncidents: 2,
    },
    {
      periodStart: '2026-02-01T00:00:00Z',
      periodEnd: '2026-02-28T23:59:59Z',
      score: null,
      confidence: 'none',
      feedbackCount: 0,
      positiveRatio: null,
      openIncidents: 0,
    },
  ],
}

describe('TrustClient.getTrustHistory', () => {
  it('requests GET /agent/:chainId/:agentId/history with no options', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse(MOCK_HISTORY_RESPONSE))

    const result = await client.getTrustHistory(42220, 7)

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(`${BASE_URL}/api/v1/agent/42220/7/history`)
    expect(init.method).toBe('GET')
    expect(result.history).toHaveLength(4)
    expect(result.window).toBe('30d')
  })

  it('passes window and limit as query parameters', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse(MOCK_HISTORY_RESPONSE))

    await client.getTrustHistory(42220, 7, { window: '7d', limit: 12 })

    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('window=7d')
    expect(url).toContain('limit=12')
  })

  it('omits query string when options are absent', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse(MOCK_HISTORY_RESPONSE))

    await client.getTrustHistory(42220, 7)

    const [url] = mockFetch.mock.calls[0]
    expect(url).not.toContain('?')
  })

  it('passes only window when limit is absent', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse(MOCK_HISTORY_RESPONSE))

    await client.getTrustHistory(42220, 7, { window: '90d' })

    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('window=90d')
    expect(url).not.toContain('limit')
  })

  it('includes Authorization header', async () => {
    const { client, mockFetch } = createClient('my_api_key')
    mockFetch.mockResolvedValue(jsonResponse(MOCK_HISTORY_RESPONSE))

    await client.getTrustHistory(42220, 7)

    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers['Authorization']).toBe('Bearer my_api_key')
  })

  it('returns null score and positiveRatio for windows with no signal', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse(MOCK_HISTORY_RESPONSE))

    const result = await client.getTrustHistory(42220, 7)

    const emptyWindow = result.history.find((p) => p.feedbackCount === 0)
    expect(emptyWindow).toBeDefined()
    expect(emptyWindow?.score).toBeNull()
    expect(emptyWindow?.positiveRatio).toBeNull()
    expect(emptyWindow?.confidence).toBe('none')
  })

  it('surfaces recent trust degradation across windows', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse(MOCK_HISTORY_RESPONSE))

    const result = await client.getTrustHistory(42220, 7)

    const scores = result.history
      .filter((p) => p.score !== null)
      .map((p) => p.score as number)

    // Confirm monotonically declining scores for this mock agent
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
    }
  })
})
