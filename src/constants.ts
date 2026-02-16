export const DEFAULT_BASE_URL = 'https://denscope.vercel.app'

export const API_PREFIX = '/api/v1'

/** EIP-3009 TransferWithAuthorization types for EIP-712 signing */
export const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
}

/** Default signature validity window: 1 hour */
export const SIGNATURE_VALIDITY_SECONDS = 3600
