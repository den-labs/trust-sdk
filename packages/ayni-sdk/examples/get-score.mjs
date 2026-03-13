import {
  Ayni,
  AyniError,
  AuthenticationError,
  PaymentRequiredError,
} from '@denlabs/ayni-sdk'

const chainId = Number(process.env.AYNI_CHAIN_ID ?? 43114)
const agentId = Number(process.env.AYNI_AGENT_ID ?? 1)
const apiKey = process.env.AYNI_API_KEY

if (!apiKey) {
  console.error('Missing AYNI_API_KEY')
  console.error('Example: AYNI_API_KEY=ay_xxx node examples/get-score.mjs')
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
  const ayni = new Ayni({ apiKey })
  const { score } = await ayni.getScore(chainId, agentId)

  console.log('Agent:', `${chainId}:${agentId}`)
  console.log('Score:', score.value)
  console.log('Confidence:', score.confidence)
  console.log('Feedbacks:', score.stats.feedbackCount)
  console.log('Positive %:', score.stats.feedbackCount > 0
    ? ((score.stats.positiveCount / score.stats.feedbackCount) * 100).toFixed(1)
    : '0.0')
  console.log('Trust State:', interpretTrust(score))
}

main().catch((e) => {
  if (e instanceof AuthenticationError) {
    console.error('Authentication failed (invalid/disabled API key)')
  } else if (e instanceof PaymentRequiredError) {
    console.error('Payment required: use x402 mode/account instead of API key example')
  } else if (e instanceof AyniError) {
    console.error('Ayni API error:', e.status, e.body)
  } else {
    console.error('Unexpected error:', e)
  }
  process.exit(1)
})
