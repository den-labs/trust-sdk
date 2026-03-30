export { DenScope } from './client'

// Backward-compatible error aliases
export {
  TrustClientError as DenScopeError,
  PaymentRequiredError,
  AuthenticationError,
} from '@denlabs/trust-client-core'

// Re-export all types from core
export type {
  TrustClientConfig as DenScopeConfig,
  TrustClientFetch as DenScopeFetch,
  BaseClientConfig,
  ApiKeyConfig,
  X402Config,
  AgentProfile,
  AgentProfileResponse,
  ScoreBreakdownEntry,
  TrustScore,
  ScoreResponse,
  Signal,
  SignalsResponse,
  AgentEvent,
  EventsResponse,
  SearchAgent,
  SearchResponse,
  EventsOptions,
  SearchOptions,
  SignalsOptions,
  EvaluateOptions,
  EvaluatePreset,
  EvaluateResponse,
  Evaluation,
  EvaluationEvidence,
} from '@denlabs/trust-client-core'
