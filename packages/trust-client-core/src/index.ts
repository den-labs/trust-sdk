export { TrustClient } from './client'
export { TrustClientError, PaymentRequiredError, AuthenticationError } from './errors'
export { decodePaymentRequired, buildPaymentHeader } from './x402'
export { API_PREFIX, EIP3009_TYPES, SIGNATURE_VALIDITY_SECONDS } from './constants'
export type {
  TrustClientConfig,
  TrustClientFetch,
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
  PaymentRequirement,
  ResourceInfo,
  PaymentRequiredBody,
} from './types'
