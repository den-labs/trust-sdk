export { Ayni } from './client'

// Error aliases for Ayni branding
export {
  TrustClientError as AyniError,
  PaymentRequiredError,
  AuthenticationError,
} from '@denlabs/trust-client-core'

// Re-export all types from core
export type {
  TrustClientConfig as AyniConfig,
  TrustClientFetch as AyniFetch,
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
} from '@denlabs/trust-client-core'
