/**
 * Full SDK smoke test — exercises all 5 Ayni API methods against a real agent.
 *
 * Usage:
 *   AYNI_API_KEY=ds_xxx node examples/test-all-endpoints.mjs
 *
 * Optional env vars:
 *   AYNI_CHAIN_ID  — default 43113 (Fuji)
 *   AYNI_AGENT_ID  — default 74
 */

import { Ayni, AyniError, AuthenticationError } from '@denlabs/ayni-sdk'

const chainId = Number(process.env.AYNI_CHAIN_ID ?? 43113)
const agentId = Number(process.env.AYNI_AGENT_ID ?? 74)
const apiKey = process.env.AYNI_API_KEY

if (!apiKey) {
  console.error('Missing AYNI_API_KEY')
  console.error('Usage: AYNI_API_KEY=ds_xxx node examples/test-all-endpoints.mjs')
  process.exit(1)
}

const ayni = new Ayni({ apiKey })
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
    } else if (e instanceof AyniError) {
      console.log(`        API error: ${e.message} (status ${e.status})`)
    } else {
      console.log(`        ${e.message}`)
    }
    failed++
  }
}

console.log(`\nAyni SDK Smoke Test`)
console.log(`Chain: ${chainId} | Agent: #${agentId}`)
console.log(`API Key: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`)
console.log(`${'='.repeat(50)}\n`)

// 1. getAgent — agent profile
await test('getAgent — agent profile', async () => {
  const { agent } = await ayni.getAgent(chainId, agentId)
  return { name: agent.name, owner: agent.owner, feedbackCount: agent.feedbackCount }
})

// 2. getScore — trust score
await test('getScore — trust score', async () => {
  const { score } = await ayni.getScore(chainId, agentId)
  return { value: score.value, confidence: score.confidence }
})

// 3. getSignals — risk signals
await test('getSignals — all signals', async () => {
  const { signals } = await ayni.getSignals(chainId, agentId)
  return { count: signals.length }
})

// 4. getEvents — event history
await test('getEvents — event history', async () => {
  const { events } = await ayni.getEvents(chainId, agentId, { limit: 5 })
  return { count: events.length }
})

// 5. search — find agents
await test('search — by chain', async () => {
  const { agents } = await ayni.search({ chainId })
  return { found: agents.length }
})

console.log(`\n${'='.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
