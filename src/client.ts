import { API_PREFIX, DEFAULT_BASE_URL } from './constants'
import {
  AuthenticationError,
  DenScopeError,
  PaymentRequiredError,
} from './errors'
import { buildPaymentHeader, decodePaymentRequired } from './x402'
import type {
  AgentProfileResponse,
  ApiKeyConfig,
  DenScopeConfig,
  EventsOptions,
  EventsResponse,
  ScoreResponse,
  SearchOptions,
  SearchResponse,
  SignalsOptions,
  SignalsResponse,
  X402Config,
} from './types'

function isApiKeyConfig(config: DenScopeConfig): config is ApiKeyConfig {
  return 'apiKey' in config
}

function isX402Config(config: DenScopeConfig): config is X402Config {
  return 'account' in config
}

export class DenScope {
  private readonly baseUrl: string
  private readonly config: DenScopeConfig

  constructor(config: DenScopeConfig) {
    this.config = config
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  }

  /** Get agent profile */
  async getAgent(chainId: number, agentId: number): Promise<AgentProfileResponse> {
    return this.request(`/agent/${chainId}/${agentId}`)
  }

  /** Get trust score (supports x402) */
  async getScore(chainId: number, agentId: number): Promise<ScoreResponse> {
    return this.request(`/agent/${chainId}/${agentId}/score`)
  }

  /** Get agent signals/incidents (supports x402) */
  async getSignals(
    chainId: number,
    agentId: number,
    options?: SignalsOptions,
  ): Promise<SignalsResponse> {
    const params = new URLSearchParams()
    if (options?.status) params.set('status', options.status)
    const qs = params.toString()
    return this.request(`/agent/${chainId}/${agentId}/signals${qs ? `?${qs}` : ''}`)
  }

  /** Get agent events */
  async getEvents(
    chainId: number,
    agentId: number,
    options?: EventsOptions,
  ): Promise<EventsResponse> {
    const params = new URLSearchParams()
    if (options?.limit != null) params.set('limit', String(options.limit))
    if (options?.offset != null) params.set('offset', String(options.offset))
    if (options?.kind) params.set('kind', options.kind)
    const qs = params.toString()
    return this.request(`/agent/${chainId}/${agentId}/events${qs ? `?${qs}` : ''}`)
  }

  /** Search agents */
  async search(options?: SearchOptions): Promise<SearchResponse> {
    const params = new URLSearchParams()
    if (options?.q) params.set('q', options.q)
    if (options?.chainId != null) params.set('chainId', String(options.chainId))
    if (options?.limit != null) params.set('limit', String(options.limit))
    const qs = params.toString()
    return this.request(`/search${qs ? `?${qs}` : ''}`)
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${API_PREFIX}${path}`
    const headers: Record<string, string> = {}

    if (isApiKeyConfig(this.config)) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    const response = await fetch(url, { headers })

    // x402 retry: on 402 with an x402 account, sign and retry once
    if (response.status === 402 && isX402Config(this.config)) {
      const paymentRequired = decodePaymentRequired(response)
      if (!paymentRequired.accepts.length) {
        throw new PaymentRequiredError('No accepted payment methods', paymentRequired)
      }

      const requirement = paymentRequired.accepts[0]
      const paymentHeader = await buildPaymentHeader(
        this.config,
        requirement,
        paymentRequired.resource,
      )

      const retryResponse = await fetch(url, {
        headers: { 'X-PAYMENT': paymentHeader },
      })

      return this.handleResponse<T>(retryResponse)
    }

    return this.handleResponse<T>(response)
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
      return (await response.json()) as T
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      body = await response.text().catch(() => undefined)
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError(
        `Authentication failed: ${response.status}`,
        response.status,
        body,
      )
    }

    if (response.status === 402) {
      throw new PaymentRequiredError('Payment required', body)
    }

    throw new DenScopeError(
      `API error: ${response.status}`,
      response.status,
      body,
    )
  }
}
