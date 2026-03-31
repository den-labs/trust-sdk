export type TrustClientFetch = typeof globalThis.fetch

export interface BaseClientConfig {
  baseUrl?: string
  /** Override fetch implementation (testing/custom runtimes) */
  fetch?: TrustClientFetch
  /** Abort all requests when this signal aborts */
  signal?: AbortSignal
  /** Per-request timeout in milliseconds */
  timeoutMs?: number
}

/** Configuration for API key authentication */
export interface ApiKeyConfig extends BaseClientConfig {
  apiKey: string
}

/** Configuration for x402 micropayment authentication (requires viem) */
export interface X402Config extends BaseClientConfig {
  account: {
    address: `0x${string}`
    signTypedData: (args: {
      domain: Record<string, unknown>
      types: Record<string, Array<{ name: string; type: string }>>
      primaryType: string
      message: Record<string, unknown>
    }) => Promise<`0x${string}`>
  }
}

export type TrustClientConfig = ApiKeyConfig | X402Config

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

// --- Trust History Types ---

export type TrustHistoryWindow = '7d' | '30d' | '90d' | '365d'

export interface TrustHistoryOptions {
  /** Time window for each slice. Default: '30d' */
  window?: TrustHistoryWindow
  /** Number of slices to return. Default: 6 */
  limit?: number
}

/**
 * A single time-windowed trust snapshot.
 *
 * Captures the trust signal within a discrete period, enabling detection of
 * recent degradation that lifetime-aggregate scores would otherwise mask.
 */
export interface TrustScorePoint {
  /** ISO-8601 start of the window */
  periodStart: string
  /** ISO-8601 end of the window */
  periodEnd: string
  /** Trust score for this window (0–100), or null when no signal exists */
  score: number | null
  confidence: 'low' | 'medium' | 'high' | 'none'
  /** Count of feedback events within the window */
  feedbackCount: number
  /** Fraction of positive feedback within the window */
  positiveRatio: number | null
  /** Count of open incidents overlapping the window */
  openIncidents: number
}

export interface TrustHistoryResponse {
  chainId: number
  agentId: number
  window: TrustHistoryWindow
  history: TrustScorePoint[]
}

// --- Evaluation Types ---

export type EvaluatePreset = 'default_safety' | 'agent_to_agent' | 'defi_counterparty'

export interface EvaluateOptions {
  preset: EvaluatePreset
  context?: string
  sensitivity?: 'low' | 'normal' | 'high'
  objective?: string
}

export interface EvaluationEvidence {
  score: number
  score_confidence: 'low' | 'medium' | 'high'
  feedbackCount: number
  positiveRatio: number
  openIncidents: number
  lastActivityDays: number
  ageDays: number
}

export interface Evaluation {
  trust_band: 'high' | 'medium' | 'low' | 'insufficient_signal'
  status: 'active' | 'stale' | 'dormant' | 'anomalous'
  signal_strength: 'strong' | 'moderate' | 'weak' | 'none'
  risk_level: 'minimal' | 'moderate' | 'elevated' | 'critical'
  decision_confidence: 'low' | 'medium' | 'high'
  recommended_action: 'allow' | 'review' | 'limit'
  flags: string[]
  rationale: string
  evidence: EvaluationEvidence
  preset: string
  evaluatedAt: string
  chainId: number
  agentId: number
}

export interface EvaluateResponse {
  evaluation: Evaluation
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
