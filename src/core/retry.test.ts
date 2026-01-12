import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLLMClient } from './client'
import { RateLimitError, ServerError, AuthError, ModelError } from '../errors'

describe('Automatic Retry', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    vi.useFakeTimers()
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries on 429 (rate limit)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const promise = client.chat([{ role: 'user', content: 'Hello' }])
    await vi.advanceTimersByTimeAsync(1000)
    const response = await promise

    expect(response.content).toBe('Success')
  })

  it('retries on 500', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const promise = client.chat([{ role: 'user', content: 'Hello' }])
    await vi.advanceTimersByTimeAsync(1000)
    const response = await promise

    expect(response.content).toBe('Success')
  })

  it('retries on 502, 503, 504', async () => {
    for (const status of [502, 503, 504]) {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: false,
          status,
          json: async () => ({ error: { message: 'Gateway error' } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'test',
            model: 'test',
            choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
        } as Response)

      const promise = client.chat([{ role: 'user', content: 'Hello' }])
      await vi.advanceTimersByTimeAsync(1000)
      const response = await promise

      expect(response.content).toBe('Success')
      vi.clearAllMocks()
    }
  })

  it('does NOT retry on 400', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Bad request' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow(ServerError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow(AuthError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 403', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Forbidden' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow(AuthError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { message: 'Model not found' } }),
    } as Response)

    await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow(ModelError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('respects Retry-After header if present', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '2' }),
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const promise = client.chat([{ role: 'user', content: 'Hello' }])
    await vi.advanceTimersByTimeAsync(2000)
    const response = await promise

    expect(response.content).toBe('Success')
  })

  it('uses exponential backoff: 1s, 2s, 4s', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'test',
          model: 'test',
          choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      } as Response)

    const promise = client.chat([{ role: 'user', content: 'Hello' }])

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(4000)

    const response = await promise
    expect(response.content).toBe('Success')
  })

  it('backoff capped at 30 seconds', async () => {
    const responses = Array.from({ length: 10 }, () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    }))
    responses.push({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'test',
        model: 'test',
        choices: [{ message: { content: 'Success' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    })

    vi.mocked(fetch).mockImplementation(async () => {
      const response = responses.shift()
      return response as Response
    })

    const promise = client.chat([{ role: 'user', content: 'Hello' }], { maxRetries: 10 })

    for (let i = 0; i < 10; i++) {
      const delay = Math.min(1000 * Math.pow(2, i), 30000)
      await vi.advanceTimersByTimeAsync(delay)
    }

    const response = await promise
    expect(response.content).toBe('Success')
  })

  it('maximum 3 retries by default (4 total attempts)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    } as Response)

    const promise = client.chat([{ role: 'user', content: 'Hello' }])

    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(1000 * Math.pow(2, i))
    }

    await expect(promise).rejects.toThrow(ServerError)
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('maxRetries option overrides default', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    } as Response)

    const promise = client.chat([{ role: 'user', content: 'Hello' }], { maxRetries: 5 })

    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(1000 * Math.pow(2, i))
    }

    await expect(promise).rejects.toThrow(ServerError)
    expect(fetch).toHaveBeenCalledTimes(6)
  })

  it('maxRetries: 0 means no retries', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    } as Response)

    await expect(
      client.chat([{ role: 'user', content: 'Hello' }], { maxRetries: 0 })
    ).rejects.toThrow(ServerError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('client.chat(messages, { retry: false })', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('disables automatic retry entirely', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    } as Response)

    await expect(
      client.chat([{ role: 'user', content: 'Hello' }], { retry: false })
    ).rejects.toThrow(RateLimitError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('throws immediately on retriable error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'Service unavailable' } }),
    } as Response)

    await expect(
      client.chat([{ role: 'user', content: 'Hello' }], { retry: false })
    ).rejects.toThrow(ServerError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('Retry and Streaming', () => {
  let client: ReturnType<typeof createLLMClient>

  beforeEach(() => {
    client = createLLMClient({ apiKey: 'sk-test', model: 'anthropic/claude-sonnet-4' })
  })

  it('streaming does NOT retry (fails fast)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    } as Response)

    const stream = client.stream([{ role: 'user', content: 'Hello' }])

    await expect(async () => {
      for await (const _chunk of stream) {
        // Should throw before yielding
      }
    }).rejects.toThrow(RateLimitError)

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('streaming retry: true option is ignored', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    } as Response)

    const stream = client.stream([{ role: 'user', content: 'Hello' }], { retry: true })

    await expect(async () => {
      for await (const _chunk of stream) {
        // Should throw before yielding
      }
    }).rejects.toThrow(ServerError)

    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
