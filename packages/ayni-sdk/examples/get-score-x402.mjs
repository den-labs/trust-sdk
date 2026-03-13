import {
  Ayni,
  AyniError,
  AuthenticationError,
  PaymentRequiredError,
} from '@denlabs/ayni-sdk'
import { privateKeyToAccount } from 'viem/accounts'

const chainId = Number(process.env.AYNI_CHAIN_ID ?? 43114)
const agentId = Number(process.env.AYNI_AGENT_ID ?? 1)
const privateKey = process.env.AYNI_PRIVATE_KEY

if (!privateKey) {
  console.error('Missing AYNI_PRIVATE_KEY')
  console.error('Example: AYNI_PRIVATE_KEY=0x... node examples/get-score-x402.mjs')
  process.exit(1)
}

if (!privateKey.startsWith('0x')) {
  console.error('AYNI_PRIVATE_KEY must start with 0x')
  process.exit(1)
}

async function main() {
  const account = privateKeyToAccount(privateKey)
  const ayni = new Ayni({ account })

  console.log('Agent:', `${chainId}:${agentId}`)
  console.log('Mode: x402 (wallet micropayments)')

  const { score } = await ayni.getScore(chainId, agentId)
  console.log('Score:', score.value)
  console.log('Confidence:', score.confidence)
  console.log('Feedbacks:', score.stats.feedbackCount)

  const { signals, count } = await ayni.getSignals(chainId, agentId, { status: 'open' })
  console.log('Open signals:', count)
  if (signals[0]) {
    console.log('First signal:', `${signals[0].severity} - ${signals[0].title}`)
  }
}

main().catch((e) => {
  if (e instanceof AuthenticationError) {
    console.error('Authentication error (unexpected in x402 mode):', e.status, e.body)
  } else if (e instanceof PaymentRequiredError) {
    console.error('Payment flow error / missing x402 support:', e.body ?? e.message)
  } else if (e instanceof AyniError) {
    console.error('Ayni API error:', e.status, e.body)
  } else {
    console.error('Unexpected error:', e)
  }
  process.exit(1)
})
