/** Configuration for API key authentication */
export interface ApiKeyConfig {
  apiKey: string
  baseUrl?: string
}

/** Configuration for x402 micropayment authentication (requires viem) */
export interface X402Config {
  account: {
    address: `0x${string}`
    signTypedData: (args: {
      domain: Record<string, unknown>
      types: Record<string, Array<{ name: string; type: string }>>
      primaryType: string
      message: Record<string, unknown>
    }) => Promise<`0x${string}`>
  }
  baseUrl?: string
}

export type DenScopeConfig = ApiKeyConfig | X402Config

// --- API Response Types ---

export interface AgentProfile {
  chainId: number
  agentId: number
  owner: string
  uri: string | null
  metadata: Record<string, unknown> | null
  feedbackCount: number
  positiveCount: number
  negativeCount: number
  firstSeen: string
  lastSeen: string
  claimed: boolean
  claimedBy: string | null
  displayName: string | null
}

export interface AgentProfileResponse {
  agent: AgentProfile
}

export interface ScoreBreakdownEntry {
  value: number
  weight: number
}

export interface TrustScore {
  value: number
  confidence: 'low' | 'medium' | 'high'
  breakdown: {
    positiveRatio: ScoreBreakdownEntry
    ageScore: ScoreBreakdownEntry
    activityScore: ScoreBreakdownEntry
    incidentPenalty: ScoreBreakdownEntry
  }
  stats: {
    feedbackCount: number
    positiveCount: number
    negativeCount: number
    openIncidents: number
  }
  updatedAt: string
}

export interface ScoreResponse {
  score: TrustScore
  formula: string
}

export interface Signal {
  id: string
  signalKind: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  whyItMatters: string
  sourceTxHash: string | null
  triggeredAt: string
  resolvedAt: string | null
}

export interface SignalsResponse {
  signals: Signal[]
  count: number
}

export interface AgentEvent {
  id: number
  kind: string
  blockNumber: number
  txHash: string
  logIndex: number
  data: Record<string, unknown>
  eventTimestamp: string | null
  createdAt: string
}

export interface EventsResponse {
  events: AgentEvent[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface SearchAgent {
  chainId: number
  agentId: number
  owner: string
  uri: string | null
  feedbackCount: number
  positiveCount: number
  negativeCount: number
}

export interface SearchResponse {
  agents: SearchAgent[]
  count: number
}

export interface EventsOptions {
  limit?: number
  offset?: number
  kind?: string
}

export interface SearchOptions {
  q?: string
  chainId?: number
  limit?: number
}

export interface SignalsOptions {
  status?: 'open' | 'resolved' | 'all'
}

// --- x402 Wire Types ---

export interface PaymentRequirement {
  scheme: string
  network: string
  amount: string
  asset: string
  payTo: string
  maxTimeoutSeconds: number
  extra: {
    assetTransferMethod: string
    name: string
    version: string
  }
}

export interface ResourceInfo {
  url: string
  description: string
  mimeType: string
}

export interface PaymentRequiredBody {
  x402Version: number
  accepts: PaymentRequirement[]
  resource: ResourceInfo
  error: string
}
