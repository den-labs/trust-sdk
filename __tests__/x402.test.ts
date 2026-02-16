import { describe, it, expect, vi } from 'vitest'
import { decodePaymentRequired, buildPaymentHeader } from '../src/x402'
import { PaymentRequiredError } from '../src/errors'

const MOCK_REQUIREMENT = {
  scheme: 'exact',
  network: 'eip155:42220',
  amount: '1000',
  asset: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  payTo: '0xPayTo',
  maxTimeoutSeconds: 30,
  extra: { assetTransferMethod: 'eip3009', name: 'USD Coin', version: '2' },
}

const MOCK_RESOURCE = {
  url: 'https://denscope.vercel.app/api/v1/agent/42220/5/score',
  description: 'Trust score query for ERC-8004 agent',
  mimeType: 'application/json',
}

const MOCK_PAYMENT_REQUIRED_BODY = {
  x402Version: 2,
  accepts: [MOCK_REQUIREMENT],
  resource: MOCK_RESOURCE,
  error: 'missing payment header',
}

function makeResponse(headers: Record<string, string>): Response {
  return {
    headers: new Headers(headers),
  } as unknown as Response
}

describe('decodePaymentRequired', () => {
  it('decodes base64 PAYMENT-REQUIRED header', () => {
    const encoded = btoa(JSON.stringify(MOCK_PAYMENT_REQUIRED_BODY))
    const response = makeResponse({ 'payment-required': encoded })

    const result = decodePaymentRequired(response)
    expect(result.x402Version).toBe(2)
    expect(result.accepts).toHaveLength(1)
    expect(result.accepts[0].network).toBe('eip155:42220')
    expect(result.resource.url).toContain('/score')
  })

  it('throws if PAYMENT-REQUIRED header is missing', () => {
    const response = makeResponse({})
    expect(() => decodePaymentRequired(response)).toThrow(PaymentRequiredError)
    expect(() => decodePaymentRequired(response)).toThrow('missing PAYMENT-REQUIRED header')
  })

  it('throws if header is not valid base64 JSON', () => {
    const response = makeResponse({ 'payment-required': '!!!invalid!!!' })
    expect(() => decodePaymentRequired(response)).toThrow(PaymentRequiredError)
    expect(() => decodePaymentRequired(response)).toThrow('Failed to decode')
  })
})

describe('buildPaymentHeader', () => {
  const mockAccount = {
    address: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
    signTypedData: vi.fn().mockResolvedValue('0xdeadbeef' as `0x${string}`),
  }

  it('returns a base64-encoded X-PAYMENT string', async () => {
    const header = await buildPaymentHeader(
      { account: mockAccount },
      MOCK_REQUIREMENT,
      MOCK_RESOURCE,
    )

    const decoded = JSON.parse(atob(header))
    expect(decoded.x402Version).toBe(2)
  })

  it('includes resource and accepted from 402 response (pitfall #3)', async () => {
    const header = await buildPaymentHeader(
      { account: mockAccount },
      MOCK_REQUIREMENT,
      MOCK_RESOURCE,
    )

    const decoded = JSON.parse(atob(header))
    expect(decoded.resource).toEqual(MOCK_RESOURCE)
    expect(decoded.accepted).toEqual(MOCK_REQUIREMENT)
  })

  it('sends amount, validAfter, validBefore as strings (pitfall #4)', async () => {
    const header = await buildPaymentHeader(
      { account: mockAccount },
      MOCK_REQUIREMENT,
      MOCK_RESOURCE,
    )

    const decoded = JSON.parse(atob(header))
    const auth = decoded.payload.authorization
    expect(typeof auth.value).toBe('string')
    expect(auth.value).toBe('1000')
    expect(typeof auth.validAfter).toBe('string')
    expect(auth.validAfter).toBe('0')
    expect(typeof auth.validBefore).toBe('string')
    expect(Number(auth.validBefore)).toBeGreaterThan(Date.now() / 1000)
  })

  it('generates a unique 32-byte nonce (pitfall #5)', async () => {
    const header1 = await buildPaymentHeader(
      { account: mockAccount },
      MOCK_REQUIREMENT,
      MOCK_RESOURCE,
    )
    const header2 = await buildPaymentHeader(
      { account: mockAccount },
      MOCK_REQUIREMENT,
      MOCK_RESOURCE,
    )

    const decoded1 = JSON.parse(atob(header1))
    const decoded2 = JSON.parse(atob(header2))
    const nonce1 = decoded1.payload.authorization.nonce
    const nonce2 = decoded2.payload.authorization.nonce

    expect(nonce1).toMatch(/^0x[0-9a-f]{64}$/)
    expect(nonce2).toMatch(/^0x[0-9a-f]{64}$/)
    expect(nonce1).not.toBe(nonce2)
  })

  it('sets validBefore in the future (pitfall #6)', async () => {
    const header = await buildPaymentHeader(
      { account: mockAccount },
      MOCK_REQUIREMENT,
      MOCK_RESOURCE,
    )

    const decoded = JSON.parse(atob(header))
    const validBefore = Number(decoded.payload.authorization.validBefore)
    const now = Math.floor(Date.now() / 1000)
    expect(validBefore).toBeGreaterThan(now)
    expect(validBefore).toBeLessThanOrEqual(now + 3601) // 1 hour + 1s tolerance
  })

  it('extracts EIP-712 domain from 402 response (pitfall #7)', async () => {
    await buildPaymentHeader(
      { account: mockAccount },
      MOCK_REQUIREMENT,
      MOCK_RESOURCE,
    )

    const signArgs = mockAccount.signTypedData.mock.calls.at(-1)![0]
    expect(signArgs.domain).toEqual({
      name: 'USD Coin',
      version: '2',
      chainId: 42220,
      verifyingContract: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    })
  })

  it('signs with correct EIP-3009 types', async () => {
    await buildPaymentHeader(
      { account: mockAccount },
      MOCK_REQUIREMENT,
      MOCK_RESOURCE,
    )

    const signArgs = mockAccount.signTypedData.mock.calls.at(-1)![0]
    expect(signArgs.primaryType).toBe('TransferWithAuthorization')
    expect(signArgs.types.TransferWithAuthorization).toEqual([
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ])
  })

  it('throws for unsupported network format', async () => {
    const badRequirement = { ...MOCK_REQUIREMENT, network: 'solana:mainnet' }
    await expect(
      buildPaymentHeader({ account: mockAccount }, badRequirement, MOCK_RESOURCE),
    ).rejects.toThrow(PaymentRequiredError)
  })
})
