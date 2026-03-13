import {
  DenScope,
  DenScopeError,
  AuthenticationError,
  PaymentRequiredError,
} from '@denlabs/trust-sdk'

const chainId = Number(process.env.DENSCOPE_CHAIN_ID ?? 42220)
const agentId = Number(process.env.DENSCOPE_AGENT_ID ?? 5)
const apiKey = process.env.DENSCOPE_API_KEY

if (!apiKey) {
  console.error('Missing DENSCOPE_API_KEY')
  console.error('Example: DENSCOPE_API_KEY=ds_xxx node examples/get-score.mjs')
  process.exit(1)
}

function interpretTrust(score) {
  const total = score?.stats?.feedbackCount ?? 0
  const pos = score?.stats?.positiveCount ?? 0
  const confidence = score?.confidence ?? 'low'
  const positivePct = total > 0 ? (pos / total) * 100 : 0

  if (total < 5 || confidence === 'low') {
    return 'Sin suficiente señal'
  }
  if (total < 15 || confidence === 'medium') {
    return 'En observación'
  }
  if (positivePct >= 70) {
    return 'Confiable'
  }
  if (positivePct <= 35) {
    return 'Alto riesgo'
  }
  return 'En observación'
}

async function main() {
  const ds = new DenScope({ apiKey })
  const { score } = await ds.getScore(chainId, agentId)

  console.log('Agent:', `${chainId}:${agentId}`)
  console.log('Score:', score.value)
  console.log('Confidence:', score.confidence)
  console.log('Feedbacks:', score.stats.feedbackCount)
  console.log('Positive %:', score.stats.feedbackCount > 0
    ? ((score.stats.positiveCount / score.stats.feedbackCount) * 100).toFixed(1)
    : '0.0')
  console.log('Portal State (guide):', interpretTrust(score))
}

main().catch((e) => {
  if (e instanceof AuthenticationError) {
    console.error('Authentication failed (invalid/disabled API key)')
  } else if (e instanceof PaymentRequiredError) {
    console.error('Payment required: use x402 mode/account instead of API key example')
  } else if (e instanceof DenScopeError) {
    console.error('Denscope API error:', e.status, e.body)
  } else {
    console.error('Unexpected error:', e)
  }
  process.exit(1)
})
