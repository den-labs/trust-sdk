import { TrustClient } from '@denlabs/trust-client-core'
import type { TrustClientConfig } from '@denlabs/trust-client-core'

const DEFAULT_BASE_URL = 'https://ayni-alpha.vercel.app'

/**
 * Ayni client — query ERC-8004 agent trust scores on Avalanche.
 *
 * Supported chains:
 * - Avalanche C-Chain (43114)
 * - Avalanche Fuji Testnet (43113)
 */
export class Ayni extends TrustClient {
  constructor(config: TrustClientConfig) {
    super(config, DEFAULT_BASE_URL)
  }
}
