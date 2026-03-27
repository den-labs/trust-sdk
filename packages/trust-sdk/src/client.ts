import { TrustClient } from '@denlabs/trust-client-core'
import type { TrustClientConfig } from '@denlabs/trust-client-core'

const DEFAULT_BASE_URL = 'https://denscope.vercel.app'

/**
 * DenScope client — query ERC-8004 agent trust scores.
 *
 * Supported chains:
 * - Celo Mainnet (42220)
 * - Celo Sepolia (11142220)
 * - SKALE Base (1187947933)
 */
export class DenScope extends TrustClient {
  constructor(config: TrustClientConfig) {
    super(config, DEFAULT_BASE_URL)
  }
}
