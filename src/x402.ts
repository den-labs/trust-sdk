import { EIP3009_TYPES, SIGNATURE_VALIDITY_SECONDS } from './constants'
import { PaymentRequiredError } from './errors'
import type {
  PaymentRequiredBody,
  PaymentRequirement,
  ResourceInfo,
  X402Config,
} from './types'

/** Decode the PAYMENT-REQUIRED header from a 402 response */
export function decodePaymentRequired(response: Response): PaymentRequiredBody {
  const header = response.headers.get('payment-required')
  if (!header) {
    throw new PaymentRequiredError('402 response missing PAYMENT-REQUIRED header')
  }
  try {
    const json = atob(header)
    return JSON.parse(json) as PaymentRequiredBody
  } catch {
    throw new PaymentRequiredError('Failed to decode PAYMENT-REQUIRED header')
  }
}

/** Generate a random 32-byte hex nonce (pitfall #5: must be unique per call) */
function randomNonce(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `0x${hex}` as `0x${string}`
}

/** Parse chain ID from CAIP-2 network string (e.g., "eip155:42220" → 42220) */
function parseChainId(network: string): number {
  const parts = network.split(':')
  if (parts.length !== 2 || parts[0] !== 'eip155') {
    throw new PaymentRequiredError(`Unsupported network format: ${network}`)
  }
  return parseInt(parts[1], 10)
}

/**
 * Sign an x402 payment and build the X-PAYMENT header value.
 *
 * Pitfalls handled:
 * - #3: X-PAYMENT v2 includes `resource` + `accepted` from 402 response
 * - #4: `amount`, `validAfter`, `validBefore` are strings in wire format
 * - #5: Unique 32-byte nonce per call via crypto.getRandomValues
 * - #6: `validBefore` = now + 1 hour (future)
 * - #7: EIP-712 domain extracted from 402 response `extra`, never hardcoded
 */
export async function buildPaymentHeader(
  config: X402Config,
  requirement: PaymentRequirement,
  resource: ResourceInfo,
): Promise<string> {
  // Pitfall #7: domain from 402 response, never hardcoded
  const chainId = parseChainId(requirement.network)
  const domain = {
    name: requirement.extra.name,
    version: requirement.extra.version,
    chainId,
    verifyingContract: requirement.asset as `0x${string}`,
  }

  const nonce = randomNonce() // Pitfall #5
  const now = Math.floor(Date.now() / 1000)
  const validBefore = now + SIGNATURE_VALIDITY_SECONDS // Pitfall #6

  const message = {
    from: config.account.address,
    to: requirement.payTo as `0x${string}`,
    value: BigInt(requirement.amount), // Pitfall #4: string → BigInt for signing
    validAfter: BigInt(0),
    validBefore: BigInt(validBefore),
    nonce,
  }

  const signature = await config.account.signTypedData({
    domain,
    types: EIP3009_TYPES,
    primaryType: 'TransferWithAuthorization',
    message,
  })

  // Pitfall #3: include resource + accepted; Pitfall #4: strings in wire format
  const payload = {
    x402Version: 2,
    resource,
    accepted: requirement,
    payload: {
      signature,
      authorization: {
        from: config.account.address,
        to: requirement.payTo,
        value: requirement.amount,       // string
        validAfter: '0',                 // string
        validBefore: String(validBefore), // string
        nonce,
      },
    },
  }

  return btoa(JSON.stringify(payload))
}
