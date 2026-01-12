import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLLMClient } from './client'
import {
  ValidationError,
  RateLimitError,
  AuthError,
  ModelError,
  ServerError,
  NetworkError,
  ParseError,
  ConcurrencyError,
} from '../errors'

describe('Error Types', () => {
  it('ValidationError for input validation failures', () => {
    const error = new ValidationError('Test validation error', 'testField')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ValidationError')
    expect(error.message).toBe('Test validation error')
    expect(error.field).toBe('testField')
  })

  it('TypeError for type mismatches', () => {
    const error = new TypeError('Test type error')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('TypeError')
    expect(error.message).toBe('Test type error')
  })

  it('RateLimitError for 429 responses', () => {
    const error = new RateLimitError('Rate limit exceeded', 429, 30)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('RateLimitError')
    expect(error.message).toBe('Rate limit exceeded')
    expect(error.status).toBe(429)
    expect(error.retryAfter).toBe(30)
  })

  it('AuthError for 401/403 responses', () => {
    const error = new AuthError('Unauthorized', 401)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('AuthError')
    expect(error.message).toBe('Unauthorized')
    expect(error.status).toBe(401)
  })

  it('ModelError for model-related 404 responses', () => {
    const error = new ModelError('Model not found', 404)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ModelError')
    expect(error.message).toBe('Model not found')
    expect(error.status).toBe(404)
  })

  it('ServerError for 5xx responses', () => {
    const error = new ServerError('Internal server error', 500)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ServerError')
    expect(error.message).toBe('Internal server error')
    expect(error.status).toBe(500)
  })

  it('NetworkError for fetch/connection failures', () => {
    const cause = new Error('Network failure')
    const error = new NetworkError('Failed to fetch', cause)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('NetworkError')
    expect(error.message).toBe('Failed to fetch')
    expect(error.cause).toBe(cause)
  })

  it('ParseError for JSON/response parsing failures', () => {
    const cause = new SyntaxError('Invalid JSON')
    const error = new ParseError('Failed to parse response', cause)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ParseError')
    expect(error.message).toBe('Failed to parse response')
    expect(error.cause).toBe(cause)
  })

  it('AbortError for cancelled requests', () => {
    const error = new DOMException('The operation was aborted', 'AbortError')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('AbortError')
  })

  it('ConcurrencyError for concurrent conversation operations', () => {
    const error = new ConcurrencyError('Concurrent operation not allowed')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ConcurrencyError')
    expect(error.message).toBe('Concurrent operation not allowed')
  })
})

describe('HTTP Errors', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('throws RateLimitError on 429', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(RateLimitError)
    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toHaveProperty(
      'status',
      429
    )
  })

  it('RateLimitError includes retryAfter if header present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '30' }),
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    } as Response)

    try {
      await client.chat([{ role: 'user', content: 'Hello' }], { retry: false })
    } catch (error) {
      expect(error).toBeInstanceOf(RateLimitError)
      expect((error as RateLimitError).retryAfter).toBe(30)
    }
  })

  it('throws AuthError on 401', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(AuthError)
    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toHaveProperty(
      'status',
      401
    )
  })

  it('throws AuthError on 403', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Forbidden' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(AuthError)
  })

  it('throws ModelError on 404 (model not found)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: 'Model not found' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(ModelError)
    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toHaveProperty(
      'status',
      404
    )
  })

  it('throws ServerError on 500', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Internal server error' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(ServerError)
  })

  it('throws ServerError on 502, 503, 504', async () => {
    for (const status of [502, 503, 504]) {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ error: { message: 'Gateway error' } }),
      } as Response)

      await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(ServerError)
      await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toHaveProperty(
        'status',
        status
      )

      vi.clearAllMocks()
    }
  })

  it('error includes response body message if available', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: 'Model not found' } }),
    } as Response)

    try {
      await client.chat([{ role: 'user', content: 'Hello' }], { retry: false })
    } catch (error) {
      expect(error).toBeInstanceOf(ModelError)
      expect((error as ModelError).message).toContain('Model not found')
    }
  })

  it('error handles non-JSON error response body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Invalid JSON')
      },
      text: async () => 'Internal server error',
    } as Response)

    try {
      await client.chat([{ role: 'user', content: 'Hello' }], { retry: false })
    } catch (error) {
      expect(error).toBeInstanceOf(ServerError)
      expect((error as ServerError).message).toContain('Internal server error')
    }
  })

  it('throws ServerError for unknown 4xx/5xx status', async () => {
    for (const status of [418, 599]) {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status,
        json: async () => ({ error: { message: 'Unknown error' } }),
      } as Response)

      await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(ServerError)
      await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toHaveProperty(
        'status',
        status
      )

      vi.clearAllMocks()
    }
  })

  it('throws NetworkError for non-HTTP errors during fetch', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Invalid URL'))

    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(NetworkError)
  })
})

describe('Network Errors', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('throws NetworkError on fetch failure (no response)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'))

    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(NetworkError)
  })

  it('throws NetworkError on connection timeout', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new DOMException('Timeout', 'TimeoutError'))

    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(NetworkError)
  })

  it('error.cause contains original error', async () => {
    const originalError = new Error('Failed to fetch')
    vi.mocked(fetch).mockRejectedValueOnce(originalError)

    try {
      await client.chat([{ role: 'user', content: 'Hello' }], { retry: false })
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError)
      expect((error as NetworkError).cause).toBe(originalError)
    }
  })
})

describe('Parse Errors', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('throws ParseError on invalid JSON response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Invalid JSON')
      },
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(ParseError)
  })

  it('throws ParseError on unexpected response structure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: 'format' }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(ParseError)
  })

  it('throws ParseError on missing content in response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: {} }],
      }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }], { retry: false })).rejects.toThrow(ParseError)
  })

  it('ParseError includes response body in message for debugging', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: 'format' }),
    } as Response)

    try {
      await client.chat([{ role: 'user', content: 'Hello' }], { retry: false })
    } catch (error) {
      expect(error).toBeInstanceOf(ParseError)
      expect((error as ParseError).message).toBeTruthy()
    }
  })
})
