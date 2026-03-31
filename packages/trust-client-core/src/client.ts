import { API_PREFIX } from './constants'
import {
  AuthenticationError,
  TrustClientError,
  PaymentRequiredError,
} from './errors'
import { buildPaymentHeader, decodePaymentRequired } from './x402'
import type {
  AgentProfileResponse,
  ApiKeyConfig,
  TrustClientConfig,
  TrustClientFetch,
  EventsOptions,
  EventsResponse,
  EvaluateOptions,
  EvaluateResponse,
  ScoreResponse,
  SearchOptions,
  SearchResponse,
  SignalsOptions,
  SignalsResponse,
  TrustHistoryOptions,
  TrustHistoryResponse,
  X402Config,
} from './types'

function isApiKeyConfig(config: TrustClientConfig): config is ApiKeyConfig {
  return 'apiKey' in config
}

function isX402Config(config: TrustClientConfig): config is X402Config {
  return 'account' in config
}

export class TrustClient {
  private readonly baseUrl: string
  private readonly config: TrustClientConfig
  private readonly fetchImpl: TrustClientFetch

  constructor(config: TrustClientConfig, defaultBaseUrl: string) {
    this.config = config
    this.baseUrl = (config.baseUrl ?? defaultBaseUrl).replace(/\/$/, '')
    this.fetchImpl = config.fetch ?? globalThis.fetch

    if (!this.fetchImpl) {
      throw new Error('Fetch API is not available. Provide config.fetch in this runtime.')
    }
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

  /**
   * Get windowed trust score history for an agent.
   *
   * Returns a sequence of time-windowed snapshots ordered from oldest to most
   * recent. Unlike the point-in-time `getScore()`, this method surfaces recent
   * degradation that lifetime-aggregate scores would otherwise mask — e.g. an
   * agent whose last 30-day window is 20 points below their all-time score.
   *
   * Supports x402 payment.
   */
  async getTrustHistory(
    chainId: number,
    agentId: number,
    options?: TrustHistoryOptions,
  ): Promise<TrustHistoryResponse> {
    const params = new URLSearchParams()
    if (options?.window) params.set('window', options.window)
    if (options?.limit != null) params.set('limit', String(options.limit))
    const qs = params.toString()
    return this.request(`/agent/${chainId}/${agentId}/history${qs ? `?${qs}` : ''}`)
  }

  /** Evaluate agent trust with contextual preset (supports x402) */
  async evaluate(
    chainId: number,
    agentId: number,
    options: EvaluateOptions,
  ): Promise<EvaluateResponse> {
    return this.requestPost(`/trust/evaluate`, {
      chainId,
      agentId,
      preset: options.preset,
      ...(options.context ? { context: options.context } : {}),
      ...(options.sensitivity ? { sensitivity: options.sensitivity } : {}),
      ...(options.objective ? { objective: options.objective } : {}),
    })
  }

  private async request<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${API_PREFIX}${path}`
    const headers: Record<string, string> = {}

    if (isApiKeyConfig(this.config)) {
      headers.Authorization = `Bearer ${this.config.apiKey}`
    }

    const response = await this.fetchWithConfig(url, { headers })

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

      const retryResponse = await this.fetchWithConfig(url, {
        headers: { 'X-PAYMENT': paymentHeader },
      })

      return this.handleResponse<T>(retryResponse)
    }

    return this.handleResponse<T>(response)
  }

  private async requestPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${API_PREFIX}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (isApiKeyConfig(this.config)) {
      headers.Authorization = `Bearer ${this.config.apiKey}`
    }

    const response = await this.fetchWithConfig(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    // x402 retry for POST
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

      const retryResponse = await this.fetchWithConfig(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PAYMENT': paymentHeader },
        body: JSON.stringify(body),
      })

      return this.handleResponse<T>(retryResponse)
    }

    return this.handleResponse<T>(response)
  }

  private async fetchWithConfig(
    url: string,
    init: { method?: string; headers: Record<string, string>; body?: string },
  ): Promise<Response> {
    const { signal, cleanup } = this.createRequestSignal()
    try {
      const requestInit: RequestInit = {
        method: init.method ?? 'GET',
        headers: init.headers,
      }
      if (init.body) requestInit.body = init.body
      if (signal) requestInit.signal = signal
      return await this.fetchImpl(url, requestInit)
    } finally {
      cleanup()
    }
  }

  private createRequestSignal(): {
    signal?: AbortSignal
    cleanup: () => void
  } {
    const timeoutMs = this.config.timeoutMs
    const baseSignal = this.config.signal

    if (timeoutMs == null) {
      return { signal: baseSignal, cleanup: () => {} }
    }

    const controller = new AbortController()
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const abortFromBase = () => {
      controller.abort(baseSignal?.reason ?? new Error('Request aborted'))
    }

    if (baseSignal) {
      if (baseSignal.aborted) {
        abortFromBase()
      } else {
        baseSignal.addEventListener('abort', abortFromBase, { once: true })
      }
    }

    timeoutId = setTimeout(() => {
      controller.abort(new Error(`Request timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    return {
      signal: controller.signal,
      cleanup: () => {
        if (timeoutId) clearTimeout(timeoutId)
        if (baseSignal) baseSignal.removeEventListener('abort', abortFromBase)
      },
    }
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

    throw new TrustClientError(
      `API error: ${response.status}`,
      response.status,
      body,
    )
  }
}
