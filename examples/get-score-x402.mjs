import {
  DenScope,
  DenScopeError,
  AuthenticationError,
  PaymentRequiredError,
} from '@denlabs/trust-sdk'
import { privateKeyToAccount } from 'viem/accounts'

const chainId = Number(process.env.DENSCOPE_CHAIN_ID ?? 42220)
const agentId = Number(process.env.DENSCOPE_AGENT_ID ?? 5)
const privateKey = process.env.DENSCOPE_PRIVATE_KEY

if (!privateKey) {
  console.error('Missing DENSCOPE_PRIVATE_KEY')
  console.error('Example: DENSCOPE_PRIVATE_KEY=0x... node examples/get-score-x402.mjs')
  process.exit(1)
}

if (!privateKey.startsWith('0x')) {
  console.error('DENSCOPE_PRIVATE_KEY must start with 0x')
  process.exit(1)
}

async function main() {
  const account = privateKeyToAccount(privateKey)
  const ds = new DenScope({ account })

  console.log('Agent:', `${chainId}:${agentId}`)
  console.log('Mode: x402 (wallet micropayments)')

  const { score } = await ds.getScore(chainId, agentId)
  console.log('Score:', score.value)
  console.log('Confidence:', score.confidence)
  console.log('Feedbacks:', score.stats.feedbackCount)

  const { signals, count } = await ds.getSignals(chainId, agentId, { status: 'open' })
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
  } else if (e instanceof DenScopeError) {
    console.error('Denscope API error:', e.status, e.body)
  } else {
    console.error('Unexpected error:', e)
  }
  process.exit(1)
})
