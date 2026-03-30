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

const MOCK_EVALUATION = {
  evaluation: {
    trust_band: 'high',
    status: 'active',
    signal_strength: 'strong',
    risk_level: 'minimal',
    decision_confidence: 'high',
    recommended_action: 'allow',
    flags: [],
    rationale: 'Agent scores 78/100.',
    evidence: {
      score: 78,
      score_confidence: 'high',
      feedbackCount: 42,
      positiveRatio: 0.88,
      openIncidents: 0,
      lastActivityDays: 3,
      ageDays: 120,
    },
    preset: 'default_safety',
    evaluatedAt: '2026-03-29T18:30:00Z',
    chainId: 42220,
    agentId: 5,
  },
}

describe('TrustClient.evaluate', () => {
  it('sends POST to /api/v1/trust/evaluate', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse(MOCK_EVALUATION))

    const result = await client.evaluate(42220, 5, { preset: 'default_safety' })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe(`${BASE_URL}/api/v1/trust/evaluate`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      chainId: 42220,
      agentId: 5,
      preset: 'default_safety',
    })
    expect(result.evaluation.trust_band).toBe('high')
  })

  it('includes optional fields in body', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse(MOCK_EVALUATION))

    await client.evaluate(42220, 5, {
      preset: 'defi_counterparty',
      context: 'lending pool',
      sensitivity: 'high',
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.preset).toBe('defi_counterparty')
    expect(body.context).toBe('lending pool')
    expect(body.sensitivity).toBe('high')
  })

  it('includes Authorization header', async () => {
    const { client, mockFetch } = createClient('my_key')
    mockFetch.mockResolvedValue(jsonResponse(MOCK_EVALUATION))

    await client.evaluate(42220, 5, { preset: 'default_safety' })

    const headers = mockFetch.mock.calls[0][1].headers
    expect(headers.Authorization).toBe('Bearer my_key')
  })

  it('throws on 404', async () => {
    const { client, mockFetch } = createClient()
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Agent not found' }, 404))

    await expect(
      client.evaluate(42220, 999, { preset: 'default_safety' }),
    ).rejects.toThrow()
  })
})
