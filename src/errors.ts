export class LLMError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LLMError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ValidationError extends LLMError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class RateLimitError extends LLMError {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfter?: number
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

export class AuthError extends LLMError {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export class ModelError extends LLMError {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'ModelError'
  }
}

export class ServerError extends LLMError {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'ServerError'
  }
}

export class NetworkError extends LLMError {
  constructor(
    message: string,
    public override readonly cause?: Error
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class ParseError extends LLMError {
  constructor(
    message: string,
    public override readonly cause?: Error
  ) {
    super(message)
    this.name = 'ParseError'
  }
}

export class ConcurrencyError extends LLMError {
  constructor(message: string) {
    super(message)
    this.name = 'ConcurrencyError'
  }
}
