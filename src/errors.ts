export class DenScopeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'DenScopeError'
  }
}

export class PaymentRequiredError extends DenScopeError {
  constructor(message: string, body?: unknown) {
    super(message, 402, body)
    this.name = 'PaymentRequiredError'
  }
}

export class AuthenticationError extends DenScopeError {
  constructor(message: string, status: number = 401, body?: unknown) {
    super(message, status, body)
    this.name = 'AuthenticationError'
  }
}
