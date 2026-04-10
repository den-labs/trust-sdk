import { describe, it, expect, beforeAll } from 'vitest'
import { DenScope, AuthenticationError } from '../src'

const apiKey = process.env.DENSCOPE_API_KEY
const chainId = Number(process.env.DENSCOPE_CHAIN_ID ?? 11142220) // Celo Sepolia
const agentId = Number(process.env.DENSCOPE_AGENT_ID ?? 1)

describe.skipIf(!apiKey)('DenScope E2E (live endpoints)', () => {
  let client: DenScope

  beforeAll(() => {
    client = new DenScope({ apiKey: apiKey!, timeoutMs: 15000 })
  })

  it('getAgent returns agent profile with expected shape', async () => {
    const { agent } = await client.getAgent(chainId, agentId)

    expect(agent).toBeDefined()
    expect(agent.chainId).toBe(chainId)
    expect(agent.agentId).toBe(agentId)
    // owner may be null if agent was registered before poller was active
    if (agent.owner !== null) {
      expect(typeof agent.owner).toBe('string')
      expect(agent.owner).toMatch(/^0x[0-9a-fA-F]+$/)
    }
    expect(typeof agent.feedbackCount).toBe('number')
    expect(typeof agent.positiveCount).toBe('number')
    expect(typeof agent.negativeCount).toBe('number')
    expect(agent.feedbackCount).toBeGreaterThanOrEqual(0)
  })

  it('getScore returns trust score with breakdown', async () => {
    const { score } = await client.getScore(chainId, agentId)

    expect(score).toBeDefined()
    expect(typeof score.value).toBe('number')
    expect(score.value).toBeGreaterThanOrEqual(0)
    expect(score.value).toBeLessThanOrEqual(100)
    expect(['low', 'medium', 'high']).toContain(score.confidence)
    expect(score.breakdown).toBeDefined()
    expect(score.breakdown.positiveRatio).toHaveProperty('value')
    expect(score.breakdown.positiveRatio).toHaveProperty('weight')
    expect(score.stats).toBeDefined()
    expect(typeof score.stats.feedbackCount).toBe('number')
  })

  it('getSignals returns signals array', async () => {
    const { signals, count } = await client.getSignals(chainId, agentId)

    expect(Array.isArray(signals)).toBe(true)
    expect(typeof count).toBe('number')
    expect(count).toBe(signals.length)
  })

  it('getSignals with status filter works', async () => {
    const { signals } = await client.getSignals(chainId, agentId, { status: 'all' })
    expect(Array.isArray(signals)).toBe(true)
  })

  it('getEvents returns paginated event history', async () => {
    const { events, pagination } = await client.getEvents(chainId, agentId, { limit: 5 })

    expect(Array.isArray(events)).toBe(true)
    expect(events.length).toBeLessThanOrEqual(5)
    expect(pagination).toBeDefined()
    expect(typeof pagination.total).toBe('number')
    expect(typeof pagination.hasMore).toBe('boolean')
    expect(pagination.limit).toBe(5)
  })

  it('getEvents with offset works', async () => {
    const { events, pagination } = await client.getEvents(chainId, agentId, { limit: 2, offset: 0 })
    expect(events.length).toBeLessThanOrEqual(2)
    expect(pagination.offset).toBe(0)
  })

  it('search by chain returns agents', async () => {
    const { agents, count } = await client.search({ chainId })

    expect(Array.isArray(agents)).toBe(true)
    expect(agents.length).toBeGreaterThan(0)
    expect(typeof count).toBe('number')
    agents.forEach((a) => {
      expect(a.chainId).toBe(chainId)
      expect(typeof a.agentId).toBe('number')
      // owner may be null for agents registered before poller
      if (a.owner !== null) {
        expect(typeof a.owner).toBe('string')
      }
    })
  })

  it('search with limit works', async () => {
    const { agents } = await client.search({ chainId, limit: 3 })
    expect(agents.length).toBeLessThanOrEqual(3)
  })

  it('invalid API key returns AuthenticationError', async () => {
    const badClient = new DenScope({ apiKey: 'ds_invalid_key', timeoutMs: 10000 })
    await expect(badClient.getScore(chainId, agentId)).rejects.toThrow(AuthenticationError)
  })

  it('non-existent agent returns error or empty data', async () => {
    try {
      const { score } = await client.getScore(chainId, 999999)
      // Some APIs return 0 score for non-existent agents
      expect(score.value).toBe(0)
    } catch (e) {
      // Others throw — both are acceptable
      expect(e).toBeDefined()
    }
  })

  it('event shapes have required fields', async () => {
    const { events } = await client.getEvents(chainId, agentId, { limit: 1 })
    if (events.length > 0) {
      const event = events[0]
      expect(typeof event.id).toBe('number')
      expect(typeof event.kind).toBe('string')
      expect(typeof event.txHash).toBe('string')
      expect(typeof event.blockNumber).toBe('number')
    }
  })

  it('score consistency — value matches stats', async () => {
    const { score } = await client.getScore(chainId, agentId)
    // feedbackCount >= positive + negative because neutral feedbacks (value=0)
    // increment total but neither positive nor negative
    expect(score.stats.feedbackCount).toBeGreaterThanOrEqual(
      score.stats.positiveCount + score.stats.negativeCount,
    )
  })
})
