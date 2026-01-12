import {
  RateLimitError,
  AuthError,
  ModelError,
  ServerError,
  NetworkError,
  ParseError,
} from '../errors'

interface RequestOptions {
  method: string
  headers: Record<string, string>
  body?: string
  signal?: AbortSignal
}

interface RetryOptions {
  maxRetries: number
  shouldRetry: boolean
  signal?: AbortSignal
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function getRetryDelay(attempt: number, retryAfter?: number): number {
  if (retryAfter !== undefined) {
    return retryAfter * 1000
  }
  const baseDelay = 1000 * Math.pow(2, attempt)
  const jitter = Math.random() * 200
  return Math.min(baseDelay + jitter, 30000)
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The operation was aborted', 'AbortError'))
      return
    }

    const timeout = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort)
      }
      resolve()
    }, ms)

    const onAbort = () => {
      clearTimeout(timeout)
      reject(new DOMException('The operation was aborted', 'AbortError'))
    }

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true })
    }
  })
}

async function handleErrorResponse(response: Response): Promise<never> {
  let errorMessage = `HTTP ${response.status}`

  try {
    const errorData = await response.json()
    if (errorData?.error?.message) {
      errorMessage = errorData.error.message
    }
  } catch {
    try {
      const textError = await response.text()
      if (textError) {
        errorMessage = textError
      }
    } catch {
      // Use default error message
    }
  }

  const status = response.status

  if (status === 429) {
    let retryAfterSeconds: number | undefined
    try {
      const retryAfter = response.headers?.get('Retry-After')
      retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined
    } catch {
      retryAfterSeconds = undefined
    }
    throw new RateLimitError(errorMessage, status, retryAfterSeconds)
  }

  if (status === 401 || status === 403) {
    throw new AuthError(errorMessage, status)
  }

  if (status === 404) {
    throw new ModelError(errorMessage, status)
  }

  throw new ServerError(errorMessage, status)
}

export async function fetchWithRetry(
  url: string,
  options: RequestOptions,
  retryOptions: RetryOptions
): Promise<Response> {
  const { maxRetries, shouldRetry, signal } = retryOptions

  if (signal?.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }

  let lastError: Error | undefined
  const maxAttempts = shouldRetry ? maxRetries + 1 : 1

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { ...options, signal })

      if (!response) {
        throw new Error('fetch returned undefined')
      }

      if (!response.ok) {
        const status = response.status

        if (shouldRetry && isRetriableStatus(status) && attempt < maxAttempts - 1) {
          let retryAfter: number | undefined
          if (status === 429) {
            try {
              const retryAfterHeader = response.headers?.get('Retry-After')
              retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined
            } catch {
              retryAfter = undefined
            }
          }

          const delay = getRetryDelay(attempt, retryAfter)
          await sleep(delay, signal)
          continue
        }

        await handleErrorResponse(response)
      }

      return response
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }

      if (
        error instanceof RateLimitError ||
        error instanceof AuthError ||
        error instanceof ModelError ||
        error instanceof ServerError
      ) {
        if (
          shouldRetry &&
          (error instanceof RateLimitError || error instanceof ServerError) &&
          attempt < maxAttempts - 1
        ) {
          const retryAfter =
            error instanceof RateLimitError ? error.retryAfter : undefined
          const delay = getRetryDelay(attempt, retryAfter)
          await sleep(delay, signal)
          lastError = error
          continue
        }

        throw error
      }

      if (attempt < maxAttempts - 1 && shouldRetry) {
        lastError = error as Error
        const delay = getRetryDelay(attempt)
        await sleep(delay, signal)
        continue
      }

      throw new NetworkError(
        `Network request failed: ${(error as Error).message}`,
        error as Error
      )
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new NetworkError('Request failed after retries')
}

export function parseJsonResponse<T>(data: unknown): T {
  if (!data || typeof data !== 'object') {
    throw new ParseError('Response is not a valid object')
  }

  const response = data as Record<string, unknown>

  if (!response.choices || !Array.isArray(response.choices) || response.choices.length === 0) {
    throw new ParseError('Response missing choices array')
  }

  const choice = response.choices[0] as Record<string, unknown>

  if (!choice || typeof choice !== 'object') {
    throw new ParseError('Invalid choice object in response')
  }

  if (!choice.message || typeof choice.message !== 'object') {
    throw new ParseError('Response missing message object')
  }

  const message = choice.message as Record<string, unknown>

  if (message.content === undefined && message.content !== null && message.content !== '') {
    throw new ParseError('Response missing content field')
  }

  return data as T
}
