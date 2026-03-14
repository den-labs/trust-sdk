/**
 * Full SDK smoke test — exercises all 5 DenScope API methods against a real agent.
 *
 * Usage:
 *   DENSCOPE_API_KEY=ds_xxx node examples/test-all-endpoints.mjs
 *
 * Optional env vars:
 *   DENSCOPE_CHAIN_ID  — default 42220 (Celo Mainnet)
 *   DENSCOPE_AGENT_ID  — default 1
 */

import { DenScope, DenScopeError, AuthenticationError } from '@denlabs/trust-sdk'

const chainId = Number(process.env.DENSCOPE_CHAIN_ID ?? 42220)
const agentId = Number(process.env.DENSCOPE_AGENT_ID ?? 1)
const apiKey = process.env.DENSCOPE_API_KEY

if (!apiKey) {
  console.error('Missing DENSCOPE_API_KEY')
  console.error('Usage: DENSCOPE_API_KEY=ds_xxx node examples/test-all-endpoints.mjs')
  process.exit(1)
}

const client = new DenScope({ apiKey })
let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    const result = await fn()
    console.log(`  PASS  ${name}`)
    if (result) console.log(`        ${JSON.stringify(result).slice(0, 120)}`)
    passed++
  } catch (e) {
    console.log(`  FAIL  ${name}`)
    if (e instanceof AuthenticationError) {
      console.log(`        Auth error: ${e.message} (status ${e.status})`)
    } else if (e instanceof DenScopeError) {
      console.log(`        API error: ${e.message} (status ${e.status})`)
    } else {
      console.log(`        ${e.message}`)
    }
    failed++
  }
}

console.log(`\nDenScope SDK Smoke Test`)
console.log(`Chain: ${chainId} | Agent: #${agentId}`)
console.log(`API Key: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`)
console.log(`${'='.repeat(50)}\n`)

await test('getAgent — agent profile', async () => {
  const { agent } = await client.getAgent(chainId, agentId)
  return { name: agent.name, owner: agent.owner, feedbackCount: agent.feedbackCount }
})

await test('getScore — trust score', async () => {
  const { score } = await client.getScore(chainId, agentId)
  return { value: score.value, confidence: score.confidence }
})

await test('getSignals — all signals', async () => {
  const { signals } = await client.getSignals(chainId, agentId)
  return { count: signals.length }
})

await test('getEvents — event history', async () => {
  const { events } = await client.getEvents(chainId, agentId, { limit: 5 })
  return { count: events.length }
})

await test('search — by chain', async () => {
  const { agents } = await client.search({ chainId })
  return { found: agents.length }
})

console.log(`\n${'='.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
